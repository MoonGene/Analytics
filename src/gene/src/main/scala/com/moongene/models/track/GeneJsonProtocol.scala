/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import spray.json._
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.bson.BSONBinary
import reactivemongo.bson.Subtype.UuidSubtype

//Implicit objects conversion
object GeneJsonProtocol extends DefaultJsonProtocol {
  implicit object DateTimeJsonFormat extends RootJsonFormat[DateTime] {
    def write(d: DateTime) = JsNumber(d.getMillis)
    def read(v: JsValue) =  {
        val millis = v.convertTo[Long]
        new DateTime(millis, DateTimeZone.UTC)
    }
  }

  implicit val impGeoUnitStr = jsonFormat2(Common.GeoUnit[String])
  implicit val impGeoUnitInt = jsonFormat2(Common.GeoUnit[Int])
  implicit val impIPGeoData = jsonFormat4(Common.IPGeoData)
  implicit val impStateInfo = jsonFormat3(Common.StateInfo)

  implicit val impCommonObjSysAuth = jsonFormat2(Common.SysAuth)
  implicit val impCommonObjSysGeoTime = jsonFormat3(Common.SysGeoTime)
  implicit val impCommonObjSysDevice = jsonFormat9(Common.SysDevice)
  implicit val impCommonObjSys = jsonFormat3(Common.Sys)
  implicit val impStartObjStart = jsonFormat4(StartObj.Start)

  implicit val impExitObjExit = jsonFormat8(ExitObj.Exit)

  implicit val impStateChangeObjStateChange = jsonFormat7(StateChangeObj.StateChange)
  implicit val impStateEventObjStateEvent = jsonFormat11(StateEventObj.StateEvent)
  implicit val impEconomyEventObjEconomyEvent = jsonFormat14(EconomyEventObj.EconomyEvent)
  implicit val impEconomyBalanceObjBalanceItem = jsonFormat3(EconomyBalanceObj.BalanceItem)
  implicit val impEconomyBalanceObjEconomyBalance = jsonFormat6(EconomyBalanceObj.EconomyBalance)
  implicit val impFirstSessionEventObjFirstSessionEvent = jsonFormat9(FirstSessionEventObj.FirstSessionEvent)
}