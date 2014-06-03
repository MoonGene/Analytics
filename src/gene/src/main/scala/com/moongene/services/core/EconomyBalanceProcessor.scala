/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import reactivemongo.api.DefaultDB
import com.moongene.models.track.{EconomyBalanceObj, Common, GeneJsonProtocol, EconomyEventObj}
import reactivemongo.api.collections.default.BSONCollection
import util.{Success, Failure}
import reactivemongo.bson._
import com.moongene.services.Database
import scala.concurrent.Future
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.core.commands.{LastError, GetLastError}
import reactivemongo.api.DefaultDB
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.api.DefaultDB
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.bson.BSONInteger
import com.moongene.models.messages.DBLoad
import com.moongene.Core


/*
  Economy Balance Processor is responsible for in-app or game economy tracking.
  See description document for more details of this feature.
*/
trait EconomyBalanceProcessor extends ExecutionTrait with MetricsHelper {
  import Implicit._

  def processEconomyBalance(db: DefaultDB, eb: EconomyBalanceObj.EconomyBalance, statsColl: BSONCollection) {
    val gameColl = db.collection(eb.auth.appId)

    val aggQuery = BSONDocument("_id" -> Common.getYearMonthID(eb.timestamp))
    val balanceDayPath = Common.getMonthDayEconomyBalancePath(eb.timestamp)
    val balanceMonthPath = Common.getMonthEconomyBalancePath(eb.timestamp)
    val balances = scala.collection.mutable.ListBuffer.empty[(String, BSONValue)]
    eb.balance.foreach( b => {
      balances += ((balanceDayPath + "." + b.id) -> BSONLong(b.amount))
      balances += ((balanceDayPath + ".c." + b.id) -> BSONLong(1))
      balances += ((balanceMonthPath + "." + b.id + "." + b.timeline) -> BSONLong(b.amount))
      balances += ((balanceMonthPath + "." + b.id + ".c." + b.timeline) -> BSONLong(1))
      })

    val aggUpdate = BSONDocument("$inc" -> BSONDocument(balances.toList))

    dbCallMetric(gameColl.update(aggQuery, aggUpdate, GetLastError(), upsert = true))
  }
}
