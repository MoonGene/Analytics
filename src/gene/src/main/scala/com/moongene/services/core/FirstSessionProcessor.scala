/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import com.moongene.models.track.{Common, FirstSessionEventObj}
import reactivemongo.api.DefaultDB
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.bson.BSONDocument
import reactivemongo.core.commands.GetLastError
import com.moongene.Core
import com.moongene.models.messages.DBLoad

/*
  First Session Processor is responsible for tracking only first session events in an app or a game.
  A flow is built using those events that can later be analysed for blockers and other issues.
*/
trait FirstSessionProcessor extends ExecutionTrait {
  import Implicit._

  def processFirstSessionEvent(db: DefaultDB, fse: FirstSessionEventObj.FirstSessionEvent, statsColl: BSONCollection) {
    //Extract the user from DB with this ID, we expect collection to be valid because it is checked on
    //the Gene Node level, into Core goes only valid data
    val gameColl = db.collection(fse.auth.appId)

    stateEventUpdateFirstSessionFlow(gameColl, fse)
  }

  def stateEventUpdateFirstSessionFlow(coll: BSONCollection, fse: FirstSessionEventObj.FirstSessionEvent) = {
    //Update aggregated document that will just have stats but not users list
    val aggQuery = BSONDocument("_id" -> Common.getFirstSessionID)

    val transitionId = fse.fromState.stType + ":" + fse.fromState.name + ":" + fse.fromEvent + "." + fse.toState.stType + ":" + fse.toState.name + ":" + fse.toEvent

    val aggUpdate = BSONDocument("$inc" -> BSONDocument(
      "v." + fse.version + "." + transitionId -> 1L
    ))

    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    coll.update(aggQuery, aggUpdate, GetLastError(), upsert = true).map({ lastError =>
      Core.metricsLogger ! DBLoad(cur = -1, err = if (lastError.ok) 0 else 1)
    }).recover {
      case _ => Core.metricsLogger ! DBLoad(cur = -1, err = 1)
    }
  }
}

