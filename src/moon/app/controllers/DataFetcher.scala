/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import _root_.models.{AccountSegment, DataAccess, SegmentQuery}

import play.api._
import play.api.data._
import play.api.data.Forms._
import play.api.mvc._
import play.api.libs.json._

import reactivemongo.bson.{BSONObjectID, BSONDocument}
import org.joda.time.{DateTimeZone, DateTime}
import concurrent.{Promise, Future}
import services.{EmailMessage, EmailService}

/*
  DataFetcher:
    - fetches analytical data from DB for displaying various analytics pages
    - support messages sending and processing
 */

object DataFetcher extends Controller with Secured with DataAccess {
  def getDayStartTime(date: DateTime) = date.millisOfDay.setCopy(0)
  def getDayEndTime(date: DateTime) = date.millisOfDay.setCopy(86399999)

  def getDocIDsFromTimeRange(from: DateTime, to: DateTime) = {
    val monthIdsSet = collection.mutable.HashSet[String]()

    //We always work in months, so we just set this to first day of the month
    var currentDate = from.dayOfMonth.setCopy(1)
    val lastDate = to.dayOfMonth.setCopy(28) //28 is enough because it will be always before 1 in starting date

    while({currentDate.isBefore(to)}) {
      monthIdsSet.add(currentDate.getYear + "-" + currentDate.getMonthOfYear)
      currentDate = currentDate.plusMonths(1)
    }

    monthIdsSet
  }

  def getDocIDForDate(date: DateTime) = date.getYear + "-" + date.getMonthOfYear

  def dashboard(appId: String, dateFromMs: Long, dateToMs: Long = 0) = getMonthDocs(appId, dateFromMs, dateToMs)

  def getMonthDocs(appId: String, dateFromMs: Long, dateToMs: Long = 0)  = IsAuthenticated{ email => request =>
    //Check whether this user has access to this app
    Async {
      accountByEmail(email).map( acc =>
        if(acc == None || acc.get.apps.filter(_.stringify == appId).size < 1) {
          Forbidden("You are not authorized to view this app details.")
        } else {
          val dateFrom = getDayStartTime(new DateTime(dateFromMs, DateTimeZone.UTC))
          val dateTo = getDayEndTime(if(dateToMs < dateFromMs) DateTime.now.toDateTime(DateTimeZone.UTC) else new DateTime(dateToMs, DateTimeZone.UTC))
          val docsIds = getDocIDsFromTimeRange(dateFrom, dateTo)

          val appColl = DataFetcherDB.getCollection("gate", appId)
          val query = BSONDocument("_id" -> BSONDocument( "$in" -> docsIds ))
          val filter = BSONDocument("_id" -> 1, "v" -> 2, "va" -> 3)

          val appMonthFutureDocs = appColl.find(query, filter).cursor[BSONDocument].toList()

          Async {
            appMonthFutureDocs.map( appMonthDocs => {
              val jsonStr = DataFetcherDB.json(appMonthDocs)
              Ok(jsonStr).as("application/json")
            })
          }
        }
      )
    }
  }

  def getMonthDoc(appId: String, date: Long, includeVersion: Boolean, includeFlow: Boolean, includeEcoProfile: Boolean, includeHW: Boolean) = IsAuthenticated{ email => implicit request =>
    //Check whether this user has access to this app
    Async {
      accountByEmail(email).map( acc =>
        if(acc == None || acc.get.apps.filter(_.stringify == appId).size < 1) {
          Forbidden("You are not authorized to view this app details.")
        } else {
          val forDate = new DateTime(date, DateTimeZone.UTC)
          val docId = getDocIDForDate(forDate)

          val appColl = DataFetcherDB.getCollection("gate", appId)
          val query = BSONDocument("_id" -> docId)

          var incVal = 1
          var filter = BSONDocument("_id" -> incVal)
          if(includeVersion)    { filter = filter.add(BSONDocument("v" -> (incVal + 1), "va" -> (incVal + 2))); incVal += 2 }
          if(includeFlow)       { filter = filter.add(BSONDocument("vf" -> (incVal + 1), "vfa" -> (incVal + 2))); incVal += 2 }
          if(includeEcoProfile) { filter = filter.add(BSONDocument("ecoprof" -> (incVal + 1))); incVal += 1 }
          if(includeHW)         { filter = filter.add(BSONDocument("hw" -> (incVal + 1))); incVal += 1 }

          val appMonthFutureDoc = appColl.find(query, filter).one[BSONDocument]

          Async {
            appMonthFutureDoc.map( appMonthDoc => {
              if(appMonthDoc == None)
                Ok(Json.obj("code" -> -1, "message" -> "No data found."))
              else
                Ok(DataFetcherDB.json(appMonthDoc.get)).as("application/json")
            })
          }
        }
      )
    }
  }

  def behaviorAppFlow(appId: String, fromMS: Long, toMS: Long = 0) = getMonthDoc(appId, fromMS, includeVersion = false, includeFlow = true, includeEcoProfile = false, includeHW = true)
  def behaviorProfile(appId: String, date: Long) = getMonthDoc(appId, date, includeVersion = true, includeFlow = false, includeEcoProfile = false, includeHW = true)
  def geo(appId: String, date: Long) = getMonthDoc(appId, date, includeVersion = true, includeFlow = false, includeEcoProfile = false, includeHW = true)
  def ecobalance(appId: String, date: Long) = getMonthDoc(appId, date, includeVersion = true, includeFlow = false, includeEcoProfile = false, includeHW = true)
  def ecoprofile(appId: String, date: Long) = getMonthDoc(appId, date, includeVersion = true, includeFlow = false, includeEcoProfile = true, includeHW = true)
  def ecotrigger(appId: String, date: Long) = getMonthDoc(appId, date, includeVersion = false, includeFlow = false, includeEcoProfile = true, includeHW = true)

  def behaviorFirstSession(appId: String) = IsAuthenticated{ email => implicit request =>
    //Check whether this user has access to this app
    Async {
      accountByEmail(email).map( acc =>
        if(acc == None || acc.get.apps.filter(_.stringify == appId).size < 1) {
          Forbidden("You are not authorized to view this app details.")
        } else {
          val appColl = DataFetcherDB.getCollection("gate", appId)
          val query = BSONDocument("_id" -> "first_session")
          val filter = BSONDocument("_id" -> 1, "v" -> 2)

          val firstSessioFutureDoc = appColl.find(query, filter).one[BSONDocument]

          Async {
            firstSessioFutureDoc.map( firstSessionDoc => {
              if(firstSessionDoc == None)
                Ok(Json.obj("code" -> -1, "message" -> "No data found."))
              else
                Ok(DataFetcherDB.json(firstSessionDoc.get)).as("application/json")
            })
          }
        }
      )
    }
  }

  val supportMessageSendForm = Form(
    tuple(
      "name" -> optional(text),
      "email" -> optional(text),
      "topic" -> text,
      "message" -> text
    )
  )

  def messagessend = Action { implicit request =>
    supportMessageSendForm.bindFromRequest().fold(
      errors => Ok(Json.obj("code" -> -1, "message" -> "Invalid form details..")),
      formDetails => {
        val cookieEmail = request.cookies.get("login_email")
        val cookieToken = request.cookies.get("login_token")
        //TODO Load this from a config file
        val sysAccEmail = "mg-support@moongene.com"

        //If we are logged in, let's send a message from a user
        if (cookieEmail != None && cookieToken != None) {
          EmailService.sendEmail(new EmailMessage(sysAccEmail, cookieEmail.get.value, null, null,
            formDetails._3 + " From: " + formDetails._2.getOrElse("None"), formDetails._4, null))
        } else {
          //We are not logged in, let's send a message from Contact Us view, non-registered users
          EmailService.sendEmail(new EmailMessage(sysAccEmail, sysAccEmail, null, formDetails._2,
            formDetails._3 + " From: " + formDetails._2.getOrElse("None"), formDetails._4, null))
        }

        Ok(Json.obj("code" -> 0, "msg" -> "Success."))
      }
    )
  }

  def segmentFilterValues(appId: String) = IsAuthenticated { email => implicit request => {
    //TODO Check if user has access to this app
    Async {
      getAppUsedValues(appId).map(doc => {
        if(doc != None) {
          Ok(DataFetcherDB.json(doc.get)).as("application/json")
        } else
          Ok(Json.obj("code" -> -1, "msg" -> "Can't get used values for this doc."))
      })
    }
  }}

  def segmentdelete(name: String) = IsAuthenticated { email => implicit request => {
    Async {
      accountByEmail(email).map { maybeAcc =>
        if(maybeAcc != None) {
          val acc = maybeAcc.get
          val curSegments = if(acc.segments == None) List[AccountSegment]() else acc.segments.get.filter(_.name != name)
          accountUpdateSegments(acc, Some(curSegments))

          Ok(Json.obj("code" -> 0))
        } else {
          Ok(Json.obj("code" -> -1, "msg" -> "Can't get user by email."))
        }
      }
    }
  }}

  def segmentsave = IsAuthenticated{ email => implicit request => {
    Async {
      request.body.asJson.map{ json =>
        accountByEmail(email).map { maybeAcc =>
          if(maybeAcc != None) {
            val acc = maybeAcc.get

            val saveSegm = AccountSegment(
              name = (json \ "name").as[String],
              countries = (json \ "countries").as[Option[List[String]]],
              cities = (json \ "cities").as[Option[List[Int]]],
              platform = (json \ "platform").as[Option[List[Int]]],
              platformV = (json \ "platformV").as[Option[List[String]]],
              language = (json \ "language").as[Option[List[String]]],
              vendor = (json \ "vendor").as[Option[List[String]]],
              model = (json \ "model").as[Option[List[String]]],
              carrier = (json \ "carrier").as[Option[List[String]]],
              connection = (json \ "connection").as[Option[List[String]]],
              appversion = (json \ "appversion").as[Option[List[String]]],
              usertype = (json \ "usertype").as[Option[List[String]]],
              trafficsource = (json \ "trafficsource").as[Option[List[String]]],
              resolution = (json \ "resolution").as[Option[List[String]]]
            )

            val curSegments = if(acc.segments == None) List[AccountSegment](saveSegm) else (acc.segments.get.filter(_.name != saveSegm.name) ++ List[AccountSegment](saveSegm))
            accountUpdateSegments(acc, Some(curSegments))

            Ok(Json.obj("code" -> 0))
          } else {
            Ok(Json.obj("code" -> -2, "msg" -> "Can't get user by email."))
          }
        }
      }.getOrElse {
        Future(Ok(Json.obj("code" -> -1, "msg" -> "Can't get user by email.")))
      }
    }
  }}

  def segment = IsAuthenticated{ email => implicit request => {
    Async {
    request.body.asJson.map{ json =>
      //TODO Check if user has access to this app
      val appId = (json \ "appId").as[String]

      appById(appId).map(maybeApp => {
        //TODO Add a check if this failed and it's NONE
        val app = maybeApp.get
        var appTimezone = DateTimeZone.UTC
        try { appTimezone = DateTimeZone.forID(app.timezone) } catch {
          case e: IllegalArgumentException => appTimezone = DateTimeZone.UTC
        }

        val segmQuery = SegmentQuery(
          timezone = appTimezone,
          dateFromMsUTC = (json \ "dateFromMs").as[Long],
          dateToMsUTC = (json \ "dateToMs").as[Long],
          countries = (json \ "countries").asOpt[List[String]],
          resolution = (json \ "resolution").asOpt[List[String]],
          vendor = (json \ "vendor").asOpt[List[String]],
          model = (json \ "model").asOpt[List[String]],
          carrier = (json \ "carrier").asOpt[List[String]],
          platform = (json \ "platform").asOpt[List[Int]],
          platformV = (json \ "platformV").asOpt[List[String]]
        )

        //TODO we need to make caching here and check if some dates were already calculated before
        //Use segmQuery.generateId() to store it's unique combination of values

        Async {
          DataFetcherDB.getDatabase("gate").command(segmQuery.buildAggregateCommand(appId)).map( res => {
            val docs = res.toList
            if(docs.size > 0) {
              Ok(DataFetcherDB.json(docs(0))) //There should be one doc only anyway
            } else {
              Ok(Json.obj("code" -> -1, "msg" -> "No aggregated data document has been created."))
            }
          })
        }
      })

      }.getOrElse {
        Future(Ok(Json.obj("code" -> -1, "msg" -> "Can't transform segment request.")))
      }
    }}
  }

  def retention = IsAuthenticated{ email => implicit request => {
    Async {
      request.body.asJson.map{ json =>

        //TODO Check if user has access to this app
        val appId = (json \ "appId").as[String]

        appById(appId).map(maybeApp => {
          //TODO Add check if this failed and it's NONE
          val app = maybeApp.get
          var appTimezone = DateTimeZone.UTC
          try { appTimezone = DateTimeZone.forID(app.timezone) } catch {
            case e: IllegalArgumentException => appTimezone = DateTimeZone.UTC
          }

          val segmQuery = SegmentQuery(
            timezone = appTimezone,
            dateFromMsUTC = (json \ "dateFromMs").as[Long],
            dateToMsUTC = (json \ "dateToMs").as[Long],
            countries = (json \ "countries").asOpt[List[String]],
            resolution = (json \ "resolution").asOpt[List[String]],
            vendor = (json \ "vendor").asOpt[List[String]],
            model = (json \ "model").asOpt[List[String]],
            carrier = (json \ "carrier").asOpt[List[String]],
            platform = (json \ "platform").asOpt[List[Int]],
            platformV = (json \ "platformV").asOpt[List[String]],
            queryFor = "retention"
          )

          //TODO we need to make caching here and check if some dates were already calculated before
          //Use segmQuery.generateId() to store it's unique combination of values

          Async {
            DataFetcherDB.getDatabase("gate").command(segmQuery.buildAggregateCommand(appId)).map( res => {
              val docs = res.toList
              if(docs.size > 0) {
                Ok(DataFetcherDB.json(docs(0))) //There should be one doc only anyway
              } else {
                Ok(Json.obj("code" -> -1, "msg" -> "No aggregated data document has been created."))
              }
            })
          }
        })


      }.getOrElse {
        Future(Ok(Json.obj("code" -> -1, "msg" -> "Can't transform the request ids.")))
      }
    }}
  }
}