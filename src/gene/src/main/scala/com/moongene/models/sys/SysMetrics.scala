/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.sys

import org.joda.time.DateTime
import scala.collection.Seq
import reactivemongo.bson._

//Describes current state of hardware, that is used by monitoring system
object SysMetrics {

  case class Metrics(         id: Option[BSONObjectID],
                              timestamp: DateTime,          //Node timestamp
                              purpose: String,              //Purpose of the logged node, for example Portal, Gene or Core
                              userData: String,             //Developer defined extra data for the node
                              cpu: Cpu,
                              mem: Memory,
                              netInfo: NetInfo,
                              netStat: NetStat,
                              uptime: Double,
                              fileSystems: Seq[FileSystem])

  case class Cpu(             total: CpuCore,
                              cores: Seq[CpuCore])

  case class CpuCore(         load: Double,
                              idle: Double)

  case class Memory(          total: Long,
                              totalUsed: Long)

  case class NetStat(         allInbound: Long,
                              allOutbound: Long)

  case class NetInfo(         gateway: String,
                              domain: String,
                              hostIP: String,
                              hostName: String,
                              dns: String,
                              dns2: String)

  case class FileSystem(      devName: String,
                              dirName: String,
                              options: String,
                              fsType: Int,
                              typeName: String,
                              flags: Long,
                              usage: Option[FileSystemUsage])

  case class FileSystemUsage( totalFree: Long,
                              totalUsed: Long,
                              total: Long,
                              serviceTime: Double,
                              diskReads: Long,
                              diskWrites: Long)

  implicit val fileSystemUsageFormat = Macros.handler[FileSystemUsage]
  implicit val fileSystemFormat = Macros.handler[FileSystem]
  implicit val netInfoFormat = Macros.handler[NetInfo]
  implicit val netStatFormat = Macros.handler[NetStat]
  implicit val memoryFormat = Macros.handler[Memory]
  implicit val cpuCoreFormat = Macros.handler[CpuCore]
  implicit val cpuFormat = Macros.handler[Cpu]

  implicit object MetricsBSONReader extends BSONDocumentReader[Metrics] {
    def read(doc: BSONDocument): Metrics =
      Metrics(
        doc.getAs[BSONObjectID]("_id"),
        doc.getAs[BSONDateTime]("timestamp").map(dt => new DateTime(dt.value)).get,
        doc.getAs[String]("purpose").get,
        doc.getAs[String]("data").get,
        doc.getAs[Cpu]("cpu").get,
        doc.getAs[Memory]("mem").get,
        doc.getAs[NetInfo]("netInfo").get,
        doc.getAs[NetStat]("netStat").get,
        doc.getAs[Double]("uptime").get,
        doc.getAs[Seq[FileSystem]]("fileSystems").get)
  }

  implicit object MetricsBSONWriter extends BSONDocumentWriter[Metrics] {
    def write(m: Metrics): BSONDocument =
      BSONDocument(
        "_id" -> m.id.getOrElse(BSONObjectID.generate),
        "timestamp" -> BSONDateTime(m.timestamp.getMillis),
        "purpose" -> m.purpose,
        "data" -> m.userData,
        "cpu" -> m.cpu,
        "mem" -> m.mem,
        "netInfo" -> m.netInfo,
        "netStat" -> m.netStat,
        "uptime" -> m.uptime,
        "fileSystems" -> m.fileSystems)
  }
}

