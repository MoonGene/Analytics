/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import reactivemongo.api.DefaultDB
import com.moongene.models.track.{Common, StateChangeObj}
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
  State Change Processor keeps track of app or game transitions.
*/
trait StateChangeProcessor extends ExecutionTrait with MetricsHelper {
  import Implicit._

  def processStateChange(db: DefaultDB, sco: StateChangeObj.StateChange, statsColl: BSONCollection) {
    //Extract the user from DB with this ID, we expect collection to be valid because it is checked on
    //the Gene Node level, into Core goes only valid data
    val gameColl = db.collection(sco.auth.appId)

    stateChangeUpdateUser(gameColl, sco)
    stateChangeUpdateFlow(gameColl, sco)
  }

  def stateChangeUpdateUser(coll: BSONCollection, sco: StateChangeObj.StateChange) = {
    //TODO Consider tracking also user activity in his own document for further individual analysis of
    //user's activity
  }

  def stateChangeUpdateFlow(coll: BSONCollection, sco: StateChangeObj.StateChange) = {
    //Update aggregated document that will just have stats but not users list
    val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(sco.timestamp))
    val newStateId = sco.newState.stType + ":" + sco.newState.name
    val oldStateId = sco.oldState.stType + ":" + sco.oldState.name

    //This can also be sorted to make sure we have just one transition
    //val transitionId = if(newStateId < oldStateId) newStateId + "~~" + oldStateId else oldStateId + "~~" + newStateId
    //but for now we want to track both directions
    val transitionId = oldStateId + "~~" + newStateId
    var aggUpdate = BSONDocument("$inc" -> BSONDocument(
      //Update with hits the new version
      Common.getFlowStatesAllVersionsPath + "." + newStateId + ".h" -> 1L,
      Common.getFlowStatesVersionPath(sco.version) + "." + newStateId + ".h" -> 1L,
      //Update the transition as well with hit
      Common.getFlowTransitionsAllVersionsPath + "." + transitionId + ".h" -> 1L,
      Common.getFlowTransitionsVersionPath(sco.version) + "." + transitionId + ".h" -> 1L
      ))

    if (sco.oldState.duration != None) {
      aggUpdate = aggUpdate.add("$inc" -> BSONDocument(
        //Update time spent on the previous state
        Common.getFlowStatesAllVersionsPath + "." + oldStateId + ".t" -> sco.oldState.duration.get,
        Common.getFlowStatesVersionPath(sco.version) + "." + oldStateId + ".t" -> sco.oldState.duration.get
      ))
    }

    dbCallMetric(coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
  }
}
