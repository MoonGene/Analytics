/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package models

import play.api.mvc._
import play.api.Play.current
import scala.concurrent.{ Future, ExecutionContext }
import play.modules.reactivemongo.ReactiveMongoPlugin
import reactivemongo.bson._
import reactivemongo.core.commands.{GetLastError, LastError}
import org.joda.time.DateTime
import controllers.{DataFetcherDB, routes}
import reactivemongo.bson.BSONDateTime
import reactivemongo.bson.BSONBoolean
import reactivemongo.core.commands.GetLastError
import reactivemongo.bson.BSONString
import scala.Some
import reactivemongo.api.collections.default.BSONCollection

/*
  DataAccess trail:
    - provides helpers to retrieve data from DB
 */

trait DataAccess {
  self: Controller =>

  implicit def accountEC: ExecutionContext = ExecutionContext.Implicits.global
  def dataAppDriver = ReactiveMongoPlugin.driver         // Returns the current instance of the driver.
  def dataAppConnection = ReactiveMongoPlugin.connection //Returns the current MongoConnection instance (the connection pool manager)
  def dataDB = ReactiveMongoPlugin.db                    //Returns the default database (as specified in `application.conf`).

  val usersCollection = dataDB[BSONCollection]("users")
  val appsCollection = dataDB[BSONCollection]("apps")
  val subscriptionsCollection = dataDB[BSONCollection]("subscription")

  def appsAll(acc: Account) : Future[List[MobileApp]] = {
    val query = BSONDocument(
      "_id" -> BSONDocument(
        "$in" -> acc.apps ))

    val found = appsCollection.find(query).cursor[MobileApp]
    found.toList
  }

  def accountAll(app: MobileApp) : Future[List[Account]] = {
    val query = BSONDocument(
      "apps" -> BSONDocument(
        "$in" -> BSONArray(app.id.get)
      )
    )

    val found = usersCollection.find(query).cursor[Account]
    found.toList()
  }

  def appAddToAccount(acc: Account, id: BSONObjectID) : Future[LastError] = {
    val query = BSONDocument(
      "email" -> acc.email)

    val update = BSONDocument(
      "$push" -> BSONDocument(
        "apps" -> id))

    usersCollection.update(query, update)
  }

  def removeAppFromAccount(acc: Account, appId: String) : Future[LastError] = {
    val query = BSONDocument(
      "email" -> acc.email)

    val update = BSONDocument(
      "$pull" -> BSONDocument(
        "apps" -> BSONObjectID(appId)))

    usersCollection.update(query, update)
  }

  def appCreate(acc: Account, app: MobileApp) : Future[Option[BSONObjectID]] = {
    //TODO No check if it failed, we need in case of failure return None
    val newId = app.id.getOrElse(BSONObjectID.generate)
    appsCollection.insert(app.copy(id = Some(newId), access = List(MobileAppAccess(acc.id.get, AppAccessLevel.Owner)))).map( _ =>
        Some(newId)
      )
  }

  def appAddToVaultChange(section: String, id: BSONObjectID, token: Option[String], timezone: Option[String]) : Future[Boolean] = {
    val query = BSONDocument(
      "_id" -> "APPSVAULTCHANGES")

    val update = BSONDocument(
      "$push" -> BSONDocument(
        section -> BSONDocument(
          "id" -> id.stringify,
          "token" -> token,
          "timezone" -> timezone)))

    appsCollection.update(query, update, GetLastError(), upsert = true).map( lastError => {
      if(lastError.ok) true else false
    }).recover({
      case _ => false //If failed we just send failed
    })
  }

  def appDelFromAccount(acc: Account, id: BSONObjectID) : Future[LastError] = {
    val query = BSONDocument(
      "email" -> acc.email)

    val update = BSONDocument(
      "$pull" -> BSONDocument(
        "apps" -> id))

    usersCollection.update(query, update)
  }

  def appDelete(acc: Account, id: BSONObjectID) : Future[LastError] = {
    appsCollection.remove(BSONDocument("_id" -> id), firstMatchOnly = true)
  }

  def appUpdate(app: MobileApp) : Future[LastError] = {
    val modifier = BSONDocument(
      "$set" -> BSONDocument(
        "name" -> BSONString(app.name),
        "suspended" -> BSONBoolean(app.suspended),
        "suspensionDetails" -> app.suspensionDetails.getOrElse(""),
        "description" -> BSONString(app.description),
        "token" -> BSONString(app.token)
       )
    )
    appsCollection.update(BSONDocument("_id" -> app.id), modifier)
  }

  def appDelete(appId: String, account: Account) : Future[LastError] = {
    val modifier = BSONDocument(
      "$set" -> BSONDocument(
        "deleted" -> BSONBoolean(true)
      )
    )

    removeAppFromAccount(account, appId)
    appsCollection.update(BSONDocument("_id" -> BSONObjectID(appId)), modifier)
  }

  def contactDetailsUpdate(contactDetails: ContactDetails) : Future[LastError] = {
    val modifier = BSONDocument(
      "$set" -> BSONDocument(
        "first_name" -> BSONString(contactDetails.firstName),
        "last_name" -> BSONString(contactDetails.lastName),
        "company" -> BSONString(contactDetails.company),
        "email" -> BSONString(contactDetails.email),
        "phone" -> BSONString(contactDetails.phone.getOrElse("")),
        "website" -> BSONString(contactDetails.website.getOrElse(""))
      )
    )
    usersCollection.update(BSONDocument("_id" -> contactDetails.id), modifier)
  }

  def appById(id: String, apps: List[MobileApp], defaultAll: Boolean = true): Option[MobileApp] = {
    val app = apps.find(app => (app.id.get.stringify == id && app.deleted != true))
    if (defaultAll) {
      if(app == None)
        Some(MobileApp(None, "All"))
      else
        app
    }
      else
        app
  }

  def appById(id: String): Future[Option[MobileApp]] = {
    val query = BSONDocument("_id" -> BSONObjectID(id))
    appsCollection.find(query).one[MobileApp]
  }

  def accountById(id: String): Future[Option[Account]] = {
    val query = BSONDocument("_id" -> BSONObjectID(id))
    usersCollection.find(query).one[Account];
  }

  def accountByEmail(email: String) : Future[Option[Account]] = {
    val query = BSONDocument(
      "email" -> email.toLowerCase)

    val found: Future[Option[Account]] = usersCollection.find(query).one[Account]
    found
  }

  def getAppUsedValues(id: String): Future[Option[BSONDocument]] = {
    val query = BSONDocument("_id" -> "USEDVALUES")

    DataFetcherDB.getCollection("gate", id).find(query).one[BSONDocument]
  }

  def accountCreate(acc: Account): Future[Boolean] = {
    usersCollection.insert(acc).map(_ => true)
  }

  def accountDeleteTokenByEmail(email: String, token: String) = {
    val modifier = BSONDocument(
      "$pull" -> BSONDocument(
          "tokens" -> token
        ))

    usersCollection.update(BSONDocument("email" -> email), modifier)
  }

  def accountUpdatePassword(acc: Account, password: String) = {
    val modifier = BSONDocument(
      "$set" -> BSONDocument(
        "pass" -> password
      )
    )

    usersCollection.update(BSONDocument("_id" -> acc.id), modifier)
  }

  def accountUpdateSegments(acc: Account, segments: Option[List[AccountSegment]]) = {
    val modifier = BSONDocument(
      "$set" -> BSONDocument(
        "segments" -> segments
      )
    )

    usersCollection.update(BSONDocument("_id" -> acc.id), modifier)
  }

  def subscribeUser(name: Option[String], email: String, code: String) = {
    //TODO No check for code string validness, also for email and name to prevent DB injection
    val modifier = BSONDocument(
    "$push" -> BSONDocument(
        code -> BSONDocument("name" -> name, "email" -> email)
      )
    )

    subscriptionsCollection.update(BSONDocument("_id" -> "subscribers"), modifier, GetLastError(), upsert = true)
  }

  def accountUpdateLoginDate(acc: Account, date: DateTime, updateTokens: Boolean)= {
    var modifier = BSONDocument(
      "$set" -> BSONDocument(
          "last_login" -> BSONDateTime(date.getMillis)
        ))

    if(updateTokens)
      modifier = modifier.add(BSONDocument(
        "$set" -> BSONDocument(
          "tokens" -> acc.tokens
        )))

    usersCollection.update(BSONDocument("_id" -> acc.id), modifier)
  }

}