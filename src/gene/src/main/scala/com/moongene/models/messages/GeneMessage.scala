/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */
package com.moongene.models.messages

sealed trait SysMessage
object SysMetricsLog extends SysMessage

case class SysLoad(in: Int = 0, out: Int = 0, cur: Int = 0) extends SysMessage
case class DBLoad(out: Int = 0, cur: Int = 0, err: Int = 0) extends SysMessage
