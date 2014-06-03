/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import org.joda.time.DateTime

//Used to track first session events
object FirstSessionEventObj {
  case class FirstSessionEvent(//Device and user info
                               deviceId: String,                //User's device ID as string
                               deviceBinId: Option[Array[Byte]],//User's device ID as byte array
                               version: String,                 //User defined application version
                               auth: Common.SysAuth,            //App authorization data
                               timestamp: DateTime,             //User's timestamp in UTC
                               //From - to event
                               fromState: Common.StateInfo,     //State prior to the event
                               fromEvent: String,               //Event prior to the current event
                               toState: Common.StateInfo,       //Current event state
                               toEvent: String)                 //Current event
}

