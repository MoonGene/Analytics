/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.sys

import org.joda.time.DateTimeZone

//Used by AppsVault - a service to detect new apps and notify nodes about changes
object SysAppsVault {
  sealed trait SysAppsVaultMsg
  case class SelfUpdateAllApps() extends SysAppsVaultMsg
  case class SelfCheckUpdateDoc() extends SysAppsVaultMsg
  case class AppVaultDetails(token: String, timezoneStr: String, timezone: DateTimeZone)
  case class GetApps() extends SysAppsVaultMsg
  case class AllAppsMap(map: Map[String, AppVaultDetails]) extends SysAppsVaultMsg
  case class NewApp(id: String, details: AppVaultDetails) extends SysAppsVaultMsg
  case class UpdateApp(id: String, details: AppVaultDetails) extends SysAppsVaultMsg
  case class DelApp(id: String) extends SysAppsVaultMsg
}
