/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import org.joda.time.DateTime

object ExitObj {
  case class Exit( deviceId: String,                  //User's device ID as string
                   deviceBinId: Option[Array[Byte]],  //User's device ID as byte array
                   version: String,                   //User defined application version
                   sessionLength: Long,               //Session length in seconds
                   timestamp: DateTime,               //User's timestamp in UTC
                   auth: Common.SysAuth,              //App authorization information
                   ip: Option[String],                //User's IP address
                   geoData: Option[Common.IPGeoData]) //User's geo data based on IP
}
