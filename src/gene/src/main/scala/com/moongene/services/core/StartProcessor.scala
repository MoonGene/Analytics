/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import reactivemongo.api.DefaultDB
import com.moongene.models.track.{Common, StartObj}
import reactivemongo.api.collections.default.BSONCollection
import util.{Success, Failure}
import reactivemongo.bson._
import com.moongene.services.Database
import scala.concurrent.Future
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.core.commands.{LastError, GetLastError}
import akka.actor.IO.Iteratee
import collection.mutable
import reactivemongo.api.DefaultDB
import reactivemongo.core.commands.GetLastError
import reactivemongo.api.collections.default.BSONCollection

import reactivemongo.bson.{BSONBinary, BSONDateTime, BSONDocument}
import utility.{Base64, UUIDHelper}
import reactivemongo.bson.Subtype.UuidSubtype
import com.moongene.Core
import com.moongene.models.messages.DBLoad

/*
  Start Processor is the most heavy processor, it tracks new users,
  geo data, retention, hardware information, etc.
*/
trait StartProcessor extends ExecutionTrait with MetricsHelper {
  import Implicit._

  def processStart(db: DefaultDB, so: StartObj.Start, statsColl: BSONCollection) {
    //Extract the user from DB with this ID, we expect collection to be valid because it is checked on
    //the Gene Node level, into core goes only valid data
    val gameColl = db.collection(so.sys.auth.appId)

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    startUpdateUser(gameColl, so).map({ lastError => {
      Core.metricsLogger ! DBLoad(cur = -1, err = if (lastError.ok) 0 else 1)
      //We execute platform update ONLY after main execution is done to ensure that element exists that we are
      //trying to add platform info to
      //TODO Consider just adding upsert to this platform update
      if (lastError.ok) {
        startUpdateUserPlatform(gameColl, so)
        startUpdateRetention(gameColl, so)
      }
    }
    }).recover {
      case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }

    startUpdateMauDau(gameColl, so)
  }

  def startUpdateUserPlatform(coll: BSONCollection, so: StartObj.Start) = {
    val query = BSONDocument(
      "_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype),
      "d" -> BSONDocument("$exists" -> false))

    val update = BSONDocument(
      "$set" -> BSONDocument(
        "d" -> createUserPlatformDetails(so),
        Common.getAllVersionsDayPath(so.sys.geotime.timestamp) + ".rg" -> 1 //Mark also the day that we registered on
      )
    )

    dbCallMetric(coll.update(query, update), lastErrorCheck = false)
    startUpdateUsedValues(coll, so)
  }

  def startUpdateUsedValues(coll: BSONCollection, so: StartObj.Start) = {
    //Also put all those values to common details list, we will from there see countries, devices, vendors, etc.
    val query = BSONDocument("_id" -> Common.getUsedValuesDoc)
    var update = BSONDocument(
      "$addToSet" -> BSONDocument(
        "user.version" -> so.version,
        "device.screen" -> (so.sys.device.screen_w + "x" + so.sys.device.screen_h), //Screen resolution
        "device.vendor"   -> so.sys.device.vendor,  //Vendor, e.g. Samsung, etc.
        //Replace reserved symbols in MongoDB with alternative signs
        ("device.vendor_models." + so.sys.device.vendor.replace(".", "~~").replace("$", "~~~")) -> so.sys.device.model, //Model, e.g. Samsung Galaxy S3, etc.
        "device.carrier"  -> so.sys.device.carrier, //Carrier, e.g. Rogers, Telus, T-Mobile, AT&T, etc.
        "device.platform" -> so.sys.device.platform,//Platform, 0 - unknown, 1 - Android, 2 - iOS, 3 - Windows Phone
        //Replace reserved symbols in MongoDB with alternative signs
        ("device.platform_v." + so.sys.device.platform.toString.replace(".", "~~").replace("$", "~~~")) -> so.sys.device.version  //Platform version, e.g. 2.3.5 p GingerBread,6.0 iOS etc.
      )
    )

    if(so.sys.geotime.geoData != None)
      update = update.add(BSONDocument(
        "$addToSet" -> BSONDocument(
          "device.country" -> BSONDocument(
            "c" -> so.sys.geotime.geoData.get.country.code,
            "n" -> so.sys.geotime.geoData.get.country.name
          ),
          "device.region" -> BSONDocument(
            "c" -> so.sys.geotime.geoData.get.division.code,
            "n" -> so.sys.geotime.geoData.get.division.name,
            "p" -> so.sys.geotime.geoData.get.country.code
          ),
          "device.city" -> BSONDocument(
            "c" -> so.sys.geotime.geoData.get.city.code,
            "n" -> so.sys.geotime.geoData.get.city.name,
            "d" -> so.sys.geotime.geoData.get.division.code,  //Sub Division, e.g. province, state, etc.
            "p" -> so.sys.geotime.geoData.get.country.code
          )
        )
      ))

    dbCallMetric(coll.update(query, update, GetLastError(), upsert = true), recoverCheck = false)
  }

  def createUserPlatformDetails(so: StartObj.Start) = {
      var doc = BSONDocument(                                         //Device & Hardware details
        "s" -> so.sys.device.screen.toDouble,                         //Screen diagonal
        "r"-> (so.sys.device.screen_w + "x" + so.sys.device.screen_h),//Resolution
        "sw"-> so.sys.device.screen_w,                                //Screen width
        "sh"-> so.sys.device.screen_h,                                //Screen height
        "v" -> so.sys.device.vendor,                                  //Vendor, e.g. Samsung, etc.
        "m" -> so.sys.device.model,                                   //Model, e.g. Samsung Galaxy S3, etc.
        "l" -> so.sys.device.locale,                                  //Locale, e.g. en_US, etc.
        "c" -> so.sys.device.carrier,                                 //Carrier, e.g. Rogers, Telus, T-Mobile, AT&T, etc.
        "p" -> so.sys.device.platform,                                //Platform, 0 - unknown, 1 - Android, 2 - iOS, 3 - Windows Phone
        "pv"-> (so.sys.device.platform + "~" + so.sys.device.version),//Platform version, e.g. 2.3.5 p GingerBread,6.0 iOS etc.
        "rd" -> BSONDateTime(so.sys.geotime.timestamp.getMillis)      //Registration date
      )

      if(so.sys.geotime.ip != None)
        doc = doc.add(BSONDocument("i" -> so.sys.geotime.ip.get))

      if(so.sys.geotime.geoData != None)
        doc = doc.add(BSONDocument(
          "gy" -> so.sys.geotime.geoData.get.country.code,            //Country ID
          "gd" -> so.sys.geotime.geoData.get.division.code,           //Subdivion ID
          "gi" -> so.sys.geotime.geoData.get.city.code                //City ID
        ))

      doc
  }

  def startUpdateUser(coll: BSONCollection, so: StartObj.Start) = {
    //For user we don't track his version, otherwise we won't be able to aggregate
    val incrementDayPath = Common.getAllVersionsDayPath(so.sys.geotime.timestamp) + ".s"
    val incrementMonthPath = Common.getAllVersionsMonthPath(so.sys.geotime.timestamp) + ".s"

    val query = BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype))
    val update = BSONDocument(
      "$inc" -> BSONDocument(
        incrementDayPath -> 1L,
        incrementMonthPath -> 1L,
        Common.getUserLogSizePath -> 1),
      "$push" -> BSONDocument(
        Common.getUserLogPath -> BSONDateTime(so.sys.geotime.timestamp.withMillisOfDay(0).getMillis)
      ))

    coll.update(query, update, GetLastError(), upsert = true) //There is a callmetric wrap on a higher level, so we don't do anything here to log system load
  }

  def startUpdateRetention(coll: BSONCollection, so: StartObj.Start) {
    // Update user retention, here we check the dates for
    // 0[This one we don't need as this is a query date], 1, 3, 6, 13, 27 days since registration

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    coll.find(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)),
              BSONDocument(
                "_id" -> 1,
                Common.getUserLogPath -> BSONDocument("$slice" -> 1))
    ).one[BSONDocument].map( userDocMaybe => {
      Core.metricsLogger ! DBLoad(cur = -1)

      if (userDocMaybe != None) {
        val userDoc = userDocMaybe.get
        val logArray = userDoc.getAs[BSONArray](Common.getUserLogPath).get
        if (logArray.length > 0) {
          val creationDateBase = new DateTime(logArray.getAs[BSONDateTime](0).get.value) //TODO Check whether we need to provide timezone here

          val retentionPath = Common.getUserRetentionPath(creationDateBase)
          val todayDateBase = so.sys.geotime.timestamp.withMillisOfDay(0)

          //TODO Optimize this, should be just days value calculated and then we compare with days num, now we do over calculations
          if(todayDateBase == creationDateBase) {
            dbCallMetric(coll.update(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)), BSONDocument( "$set" -> BSONDocument( retentionPath + ".d0" -> 1 ))))
          } else
          if(todayDateBase.minusDays(1) == creationDateBase) {
            dbCallMetric(coll.update(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)), BSONDocument( "$set" -> BSONDocument( retentionPath + ".d1" -> 1 ))))
          } else
          if(todayDateBase.minusDays(3) == creationDateBase) {
            dbCallMetric(coll.update(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)), BSONDocument( "$set" -> BSONDocument( retentionPath + ".d3" -> 1 ))))
          } else
          if(todayDateBase.minusDays(6) == creationDateBase) {
            dbCallMetric(coll.update(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)), BSONDocument( "$set" -> BSONDocument( retentionPath + ".d6" -> 1 ))))
          } else
          if(todayDateBase.minusDays(13) == creationDateBase) {
            dbCallMetric(coll.update(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)), BSONDocument( "$set" -> BSONDocument( retentionPath + ".d13" -> 1 ))))
          } else
          if(todayDateBase.minusDays(27) == creationDateBase) {
            dbCallMetric(coll.update(BSONDocument("_id" -> BSONBinary(so.deviceBinId.get, UuidSubtype)), BSONDocument( "$set" -> BSONDocument( retentionPath + ".d27" -> 1 ))))
          }
        }
      }
    }).recover {
      case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }
  }

  def startUpdateDauEx(coll: BSONCollection, so: StartObj.Start, unique: Boolean) = {
    if(unique) {
      val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(so.sys.geotime.timestamp))
      val aggUpdate = BSONDocument("$inc" -> BSONDocument(
        Common.getAllVersionsDayPath(so.sys.geotime.timestamp) + ".c" -> 1,
        Common.getAllVersionsDayPath(so.sys.geotime.timestamp) + ".s" -> 1L,
        Common.getVersionDayPath(so.version, so.sys.geotime.timestamp) + ".c" -> 1,
        Common.getVersionDayPath(so.version, so.sys.geotime.timestamp) + ".s" -> 1L
        ))
      dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
    } else {
      val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(so.sys.geotime.timestamp))
      val aggUpdate = BSONDocument("$inc" -> BSONDocument(
        Common.getAllVersionsDayPath(so.sys.geotime.timestamp) + ".s" -> 1L,
        Common.getVersionDayPath(so.version, so.sys.geotime.timestamp) + ".s" -> 1L
        ))
      dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
    }
  }

  def startUpdateMauEx(coll: BSONCollection, so: StartObj.Start, unique: Boolean) = {
    val versionMonthPath = Common.getVersionMonthPath(so.version, so.sys.geotime.timestamp)

    if(unique) {
      val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(so.sys.geotime.timestamp))
      val aggUpdate = BSONDocument("$inc" -> BSONDocument(
        Common.getAllVersionsMonthPath(so.sys.geotime.timestamp) + ".c" -> 1,
        Common.getAllVersionsMonthPath(so.sys.geotime.timestamp) + ".s" -> 1L,
        versionMonthPath + ".c" -> 1,
        versionMonthPath + ".s" -> 1L,
        //Geo Data
        Common.getGeoPathCountry(so.sys.geotime.timestamp, so.sys.geotime.geoData) + ".c" -> 1,
        Common.getGeoPathCountry(so.sys.geotime.timestamp, so.sys.geotime.geoData) + ".s" -> 1L,
        //Device Data
        Common.getHardwarePath + ".hw." + so.sys.device.platform + "-" + Base64.encodeToString(so.sys.device.vendor.getBytes, false) + "." + Base64.encodeToString(so.sys.device.model.getBytes, false) -> 1,
        Common.getHardwarePath + ".os." + so.sys.device.platform + "." + Base64.encodeToString(so.sys.device.version.getBytes, false) -> 1
        ))
      dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
    } else {
      val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(so.sys.geotime.timestamp))
      val aggUpdate = BSONDocument("$inc" -> BSONDocument(
        Common.getAllVersionsMonthPath(so.sys.geotime.timestamp) + ".s" -> 1L,
        versionMonthPath + ".s" -> 1L,
        Common.getGeoPathCountry(so.sys.geotime.timestamp, so.sys.geotime.geoData) + ".s" -> 1L
        ))
      dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
    }
  }

  def startUpdateMauDau(coll: BSONCollection, so: StartObj.Start) = {
    //Update month details
    //TODO use bsonize function to find out object size in mongo: Object.bsonsize( db.foo.findOne( { x : 1 } ) )
    //we need to ensure that we are safe with 16MB json doc limit
    val docMonthId = Common.getYearMonthID(so.sys.geotime.timestamp) + ":" + so.deviceId.takeRight(2)

    val queryMonth = BSONDocument(
      "_id" -> docMonthId,
      "u" -> BSONDocument("$ne" -> BSONBinary(so.deviceBinId.get, UuidSubtype)))

    val updateMonth = BSONDocument(
      "$addToSet" -> BSONDocument(
        "u" -> BSONBinary(so.deviceBinId.get, UuidSubtype)
      ),
      "$inc" -> BSONDocument(
        "c" -> 1
      )
    )

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    coll.update(queryMonth, updateMonth, GetLastError(), upsert = true).map({ lastError =>
      Core.metricsLogger ! DBLoad(cur = -1)
      //Query succeeded, also updated aggregated document that will just have stats but not users list
      startUpdateMauEx(coll, so, unique = true)
    }).recover {
      case le: LastError =>  {
        //Query failed, probably not a unique user, let's just update sessions counter
        Core.metricsLogger ! DBLoad(cur = -1)
        startUpdateMauEx(coll, so, unique = false)
      }

      case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }

    //Update day details
    val docId = Common.getYearMonthDayID(so.sys.geotime.timestamp) + ":" + so.deviceId.takeRight(2)

    val query = BSONDocument(
      "_id" -> docId,
      "u" -> BSONDocument("$ne" -> BSONBinary(so.deviceBinId.get, UuidSubtype)))

    val update = BSONDocument(
      "$addToSet" -> BSONDocument(
        "u" -> BSONBinary(so.deviceBinId.get, UuidSubtype)
      ),
      "$inc" -> BSONDocument(
        "c" -> 1
      )
    )

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    coll.update(query, update, GetLastError(), upsert = true).map({ lastError =>
        Core.metricsLogger ! DBLoad(cur = -1)
        //Query succeeded, also updated aggregated document that will just have stats but not users list
        startUpdateDauEx(coll, so, unique = true)
      }).recover {
        case le: LastError =>  {
          //Query failed, probably not a unique user, let's just update sessions counter
          Core.metricsLogger ! DBLoad(cur = -1)
          startUpdateDauEx(coll, so, unique = false)
        }

        case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }
  }
}
