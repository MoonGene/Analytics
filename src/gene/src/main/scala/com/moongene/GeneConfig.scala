/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene

import com.typesafe.config.ConfigFactory

object GeneConfig {
  val config = ConfigFactory.load()
  val serverPort = config.getInt("gene.server.port")
  val serverHost = config.getString("gene.server.host")
}