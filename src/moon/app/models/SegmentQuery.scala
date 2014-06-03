/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package models

import reactivemongo.core.commands
import reactivemongo.bson.{BSONDateTime, BSONInteger, BSONDocument}
import org.joda.time.{DateTimeZone, DateTime}
import controllers.DataFetcher

/*
  SegmentQuery is a helper to create segmentation queries for MongoDB aggregation framework requests
 */
case class SegmentQuery(
                    timezone: DateTimeZone,
                    dateFromMsUTC: Long,
                    dateToMsUTC: Long,
                    countries: Option[List[String]],
                    resolution: Option[List[String]],
                    vendor: Option[List[String]],
                    model: Option[List[String]],
                    carrier: Option[List[String]],
                    platform: Option[List[Int]],
                    platformV: Option[List[String]],
                    queryFor: String = "segmentation") {

  def generateId() = {
    //Date is not counted, just filter values
    val combinationStr = queryFor + "~" +
    (if(countries == None || countries.size == 0) "~" else countries.get.sortWith(_.toLowerCase < _.toLowerCase).mkString("~")) +
    (if(resolution == None || resolution.size == 0) "~" else resolution.get.sortWith(_.toLowerCase < _.toLowerCase).mkString("~")) +
    (if(vendor == None || vendor.size == 0) "~" else vendor.get.sortWith(_.toLowerCase < _.toLowerCase).mkString("~")) +
    (if(model == None || model.size == 0) "~" else model.get.sortWith(_.toLowerCase < _.toLowerCase).mkString("~")) +
    (if(carrier == None || carrier.size == 0) "~" else carrier.get.sortWith(_.toLowerCase < _.toLowerCase).mkString("~")) +
    (if(platform == None || platform.size == 0) "~" else platform.get.sortWith(_ < _).mkString("~")) +
    (if(platformV == None || platformV.size == 0) "~" else platformV.get.sortWith(_.toLowerCase < _.toLowerCase).mkString("~"))

    //Create hash from it
    val md = java.security.MessageDigest.getInstance("SHA-1")
    md.digest((combinationStr).getBytes("UTF-8")).map("%02x".format(_)).mkString
  }

  def generateDatesAndGroupOps(fromMsUTC: Long, toMsUTC: Long) = {
    val from = DataFetcher.getDayStartTime(new DateTime(fromMsUTC, DateTimeZone.UTC).toDateTime(timezone))
    val to = DataFetcher.getDayEndTime(if(toMsUTC < fromMsUTC)
      DateTime.now.toDateTime(timezone) else new DateTime(toMsUTC, DateTimeZone.UTC).toDateTime(timezone))

    var currentDate = from

    val datesList = scala.collection.mutable.ListBuffer.empty[BSONDateTime]
    val opsList = scala.collection.mutable.ListBuffer.empty[(String, commands.GroupFunction)]
    while({currentDate.isBefore(to)}) {
      datesList += BSONDateTime(currentDate.withMillisOfDay(0).getMillis)

      queryFor match {
        case "segmentation" => {
          val prefixDefis = currentDate.getYear + "-" + currentDate.getMonthOfYear + "-" + currentDate.getDayOfMonth
          val prefixDot = "va." + currentDate.getYear + "." + currentDate.getMonthOfYear + "." + currentDate.getDayOfMonth
          opsList += ((prefixDefis + "-avg") -> commands.Avg(prefixDot + ".s"))
          opsList += ((prefixDefis + "-ses") -> commands.SumField(prefixDot + ".s"))
          opsList += ((prefixDefis + "-len") -> commands.SumField(prefixDot + ".l"))
          opsList += ((prefixDefis + "-amt") -> commands.SumField(prefixDot + ".a"))
          opsList += ((prefixDefis + "-pu") -> commands.SumField(prefixDot + ".pu"))
        }

        case "retention" => {
          val prefixDefis = currentDate.getYear + "-" + currentDate.getMonthOfYear + "-" + currentDate.getDayOfMonth
          val prefixDot = "ret." + currentDate.getYear + "-" + currentDate.getMonthOfYear + "-" + currentDate.getDayOfMonth
          opsList += ((prefixDefis + "-d0") -> commands.SumField(prefixDot + ".d0"))
          opsList += ((prefixDefis + "-d1") -> commands.SumField(prefixDot + ".d1"))
          opsList += ((prefixDefis + "-d3") -> commands.SumField(prefixDot + ".d3"))
          opsList += ((prefixDefis + "-d6") -> commands.SumField(prefixDot + ".d6"))
          opsList += ((prefixDefis + "-d13") -> commands.SumField(prefixDot + ".d13"))
          opsList += ((prefixDefis + "-d27") -> commands.SumField(prefixDot + ".d27"))
        }
      }

      currentDate = currentDate.plusDays(1)
    }

    (datesList.toList, opsList.toList)
  }

  def buildAggregateCommand(coll: String) = {
    var matchCmdDoc = BSONDocument()
    if (countries != None && countries.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(countries.get.size == 1)
          BSONDocument("d.gy" -> countries.get(0))
        else
          BSONDocument("d.gy" -> BSONDocument("$in" -> countries.get)))
    }

    if (resolution != None && resolution.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(resolution.get.size == 1)
          BSONDocument("d.r" -> resolution.get(0))
        else
          BSONDocument("d.r" -> BSONDocument("$in" -> resolution.get)))
    }

    if (vendor != None && vendor.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(vendor.get.size == 1)
          BSONDocument("d.v" -> vendor.get(0))
        else
          BSONDocument("d.v" -> BSONDocument("$in" -> vendor.get)))
    }

    if (model != None && model.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(model.get.size == 1)
          BSONDocument("d.m" -> model.get(0))
        else
          BSONDocument("d.m" -> BSONDocument("$in" -> model.get)))
    }

    if (carrier != None && carrier.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(carrier.get.size == 1)
          BSONDocument("d.c" -> carrier.get(0))
        else
          BSONDocument("d.c" -> BSONDocument("$in" -> carrier.get)))
    }

    if (platform != None && platform.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(platform.get.size == 1)
          BSONDocument("d.p" -> platform.get(0))
        else
          BSONDocument("d.p" -> BSONDocument("$in" -> platform.get)))
    }

    if (platformV != None && platformV.get.size > 0) {
      matchCmdDoc = matchCmdDoc ++ (
        if(platformV.get.size == 1)
          BSONDocument("d.pv" -> platformV.get(0))
        else
          BSONDocument("d.pv" -> BSONDocument("$in" -> platformV.get)))
    }

    val datesAndOps = generateDatesAndGroupOps(dateFromMsUTC, dateToMsUTC)
    matchCmdDoc = matchCmdDoc ++ BSONDocument("log" -> BSONDocument("$in" -> datesAndOps._1))

    commands.Aggregate(coll, Seq(
            commands.Match(matchCmdDoc),
            commands.GroupField(queryFor)(
              datesAndOps._2:_*
            )
          ))
  }

}