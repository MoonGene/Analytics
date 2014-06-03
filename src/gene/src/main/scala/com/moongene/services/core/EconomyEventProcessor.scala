/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import reactivemongo.api.DefaultDB
import com.moongene.models.track.{Common, GeneJsonProtocol, EconomyEventObj}
import reactivemongo.api.collections.default.BSONCollection
import util.{Success, Failure}
import reactivemongo.bson._
import com.moongene.services.Database
import scala.concurrent.Future
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.core.commands.{LastError, GetLastError}
import reactivemongo.api.DefaultDB
import reactivemongo.api.collections.default.BSONCollection
import utility.Base64
import com.moongene.services.Database.Helper
import reactivemongo.bson.Subtype.UuidSubtype
import com.moongene.Core
import com.moongene.models.messages.DBLoad

/*
  Economy Event Processor is responsible for in-app or game purchases.
  See description document for more details of this feature.
*/
trait EconomyEventProcessor extends ExecutionTrait with MetricsHelper {
  import Implicit._

  def processEconomyEvent(db: DefaultDB, ee: EconomyEventObj.EconomyEvent, statsColl: BSONCollection) {
    //Extract the user from DB with this ID, we expect collection to be valid because it is checked on
    //Gene level, into core goes only valid data
    val gameColl = db.collection(ee.sys.auth.appId)

    economyEventUpdateUser(gameColl, ee)
    //economyEventUpdateMauDau(gameColl, ee) <-- This is called inside update User
  }

  def economyEventUpdateUser(coll: BSONCollection, ee: EconomyEventObj.EconomyEvent) = {
    val query = BSONDocument("_id" -> BSONBinary(ee.deviceBinId.get, UuidSubtype))

    val update = BSONDocument(
      "$set" -> BSONDocument(
        Common.getUserEconomyPath + ".pu" -> 1,
        Common.getAllVersionsDayPath(ee.sys.geotime.timestamp) + ".pu" -> 1
      ),
      "$inc" -> BSONDocument(
        Common.getUserEconomyPath + ".p" -> 1,
        Common.getUserEconomyPath + ".a" -> ee.paymentAmount,
        Common.getAllVersionsDayPath(ee.sys.geotime.timestamp) + ".a" -> ee.paymentAmount
      ),
      "$push" -> BSONDocument(
        Common.getUserEconomyPath + ".tr" ->
          BSONDocument(
            "i" -> ee.itemID,
            "ia" -> ee.itemAmount.get,
            "cur" -> ee.paymentCurrency.get,
            "a" -> ee.paymentAmount,
            "c" -> ee.campaignID.get,
            "on" -> BSONDateTime(ee.sys.geotime.timestamp.getMillis)
          )
      )
    )

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    coll.update(query, update, GetLastError(), upsert = true).map({ lastError =>
      if(lastError.ok) {
        //Core.metricsLogger ! DBLoad(cur = -1) cur will be increase just a bit lower in the code, so we ignore this call and make no increment call below

        val queryString = BSONDocument("_id" -> BSONBinary(ee.deviceBinId.get, UuidSubtype),
          Common.getUserEconomyPath + ".p" -> BSONDocument("$lte" -> 3))

        val queryFilter = BSONDocument(
          "_id" -> 1,
          Common.getUserLogSizePath -> 2,
          Common.getUserEconomyPath + ".p" -> 3,
          "d.rd" -> 4
        )

        Core.metricsLogger ! DBLoad(out = 1, cur = 0) //cur should have been increased but we didn't decrease at the top, so we just keep 0 here
        coll.find(queryString, queryFilter).one[BSONDocument].map( userDocMaybe => {
          if (userDocMaybe != None) {
            val userDoc = userDocMaybe.get
            //We need to look whether this user made his first, second or third purchase and if so correspondingly track this
            val purchaseNumber = Helper.getAsByPath[Int](Common.getUserEconomyPath + ".p", userDoc)
            val sessionsCount  = userDoc.getAs[Int](Common.getUserLogSizePath)
            val regDateVal     = Helper.getAsByPath[BSONDateTime]("d.rd", userDoc)

            if(purchaseNumber.isDefined && sessionsCount.isDefined && regDateVal.isDefined) {
              val creationDateBase = new DateTime(regDateVal.get.value)
              val timeSince = ee.sys.geotime.timestamp.minus(creationDateBase.getMillis).getMillis / (1000 * 60 * 60) //Hours

              val pathInDoc = Common.getEcoProfile + ".ts.p" + purchaseNumber.get
              val timeSinceDoc = BSONDocument(
                "$inc" -> BSONDocument(
                  pathInDoc + ".t" -> timeSince.toLong,
                  pathInDoc + ".s" -> sessionsCount.get,
                  pathInDoc + ".c" -> 1,
                  pathInDoc + ".p." + ee.itemID -> 1
                )
              )

              economyEventUpdateMauDau(coll, ee, Some(timeSinceDoc))
            } else
              economyEventUpdateMauDau(coll, ee)
          } else
            economyEventUpdateMauDau(coll, ee) //User is not what we need, we skip him and just update mau dau

          Core.metricsLogger ! DBLoad(cur = -1)
        }).recover {
          case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
        }

      } else {
        Core.metricsLogger ! DBLoad(cur = -1, err = 1)
        economyEventUpdateMauDau(coll, ee)
      }

    }).recover {
      case le: LastError =>  {
        //We still try to update MauDau if user himself failed
        Core.metricsLogger ! DBLoad(cur = -1, err = 1)
        economyEventUpdateMauDau(coll, ee)
      }

      case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }

  }

  def economyEventUpdateMauEx(coll: BSONCollection, see: EconomyEventObj.EconomyEvent, unique: Boolean, ecoProfileDoc: Option[BSONDocument]) = {
    val devPlatformVersion64 = Base64.encodeToString(see.sys.device.version.getBytes, false)
    val devVendor64 = Base64.encodeToString(see.sys.device.vendor.getBytes, false)

    val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(see.sys.geotime.timestamp))
    val curStateId = see.state.stType + ":" + see.state.name

    var aggUpdate = BSONDocument("$inc" -> BSONDocument(
      //Update flow events
      Common.getFlowTimelineAllVersionsPath(curStateId, see.timeline, see.timeOffset) + ".e." + see.itemID + ".h" -> 1L,
      Common.getFlowTimelineVersionPath(see.version, curStateId, see.timeline, see.timeOffset) + ".e." + see.itemID + ".h" -> 1L,

      //Update mau dau stats
      Common.getAllVersionsMonthPath(see.sys.geotime.timestamp) + ".p" -> 1,
      Common.getAllVersionsMonthPath(see.sys.geotime.timestamp) + ".a" -> see.paymentAmount,
      Common.getVersionMonthPath(see.version, see.sys.geotime.timestamp) + ".p" -> 1,
      Common.getVersionMonthPath(see.version, see.sys.geotime.timestamp) + ".a" -> see.paymentAmount,
      Common.getAllVersionsDayPath(see.sys.geotime.timestamp) + ".p" -> 1,
      Common.getAllVersionsDayPath(see.sys.geotime.timestamp) + ".a" -> see.paymentAmount,
      Common.getVersionDayPath(see.version, see.sys.geotime.timestamp) + ".p" -> 1,
      Common.getVersionDayPath(see.version, see.sys.geotime.timestamp) + ".a" -> see.paymentAmount,

      //Update most popular packages
      Common.getAllVersionsMonthPath(see.sys.geotime.timestamp) + ".packages." + see.itemID -> 1,
      //Update campaigns revenue
      Common.getAllVersionsMonthPath(see.sys.geotime.timestamp) + ".campaigns." + see.campaignID.get -> see.paymentAmount,
      //Update geo info for payments
      Common.getGeoPathCountry(see.sys.geotime.timestamp, see.sys.geotime.geoData) + ".a" -> see.paymentAmount,

      //Detecting most and least paying segments
      //Geo data is taken from above info, so we just track the rest
      Common.getEcoProfile + ".p." + see.sys.device.platform + ".a" -> see.paymentAmount,
      Common.getEcoProfile + ".pv." + see.sys.device.platform + "~" + devPlatformVersion64 + ".a" -> see.paymentAmount,
      Common.getEcoProfile + ".v." + devVendor64 + ".a" -> see.paymentAmount
      //TODO Traffic Source is not yet calculated!
      ))

    if (ecoProfileDoc != None)
      aggUpdate = aggUpdate.add(ecoProfileDoc.get) //Economy profile tracked


    //Update Purchase Trigger information
    if(see.preState != None && see.preEvent != None) {
      var cmdDoc = BSONDocument()
      var i = 0
      for( i <- 0 until see.preEvent.get.length){
        val transitionId =
          if (i == see.preEvent.get.length - 1)
            i.toString + ":" + see.preState.get(i) + ":" + see.preEvent.get(i) + "~~::UHVyY2hhc2U=" //UHVyY2hhc2U= is Purchase in base64
          else
            i.toString + ":" + see.preState.get(i) + ":" + see.preEvent.get(i) + "~~" + (i + 1).toString + ":" + see.preState.get(i + 1) + ":" + see.preEvent.get(i + 1)

        cmdDoc = cmdDoc.add( Common.getEcoProfile + ".pt." + transitionId -> 1L)
      }
      aggUpdate = aggUpdate.add(BSONDocument("$inc" -> cmdDoc))
    }

    if(unique) {
      aggUpdate = aggUpdate.add(BSONDocument("$inc" -> BSONDocument(
        Common.getAllVersionsMonthPath(see.sys.geotime.timestamp) + ".pu" -> 1,
        Common.getVersionMonthPath(see.version, see.sys.geotime.timestamp) + ".pu" -> 1,
        Common.getGeoPathCountry(see.sys.geotime.timestamp, see.sys.geotime.geoData) + ".pu" -> 1,
        Common.getEcoProfile + ".p." + see.sys.device.platform + ".pu" -> 1,
        Common.getEcoProfile + ".pv." + see.sys.device.platform + "~" + devPlatformVersion64 + ".pu" -> 1, //Platform version, e.g. 2.3.5 p GingerBread,6.0 iOS etc.
        Common.getEcoProfile + ".v." + devVendor64 + ".pu" -> 1
      )))
    }

    dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
  }

  def economyEventUpdateMauDau(coll: BSONCollection, see: EconomyEventObj.EconomyEvent, ecoProfileDoc: Option[BSONDocument] = None) = {
    //Update month doc for dau and mau info
    //Update flow doc to display where event happened

    //TODO use bsonize function to find out object size in mongo: Object.bsonsize( db.foo.findOne( { x : 1 } ) )
    //we need to ensure that we are safe with 16MB json doc limit
    val docMonthId = Common.getYearMonthID(see.sys.geotime.timestamp) + ":p:" + see.deviceId.takeRight(2)

    val queryMonth = BSONDocument(
      "_id" -> docMonthId,
      "u" -> BSONDocument("$ne" -> BSONBinary(see.deviceBinId.get, UuidSubtype)))

    val updateMonth = BSONDocument(
      "$addToSet" -> BSONDocument(
        "u" -> BSONBinary(see.deviceBinId.get, UuidSubtype)
      ),
      "$inc" -> BSONDocument(
        "c" -> 1
      )
    )

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    coll.update(queryMonth, updateMonth, GetLastError(), upsert = true).map({ lastError => {
      Core.metricsLogger ! DBLoad(cur = -1, err = if (lastError.ok) 0 else 1)
      economyEventUpdateMauEx(coll, see, unique = true, ecoProfileDoc)
    }}).recover {
      case le: LastError =>  {
        //Query failed, probably not a unique user, let's just update sessions counter
        Core.metricsLogger ! DBLoad(cur = -1)
        economyEventUpdateMauEx(coll, see, unique = false, ecoProfileDoc)
      }

      case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }
  }
}
