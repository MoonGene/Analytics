/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services

import akka.actor.{Cancellable, ActorLogging, Actor}
import akka.cluster.Cluster
import com.moongene.models.messages._
import org.hyperic.sigar._
import com.moongene.models.sys._
import org.joda.time.{DateTimeZone, DateTime}
import reactivemongo.bson.{BSONDateTime, BSONArray, BSONDocument, BSONObjectID}
import concurrent.duration.Duration
import java.util.concurrent.TimeUnit
import collection.mutable
import reactivemongo.core.commands.GetLastError
import akka.agent.Agent
import com.moongene.models.messages.SysLoad
import reactivemongo.bson.BSONDateTime
import reactivemongo.core.commands.GetLastError
import scala.Some

//MetricsLogger logs hardware utilization metrics and saves in DB
class MetricsLogger(nodePurpose: String, nodeData: String) extends Actor with ActorLogging {
  implicit def ec = concurrent.ExecutionContext.Implicits.global

  // Agents are used to keep track of database and communication requests count to see if something is lagging and
  // a queue is growing instead of being quickly processed
  val inLoadTracking = Agent(0)
  val outLoadTracking = Agent(0)
  val curLoadTracking = Agent(0)
  val dbOutLoadTracking = Agent(0)
  val dbCurLoadTracking = Agent(0)
  val dbErrLoadTracking = Agent(0)

  val selfAddress = Cluster(context.system).selfAddress
  val healthDB = Database.getDatabase("health")
  var cancelable: Cancellable = null

  override def preStart() {
    //TODO Could be potentially moved to a confirm file, currently we log hardware metrics every 5 minutes
    cancelable = context.system.scheduler.schedule(Duration.create(1, TimeUnit.SECONDS),
      Duration.create(5, TimeUnit.MINUTES), self, SysMetricsLog)
  }

  override def postStop() {
    if(cancelable != null)
      cancelable.cancel()
  }

  //Machine doc ID in the database to store hardware state snapshots
  private def getMachineDocId(metrics: SysMetrics.Metrics): String = {
      val md = java.security.MessageDigest.getInstance("SHA-1")
      md.digest((metrics.purpose + metrics.netInfo.hostIP + metrics.netInfo.hostName + metrics.userData ).getBytes("UTF-8")).map("%02x".format(_)).mkString
  }

  def receive = {
    //Increment corresponding counters if a request comes in, out to both analytics service and DB
    case load: SysLoad => {
      if(load.in != 0) inLoadTracking send (_ + load.in)
      if(load.out != 0) outLoadTracking send (_ + load.out)
      if(load.cur != 0) curLoadTracking send (_ + load.cur)
    }

    case load: DBLoad => {
      if(load.out != 0) dbOutLoadTracking send (_ + load.out)
      if(load.cur != 0) dbCurLoadTracking send (_ + load.cur)
      if(load.err != 0) dbErrLoadTracking send (_ + load.err)
    }

    //Trigger hardware state snapshot saving
    case SysMetricsLog => {
      try {
        log.debug("MetricsLogger -> Logging metrics info...")
        val sigar = new Sigar()

        //Per Core stats
        val cpuCore = scala.collection.mutable.ListBuffer[SysMetrics.CpuCore]()
        sigar.getCpuList foreach { cpu =>
          val idle = cpu.getIdle.toDouble / cpu.getTotal
          cpuCore += SysMetrics.CpuCore(1.0 - idle, idle)
        }

        //Add total CPU and per core
        var cpuTotalIdle: Double = 0.0
        cpuCore.foreach( cpuTotalIdle += _.idle )
        cpuTotalIdle /= cpuCore.size
        val cpuInfo = SysMetrics.Cpu(SysMetrics.CpuCore(1.0 - cpuTotalIdle, cpuTotalIdle), cpuCore)

        //TODO SystemLimit structure could be also logged
        //http://www.hyperic.com/support/docs/sigar/org/hyperic/sigar/ResourceLimit.html

        //Mem Info
        val sigarMemInfo = sigar.getMem
        val memInfo = SysMetrics.Memory(sigarMemInfo.getTotal, sigarMemInfo.getUsed)

        //Net Info
        val sigarNetInfo = sigar.getNetInfo
        val netInfo = SysMetrics.NetInfo(sigarNetInfo.getDefaultGateway, sigarNetInfo.getDomainName, selfAddress.toString,
          sigarNetInfo.getHostName, sigarNetInfo.getPrimaryDns, sigarNetInfo.getSecondaryDns)

        val sigarNetStatInfo = sigar.getNetStat
        val netStatInfo = SysMetrics.NetStat(sigarNetStatInfo.getAllInboundTotal, sigarNetStatInfo.getAllOutboundTotal)

        var fileSystems = scala.collection.mutable.ListBuffer[SysMetrics.FileSystem]()
        sigar.getFileSystemList foreach { fs =>
          var sigarfsu: FileSystemUsage = null
          //If this is a CD ROM or different device it may fail, so we need to catch that
          try {
            sigarfsu = sigar.getFileSystemUsage(fs.getDirName)
          } catch {
            case e:SigarException => //log.error(e, "Can't get device usage. For device: " + fs.getDirName)
              sigarfsu = null
          }

          val fileSystemUsage = if(sigarfsu == null) None else
            Some(SysMetrics.FileSystemUsage(sigarfsu.getFree, sigarfsu.getUsed, sigarfsu.getTotal,
                    sigarfsu.getDiskServiceTime, sigarfsu.getDiskReads, sigarfsu.getDiskWrites))

          fileSystems += SysMetrics.FileSystem(fs.getDevName, fs.getDirName, fs.getOptions, fs.getType,
            fs.getSysTypeName, fs.getFlags, fileSystemUsage)
        }

        val currentTime = DateTime.now.toDateTime(DateTimeZone.UTC)
        val metrics = SysMetrics.Metrics(Some(BSONObjectID.generate), currentTime, nodePurpose, nodeData,
          cpuInfo, memInfo, netInfo, netStatInfo, sigar.getUptime.getUptime, fileSystems)

        log.debug("Logging health metrics: " + metrics.toString)

        // TODO A possible optimization could be done by grabbing everything directly from sigar, however we might
        // need the structure for full dump of every time point

        //Create now a valid BSONDocument out of this metrics structure
        val bsonCpuCores = mutable.ArrayBuffer[BSONDocument]()
        for(i <- 0 until metrics.cpu.cores.size) {
          bsonCpuCores += BSONDocument(
            "n" -> i,
            "l" -> metrics.cpu.cores(i).load,
            "i" -> metrics.cpu.cores(i).idle
          )
        }

        val bsonCpu = BSONDocument(
          "l" -> metrics.cpu.total.load,
          "i" -> metrics.cpu.total.idle,
          "c" -> bsonCpuCores
        )

        val bsonMem = BSONDocument(
          "u" -> metrics.mem.totalUsed,
          "t" -> metrics.mem.total
        )

        val bsonFSUsages = mutable.ArrayBuffer[BSONDocument]()
        for(i <- 0 until metrics.fileSystems.size) {
          val fsUsage = metrics.fileSystems(i).usage
          if(fsUsage != None) {
            bsonFSUsages += BSONDocument(
              "n" -> metrics.fileSystems(i).dirName,
              "t" -> fsUsage.get.total,
              "u" -> fsUsage.get.totalUsed,
              "r" -> fsUsage.get.diskReads,
              "w" -> fsUsage.get.diskWrites
            )
          }
        }

        //Get current counters
        val inLoad = inLoadTracking.get()
        val outLoad = outLoadTracking.get()
        val curLoad = curLoadTracking.get()
        val outDBLoad = dbOutLoadTracking.get()
        val curDBLoad = dbCurLoadTracking.get()
        val errDBLoad = dbErrLoadTracking.get()

        //Now ask to deduct those, as they will be already reported to the database
        inLoadTracking send (_ - inLoad)
        outLoadTracking send (_ - outLoad)
        //curLoadTracking send (_ - curLoad)
        dbOutLoadTracking send (_ - outDBLoad)
        //dbCurLoadTracking send (_ - curDBLoad)
        dbErrLoadTracking send (_ - errDBLoad)

        /*//Uncomment to print out debugging information on in and out in realtime
        println("Traffic:")
        println("In: " + inLoad)
        println("Out: " + outLoad)
        println("Cur: " + curLoad)
        */

        val dynamicPart = BSONDocument(
          "c" -> bsonCpu,
          "m" -> bsonMem,
          "f" -> bsonFSUsages,
          "n" -> BSONDocument(
            "i" -> metrics.netStat.allInbound,
            "o" -> metrics.netStat.allOutbound
            ),
          "li" -> inLoad,
          "lo" -> outLoad,
          "lc" -> curLoad,
          "ldbo" -> outDBLoad,
          "ldbc" -> curDBLoad,
          "ldbe" -> errDBLoad
        )

        val staticPart = BSONDocument(
          "ts" -> BSONDateTime(metrics.timestamp.getMillis),
          "p" -> metrics.purpose,
          "n" -> metrics.netInfo,
          "u" -> metrics.userData,
          "f" -> metrics.fileSystems
        )

        val machineDocId = getMachineDocId(metrics)
        val query = BSONDocument(
          "_id" -> machineDocId )

        val dynamicUpdate = BSONDocument(
          "$set" -> BSONDocument(
            "data." + metrics.timestamp.getYear.toString + "." + metrics.timestamp.getMonthOfYear.toString + "." +
              metrics.timestamp.getDayOfMonth.toString + "." + metrics.timestamp.getHourOfDay.toString + "." +
              metrics.timestamp.getMinuteOfHour.toString -> dynamicPart
          ) )

        val healthCollection = healthDB.collection("metrics")
        healthCollection.update(query, dynamicUpdate, GetLastError(), upsert = true).map({ lastError =>
            //Succeeded, now let's check if this is a new document, if so we are going to write down static part as well
            // TODO Possible optimizations can be introduced here by pre-populating whole month of data, right now this will lead to document
            // size changes and this is not efficient, we can reuse same values, including FS but zero them.
          if(lastError.ok && !lastError.updatedExisting) {
            val staticUpdate = BSONDocument("$set" -> staticPart)
            healthCollection.update(query, staticUpdate)
          }
        })

      }  catch {
        case e:SigarException =>
          log.error(e, "MetricsLogger -> Metrics logging failed.")
      }
    }
  }
}
