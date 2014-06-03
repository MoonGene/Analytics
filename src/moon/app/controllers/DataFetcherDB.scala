/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import reactivemongo.bson._
import buffer.BSONIterator
import reactivemongo.core.commands.LastError
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.api.MongoDriver
import scala.concurrent.ExecutionContext.Implicits.global
import util.{Failure, Success, Try}
import com.typesafe.config.ConfigFactory
import scala.collection.JavaConverters._
import play.api.Play

object DataFetcherDB {
  //TODO remove this from here, because every time now also front-end initializes mongoDB even though doesn't need it
  //class object must be passed as a constructor parameter to master classes and connection to workers.
  lazy val dbDriver = new MongoDriver()

  val config = ConfigFactory.load()
  val dbServersList = Play.current.configuration.getStringList("moongene.db.servers").get.asScala.toList
  lazy val dbConnection = dbDriver.connection(dbServersList)

  def getDatabase(name: String) = {
    dbConnection.db(name)
  }

  def getCollection(dbName: String, collectionName: String) : BSONCollection = {
    dbConnection.db(dbName).collection(collectionName)
  }

  object Helper {
    //ReactiveMongo has no functionality to retrieve nested documents, but this one has
    def getAsByPath[T](path: String, doc: BSONDocument)(implicit reader: BSONReader[_ <: BSONValue, T]): Option[T] = {
      val pathChunks = path.split('.')
      var pathIndex = 0
      var curDoc: Option[BSONDocument] = Some(doc)
      var currentChunk = ""

      while(pathIndex != pathChunks.size) {
        currentChunk += pathChunks(pathIndex)

        // If this is the last chunk it must be a value
        // and if previous Doc is valid let's get it
        if (pathIndex == pathChunks.size - 1 && curDoc != None)
          return curDoc.get.getAs[T](currentChunk)

        val tmpDoc = curDoc.get.getAs[BSONDocument](currentChunk)
        if (tmpDoc != None) {
          currentChunk = ""
          curDoc = tmpDoc
        } else {
          //We need to support this as sometimes doc ID contain dots, for example "1.0"
          currentChunk += "."
        }

        pathIndex += 1
      }

      None
    }
  }

  //TODO Optimize this by splitting into two different types, with ID and without to speed up things
  private def json(i: Int, it: Iterator[Try[BSONElement]], noID: Boolean = false): String = {
    val prefix = (0 to i).map { i => "  " }.mkString("")
    (for (tryElem <- it) yield {
      tryElem match {
        case Success(elem) => elem._2 match {
          case doc: BSONDocument => prefix + (if(!noID) ('"' + elem._1 + "\": {\n") else ("{\n")) + json(i + 1, doc.stream.iterator) + "\n" + prefix + "}"
          case array: BSONArray  => prefix + '"' + elem._1 + "\": [\n" + json(i + 1, array.iterator, noID = true) + "\n" + prefix + "]"
          case int: BSONInteger  => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("")) + int.value
          case dbl: BSONDouble   => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("")) + dbl.value
          case bln: BSONBoolean  => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("")) + bln.value
          case lng: BSONLong     => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("")) + lng.value
          case dtt: BSONDateTime => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("")) + dtt.value
          case boi: BSONObjectID => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("\n")) + '\"' + boi.stringify + '"'
          case str: BSONString   => prefix + (if(!noID) ('"' + elem._1 + "\": ") else ("\n")) + "\"" + str.value.replace("\\", "&#92")/*.replace("/", "&#47")*/ + '"'
          case _ => prefix + '"' + elem._1 + "\": " + (if(elem._2 == BSONNull) "null" else elem._2.toString)
        }
        case Failure(e) => prefix + s"ERROR[${e.getMessage}]"
      }
    }).mkString(",")
  }


  /** Makes a Json representation of the given iterator of BSON elements. */
  def jsonFromIterator(it: Iterator[Try[BSONElement]]): String = "{\n" + json(0, it) + "\n}"
  def json(doc: BSONDocument): String = jsonFromIterator(doc.stream.iterator)
  def json(docs: List[BSONDocument]): String = {
    var finalJson = "{ "
    for (i <- 0 until docs.size){
      val doc = docs(i)
      val docID = doc.getAs[String]("_id").getOrElse(doc.getAs[BSONObjectID]("_id").get.stringify)
      finalJson += "\"" + docID + "\": " + json(doc) + (if(i == docs.size - 1) "" else ",")
    }
    finalJson + "}"
  }
}