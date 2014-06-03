/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package models

import reactivemongo.bson._
import org.joda.time.{DateTimeZone, DateTime}
import scala.util.Random
import collection.parallel.mutable

/*
  App models:
    - user access level
    - users who have access
    - app details and state
 */
object AppAccessLevel extends Enumeration {
  type AppAccessLevel = Value
  val Invalid, Owner, User, ReadOnlyUser = Value

  def intFromLevel(al: AppAccessLevel) : Int = al match {
    case Owner => 0
    case User  => 1
    case ReadOnlyUser => 2
    case _ => -1
  }

  def levelFromInt(i: Int): AppAccessLevel = i match {
    case 0 => Owner
    case 1 => User
    case 2 => ReadOnlyUser
    case _ => Invalid
  }
}

import AppAccessLevel._
case class MobileAppAccess(user: BSONObjectID, level: AppAccessLevel)

case class MobileApp(
  id: Option[BSONObjectID],
  name: String,
  //friendlyName: String,
  access: List[MobileAppAccess] = List(),
  suspended: Boolean = false,
  deleted: Boolean = false,
  suspensionDetails: Option[String] = None,
  description: String = "",
  created: DateTime = DateTime.now,
  token: String = MobileApp.randomToken(),
  timezone: String = DateTimeZone.UTC.getID)

object MobileAppAccess {
  implicit object MobileAppAccessBSONReader extends BSONDocumentReader[MobileAppAccess] {
    def read(doc: BSONDocument): MobileAppAccess =
      MobileAppAccess(
        doc.getAs[BSONObjectID]("user").get,
        doc.getAs[Int]("level").map(l => AppAccessLevel.levelFromInt(l)).get)
  }

  implicit object MobileAppAccessBSONWriter extends BSONDocumentWriter[MobileAppAccess] {
    def write(appAccess: MobileAppAccess): BSONDocument =
      BSONDocument(
        "user" -> appAccess.user,
        "level" -> AppAccessLevel.intFromLevel(appAccess.level))
  }
}

object MobileApp {
  implicit object MobileAppBSONReader extends BSONDocumentReader[MobileApp] {
    def read(app: BSONDocument): MobileApp =
      MobileApp(
        app.getAs[BSONObjectID]("_id"),
        app.getAs[String]("name").get,
        app.getAs[List[MobileAppAccess]]("access").get.toList,
        app.getAs[Boolean]("suspended").get,
        app.getAs[Boolean]("deleted").getOrElse(false),
        app.getAs[String]("suspension_details"),
        app.getAs[String]("description").get,
        app.getAs[BSONDateTime]("created").map(dt => new DateTime(dt.value)).get,
        app.getAs[String]("token").get,
        app.getAs[String]("timezone").get)
  }

  implicit object MobileAppBSONWriter extends BSONDocumentWriter[MobileApp] {
    def write(app: MobileApp): BSONDocument =
      BSONDocument(
        "_id" -> app.id.getOrElse(BSONObjectID.generate),
        "name" -> app.name,
        "access" -> app.access,
        "suspended" -> app.suspended,
        "deleted" -> app.deleted,
        "suspension_details" -> app.suspensionDetails,
        "description" -> app.description,
        "created" -> BSONDateTime(app.created.getMillis),
        "token" -> app.token,
        "timezone" -> app.timezone)
  }

  def randomToken() = {
    val rand = new Random(new java.security.SecureRandom())
    rand.alphanumeric.take(6).mkString
  }
}
