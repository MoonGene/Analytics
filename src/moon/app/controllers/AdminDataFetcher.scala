/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import _root_.models._

import play.api._
import libs.iteratee.Iteratee
import play.api.mvc._
import play.api.libs.json._

import reactivemongo.bson.{BSONObjectID, BSONDateTime, BSONDocument}
import org.joda.time.DateTime
import concurrent.{Await, Future}
import concurrent.duration._
import reactivemongo.bson.BSONDateTime
import reactivemongo.bson.BSONDateTime

/*
  AdminDataFetcher controller:
    - fetches system health metrics
    - fetches users and apps
 */

object AdminDataFetcher extends Controller with Secured with DataAccess {

  //Collections for various documents
  val healthColl = DataFetcherDB.getCollection("health", "metrics")
  val usersColl = DataFetcherDB.getCollection("guard", "users")
  val appsColl = DataFetcherDB.getCollection("guard", "apps")
  val statsColl = DataFetcherDB.getCollection("gate", "stats")

  def getDayStartTime(date: DateTime) = date.millisOfDay.setCopy(0)
  def getDayEndTime(date: DateTime) = date.millisOfDay.setCopy(86399999)

  def health(dateFromMs: Long, dateToMs: Long = 0) = IsAccountAccessLevel(AccountAccessLevel.Admin){ email => implicit request =>
    Async {
      val dateFrom = getDayStartTime(new DateTime(dateFromMs))
      val dateTo = getDayEndTime(if(dateToMs < dateFromMs) DateTime.now else new DateTime(dateToMs))

      val query = BSONDocument(
        "ts" -> BSONDocument( "$gte" -> BSONDateTime(dateFrom.getMillis),
                              "$lte" -> BSONDateTime(dateTo.getMillis)))

      val healthDayFutureDocs = healthColl.find(query).cursor[BSONDocument].toList()
      healthDayFutureDocs.map( healthDayDocs => {
        val jsonStr = DataFetcherDB.json(healthDayDocs)
        Ok(jsonStr).as("application/json")
      })

    }
  }

  //TODO Add users and apps management by admins
}