/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.track

import org.joda.time.DateTime

object Common {

  case class SysAuth(   appId: String,                //Application ID
                        appToken: String)             //Application authorization token

  case class SysDevice( screen: Double,               //Screensize in inches
                        screen_h: Int,                //Screen height in pixels
                        screen_w: Int,                //Screen width in pixels
                        vendor: String,               //Device vendor, e.g. Samsung, Apple, etc.
                        locale: String,               //Device current locale
                        model: String,                //Device model, e.g. iPhone 3G, Galaxy S2, etc.
                        carrier: String,              //User mobile carrier
                        version: String,              //OS version
                        platform: Int)                //Platform, 1 - Android, 2 - iOS.

  case class Sys(       auth: SysAuth,                //App authorization data
                        device: SysDevice,            //User device information
                        geotime: SysGeoTime)          //Geo and time information of the user

  case class SysGeoTime(timestamp: DateTime,          //Timestamp in UTC
                        ip: Option[String],           //User's IP
                        geoData: Option[IPGeoData])   //User's Geo Data

  case class GeoUnit[T](name: String,                 //Name of the geo data unit, e.g. Country, City, etc.
                        code: T)                      //Code of the geo data unit, eg. USA, Canada, New York, Kiev, etc.

  case class IPGeoData( continent: GeoUnit[Int],      //User's continent ID
                        country: GeoUnit[String],     //User's country ID
                        division: GeoUnit[String],    //User's country subdivision, can be a state, a province, etc.
                        city: GeoUnit[Int])           //User's city ID

  case class StateInfo( name: String,                 //User defined name of the state
                        stType: Int,                  //0 - system, 1 - user
                        duration: Option[Long])       //Duration in milliseconds in this state, usually only for previous state reporting

  //Below various paths are defined that are used to store data in DB
  //Those paths are also used by Portal, make sure they are changed in Sync.

  def getYearMonthDayID(dt: DateTime) = dt.getYear.toString + "-" + dt.getMonthOfYear + "-" + dt.getDayOfMonth
  def getYearMonthID(dt: DateTime) = dt.getYear.toString + "-" + dt.getMonthOfYear
  def getFirstSessionID = "first_session"

  def getUsedValuesDoc = "USEDVALUES"
  def getBillingPath(dt: DateTime) = "b." + dt.getYear + "." + dt.getMonthOfYear
  def getBillingCounterPath(dt: DateTime) = getBillingPath(dt) + ".c"

  def getAllVersionsMonthPath(dt: DateTime) = "va." + dt.getYear + "." + dt.getMonthOfYear
  def getAllVersionsDayPath(dt: DateTime) = getAllVersionsMonthPath(dt) + "." + dt.getDayOfMonth

  def getUserRetentionPath(dt: DateTime) = "ret." + dt.getYear + "-" + dt.getMonthOfYear + "-" + dt.getDayOfMonth

  def getUserLogPath = "log"
  def getUserLogSizePath = "logs"
  def getUserEconomyPath = "eco"

  def getMonthEconomyBalancePath(dt: DateTime) = getAllVersionsMonthPath(dt) + ".e"
  def getMonthDayEconomyBalancePath(dt: DateTime) = getAllVersionsDayPath(dt) + ".e"

  def getFlowAllVersionsPath = "vfa"
  def getFlowVersionPath(v: String) = "vf." + v
  def getFlowStatesAllVersionsPath = getFlowAllVersionsPath + ".states"
  def getFlowTransitionsAllVersionsPath = getFlowAllVersionsPath + ".transitions"
  def getFlowStatesVersionPath(v: String) = getFlowVersionPath(v) + ".states"
  def getFlowTransitionsVersionPath(v: String) = getFlowVersionPath(v) + ".transitions"

  //First 5 minutes we break into 5 seconds intervals, after that into 1 minute intervals
  def getFlowTimelineVersionPath(v: String, state: String, timeLine: String, timeOffset: Int) =
    getFlowVersionPath(v) + ".timelines." + state + "." + timeLine + "." +
      (if(timeOffset < 5 * 60) ((timeOffset / 5) * 5) else ((timeOffset / 60) * 60))

  //First 5 minutes we break into 5 seconds intervals, after that into 1 minute intervals
  def getFlowTimelineAllVersionsPath(state: String, timeLine: String, timeOffset: Int) =
    getFlowAllVersionsPath + ".timelines." + state + "." + timeLine + "." +
      (if(timeOffset < 5 * 60) ((timeOffset / 5) * 5) else ((timeOffset / 60) * 60))

  def getVersionMonthPath(v: String, dt: DateTime) = "v." + v + "." + dt.getYear + "." + dt.getMonthOfYear
  def getVersionDayPath(v: String, dt: DateTime) = getVersionMonthPath(v, dt) + "." + dt.getDayOfMonth

  def getGeoPathCity(dt: DateTime, geoData: Option[IPGeoData]) = {
    if (geoData != None)
      getGeoPathCountry(dt, geoData) + "." + geoData.get.city.code.toString
    else
      getGeoPathCountry(dt, geoData)
  }

  def getGeoPathCountry(dt: DateTime, geoData: Option[IPGeoData]) = {
    if (geoData != None && geoData.get.country.code != null && geoData.get.country.code != "")
      getAllVersionsMonthPath(dt) + ".geo." + geoData.get.country.code
    else
      getAllVersionsMonthPath(dt) + ".geo.unknown"
  }

  def getHardwarePath = "hw"
  def getEcoProfile = "ecoprof"
}
