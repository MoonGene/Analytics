/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services

import reactivemongo.bson._
import reactivemongo.core.commands.LastError
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.api.MongoDriver
import scala.concurrent.ExecutionContext.Implicits.global
import com.moongene.GeneConfig
import com.typesafe.config.ConfigFactory
import scala.collection.JavaConverters._

object Database {
  //TODO remove this from here, because every time front-end also initializes mongoDB even though doesn't need it
  //TODO Class instance must be passed as a constructor parameter to master classes and connection to workers.
  lazy val dbDriver = new MongoDriver()

  val config = ConfigFactory.load()
  val dbServersList = config.getStringList("moongene.db.servers").asScala.toList

  lazy val dbConnection = dbDriver.connection(dbServersList)

  def getDatabase(name: String) = {
    dbConnection.db(name)
  }

  def getCollection(dbName: String, collectionName: String) : BSONCollection = {
    dbConnection.db(dbName).collection(collectionName)
  }

  object Helper {

    // Additional functionality that is missing in reactivemongo, currently tree like path is
    // not supported by it, so we recursively inspect the tree to get a document.
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
          //We need also to support IDs with dots, for example "1.0"
          currentChunk += "."
        }

        pathIndex += 1
      }

      None
    }
  }
}
