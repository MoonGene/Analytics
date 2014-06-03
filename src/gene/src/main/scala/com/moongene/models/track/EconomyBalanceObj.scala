/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import org.joda.time.DateTime
import reactivemongo.bson.BSONBinary

object EconomyBalanceObj {
  case class BalanceItem(   id: String,                       //User defined item ID
                            amount: Long,                     //Amount of items of type ID
                            timeline: Int)                    //Timeline position

  case class EconomyBalance(deviceId: String,                 //User's device ID as string
                            deviceBinId: Option[Array[Byte]], //User's device ID as byte array
                            version: String,                  //User defined application version
                            auth: Common.SysAuth,             //App authorization data
                            timestamp: DateTime,              //User's timestamp in UTC
                            balance: List[BalanceItem])       //List of items with balance details
}
