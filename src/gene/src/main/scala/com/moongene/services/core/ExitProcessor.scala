/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import reactivemongo.api.DefaultDB
import com.moongene.models.track.{Common, ExitObj, StartObj}
import reactivemongo.api.collections.default.BSONCollection
import util.{Success, Failure}
import reactivemongo.bson._
import com.moongene.services.Database
import scala.concurrent.Future
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.core.commands.GetLastError
import reactivemongo.api.DefaultDB
import reactivemongo.core.commands.GetLastError
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.bson.Subtype.UuidSubtype
import com.moongene.Core
import com.moongene.models.messages.DBLoad

/*
  Exit Processor is responsible for tracking end of session in an app or a game.
  Here we track session length primarily.
*/
trait ExitProcessor extends ExecutionTrait with MetricsHelper {
  import Implicit._

  def processExit(db: DefaultDB, eo: ExitObj.Exit, statsColl: BSONCollection) {
    //Extract the user from DB with this ID, we expect collection to be valid because it is checked on
    //Gene Node level, into Core goes only valid data
    val gameColl = db.collection(eo.auth.appId)

    exitUpdateUser(gameColl, eo)
    exitUpdateMauDau(gameColl, eo)
  }

  def exitUpdateUser(coll: BSONCollection, eo: ExitObj.Exit) = {
    val incrementDayPath = Common.getAllVersionsDayPath(eo.timestamp) + ".l"
    val incrementMonthPath = Common.getAllVersionsMonthPath(eo.timestamp) + ".l"

    val query = BSONDocument("_id" -> BSONBinary(eo.deviceBinId.get, UuidSubtype))
    val update = BSONDocument("$inc" -> BSONDocument(
      incrementDayPath -> eo.sessionLength,
      incrementMonthPath -> eo.sessionLength))

    dbCallMetric(coll.update(query, update, GetLastError(), upsert = true))
  }

  def exitUpdateMauDau(coll: BSONCollection, eo: ExitObj.Exit) = {
    //Update aggregated document that will just have stats but not users list
    val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(eo.timestamp))
    val aggUpdate = BSONDocument("$inc" -> BSONDocument(
      Common.getAllVersionsMonthPath(eo.timestamp) + ".l" -> eo.sessionLength,
      Common.getVersionMonthPath(eo.version, eo.timestamp) + ".l" -> eo.sessionLength,
      Common.getAllVersionsDayPath(eo.timestamp) + ".l" -> eo.sessionLength,
      Common.getVersionDayPath(eo.version, eo.timestamp) + ".l" -> eo.sessionLength,
      Common.getGeoPathCountry(eo.timestamp, eo.geoData) + ".l" -> eo.sessionLength
      ))

    dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
  }
}
