/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import reactivemongo.api.DefaultDB
import com.moongene.models.track.{StateEventObj, Common}
import reactivemongo.api.collections.default.BSONCollection
import util.{Success, Failure}
import reactivemongo.bson.{BSONValue, BSONDocument, BSONInteger, BSONArray}
import com.moongene.services.Database
import scala.concurrent.Future
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.core.commands.GetLastError
import com.moongene.Core
import com.moongene.models.messages.DBLoad

/*
  State Event Processor is responsible for tracking events that happen in an app or game.
  Please notice that economy(in-app purchase) events are tracked by EconomyEventProcessor
*/
trait StateEventProcessor extends ExecutionTrait with MetricsHelper {
  import Implicit._

  def processStateEvent(db: DefaultDB, seo: StateEventObj.StateEvent, statsColl: BSONCollection) {
    //Extract the user from DB with this ID, we expect collection to be valid because it is checked on
    //the Gene Node level, into Core goes only valid data
    val gameColl = db.collection(seo.auth.appId)

    stateEventUpdateUser(gameColl, seo)
    stateEventUpdateFlow(gameColl, seo)
  }

  def stateEventUpdateUser(coll: BSONCollection, seo: StateEventObj.StateEvent) = {
    //TODO Consider tracking also user activity in his own document for further individual analysis of
    //user's activity
  }

  def stateEventUpdateFlow(coll: BSONCollection, seo: StateEventObj.StateEvent) = {
    //Update aggregated document that will just have stats but not users list
    val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(seo.timestamp))
    val curStateId = seo.state.stType + ":" + seo.state.name

    val aggUpdate = BSONDocument("$inc" -> BSONDocument(
        //Update flow events
        Common.getFlowTimelineAllVersionsPath(curStateId, seo.timeline, seo.timeOffset) + ".v." + seo.event + ".d1." + seo.data1.get -> 1L,
        Common.getFlowTimelineAllVersionsPath(curStateId, seo.timeline, seo.timeOffset) + ".v." + seo.event + ".d2." + seo.data2.get -> 1L,
        Common.getFlowTimelineVersionPath(seo.version, curStateId, seo.timeline, seo.timeOffset) + ".v." + seo.event + ".d1." + seo.data1.get -> 1L,
        Common.getFlowTimelineVersionPath(seo.version, curStateId, seo.timeline, seo.timeOffset) + ".v." + seo.event + ".d2." + seo.data2.get -> 1L
      ))


    dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
  }
}
