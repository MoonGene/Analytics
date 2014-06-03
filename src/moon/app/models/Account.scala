/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package models

import play.api._
import play.api.mvc._
import org.joda.time.DateTime
import reactivemongo.bson._
import reactivemongo.api.collections.default.BSONCollection
import java.text.NumberFormat
import java.util.Locale

/*
  User account models:
    - Access level: Admin, User, Support
    - Stored data: segments
    - Contact details
    - Apps list
    - etc.
 */

object AccountAccessLevel extends Enumeration {
  type AccountAccessLevel = Value
  val Invalid, Admin, User, Support = Value

  def intFromLevel(al: AccountAccessLevel) : Int = al match {
    case Admin => 0
    case User  => 1
    case Support => 2
    case _ => -1
  }

  def levelFromInt(i: Int): AccountAccessLevel = i match {
    case 0 => Admin
    case 1 => User
    case 2 => Support
    case _ => Invalid
  }

  def levelFromStr(s: String): AccountAccessLevel = s match {
    case "Admin" => Admin
    case "User"  => User
    case "Support" => Support
    case _ => Invalid
  }
}

case class AccountSegment(
  name: String,
  countries: Option[List[String]],
  cities: Option[List[Int]],
  platform: Option[List[Int]],
  platformV: Option[List[String]],
  language: Option[List[String]],
  vendor: Option[List[String]],
  model: Option[List[String]],
  carrier: Option[List[String]],
  connection: Option[List[String]],
  appversion: Option[List[String]],
  usertype: Option[List[String]],
  trafficsource: Option[List[String]],
  resolution: Option[List[String]]
  )

import AccountAccessLevel._
case class Account(
  id: Option[BSONObjectID],
  firstName: String,
  lastName: String,
  company: String,
  email: String,
  phone: Option[String],
  website: Option[String],
  timezone: Option[String],
  pass: String,
  salt: String,
  suspended: Boolean,
  suspensionDetails: Option[String],
  key: String,
  accessLevel: AccountAccessLevel,
  created: DateTime,
  lastLogin: DateTime,
  apps: List[BSONObjectID],
  tokens: List[String],
  segments: Option[List[AccountSegment]])

case class ContactDetails(
  id: BSONObjectID,
  firstName: String,
  lastName: String,
  company: String,
  email: String,
  phone: Option[String],
  website: Option[String]
)

object AccountSegment {
  implicit object AccountSegmentBSONReader extends BSONDocumentReader[AccountSegment] {
    def read(doc: BSONDocument): AccountSegment =
      AccountSegment(
        doc.getAs[String]("name").get,
        doc.getAs[List[String]]("countries"),
        doc.getAs[List[Int]]("cities"),
        doc.getAs[List[Int]]("platform"),
        doc.getAs[List[String]]("platformV"),
        doc.getAs[List[String]]("language"),
        doc.getAs[List[String]]("vendor"),
        doc.getAs[List[String]]("model"),
        doc.getAs[List[String]]("carrier"),
        doc.getAs[List[String]]("connection"),
        doc.getAs[List[String]]("appversion"),
        doc.getAs[List[String]]("usertype"),
        doc.getAs[List[String]]("trafficsource"),
        doc.getAs[List[String]]("resolution")
      )
  }

  implicit object AccountSegmentBSONWriter extends BSONDocumentWriter[AccountSegment] {
    def write(segment: AccountSegment): BSONDocument =
      BSONDocument(
        "name" -> segment.name,
        "countries" -> segment.countries,
        "cities" -> segment.cities,
        "platform" -> segment.platform,
        "platformV" -> segment.platformV,
        "language" -> segment.language,
        "vendor" -> segment.vendor,
        "model" -> segment.model,
        "carrier" -> segment.carrier,
        "connection" -> segment.connection,
        "appversion" -> segment.appversion,
        "usertype" -> segment.usertype,
        "trafficsource" -> segment.trafficsource,
        "resolution" -> segment.resolution
      )
  }
}

object Account {
  implicit object AccountBSONReader extends BSONDocumentReader[Account] {
    def read(doc: BSONDocument): Account =
      Account(
        doc.getAs[BSONObjectID]("_id"),
        doc.getAs[String]("first_name").get,
        doc.getAs[String]("last_name").get,
        doc.getAs[String]("company").get,
        doc.getAs[String]("email").get,
        doc.getAs[String]("phone"),
        doc.getAs[String]("website"),
        doc.getAs[String]("timezone"),
        doc.getAs[String]("pass").get,
        doc.getAs[String]("salt").get,
        doc.getAs[Boolean]("suspended").get,
        doc.getAs[String]("suspension_details"),
        doc.getAs[String]("key").get,
        doc.getAs[Int]("access_level").map(l => AccountAccessLevel.levelFromInt(l)).get,
        doc.getAs[BSONDateTime]("created").map(dt => new DateTime(dt.value)).get,
        doc.getAs[BSONDateTime]("last_login").map(dt => new DateTime(dt.value)).get,
        doc.getAs[List[BSONObjectID]]("apps").get.toList,
        doc.getAs[List[String]]("tokens").get.toList,
        doc.getAs[List[AccountSegment]]("segments")
      )
  }

  implicit object AccountBSONWriter extends BSONDocumentWriter[Account] {
    def write(account: Account): BSONDocument =
      BSONDocument(
        "_id" -> account.id.getOrElse(BSONObjectID.generate),
        "first_name" -> account.firstName,
        "last_name" -> account.lastName,
        "company" -> account.company,
        "email" -> account.email,
        "phone" -> account.phone,
        "website" -> account.website,
        "timezone" -> account.timezone,
        "pass" -> account.pass,
        "salt" -> account.salt,
        "suspended" -> account.suspended,
        "suspension_details" -> account.suspensionDetails,
        "key" -> account.key,
        "access_level" -> AccountAccessLevel.intFromLevel(account.accessLevel),
        "created" -> BSONDateTime(account.created.getMillis),
        "last_login" -> BSONDateTime(account.lastLogin.getMillis),
        "apps" -> account.apps,
        "tokens" -> account.tokens,
        "segments" -> account.segments
      )
  }
}