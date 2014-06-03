/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import org.joda.time.DateTime

object StateChangeObj {
  case class StateChange( deviceId: String,                  //User's device ID as string
                          deviceBinId: Option[Array[Byte]],  //User's device ID as byte array
                          version: String,                   //User defined application version
                          auth: Common.SysAuth,              //App authorization data
                          timestamp: DateTime,               //User's timestamp in UTC
                          newState: Common.StateInfo,        //User defined new state that the app is switching to
                          oldState: Common.StateInfo)        //User defined previous state
}

