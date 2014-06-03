/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

object StartObj {
  case class Start(deviceId: String,                  //User's device ID as string
                   deviceBinId: Option[Array[Byte]],  //User's device ID as byte array
                   version: String,                   //User defined application versions
                   sys: Common.Sys)                   //User's device, app authorization and geotime data
}

