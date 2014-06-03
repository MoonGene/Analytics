/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import org.joda.time.DateTime

object StateEventObj {
  case class StateEvent(//Device and user info
                        deviceId: String,                  //User's device ID as string
                        deviceBinId: Option[Array[Byte]],  //User's device ID as byte array
                        version: String,                   //User defined application version
                        auth: Common.SysAuth,              //App authorization data
                        timestamp: DateTime,               //User's timestamp in UTC
                        //Where event happened
                        state: Common.StateInfo,           //User defined state
                        timeline: String,                  //User defined timeline ID/Name
                        timeOffset: Int,                   //Offset in seconds on the timeline
                        //Event info
                        event: String,                     //User defined event ID/Name
                        data1: Option[String],             //User defined optional Data
                        data2: Option[String])             //User defined optional Data
}

