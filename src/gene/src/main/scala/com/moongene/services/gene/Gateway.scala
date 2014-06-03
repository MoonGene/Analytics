/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.gene

import akka.actor._
import spray.routing._
import spray.http._
import spray.http.MediaTypes._
import spray.json.DefaultJsonProtocol._
import com.moongene.models.track._
import spray.json._
import org.joda.time.{DateTimeZone, DateTime}
import com.moongene.Gene
import akka.cluster.Cluster
import akka.routing.FromConfig
import akka.cluster.routing.{ClusterRouterSettings, HeapMetricsSelector, AdaptiveLoadBalancingRouter, ClusterRouterConfig}
import scala.util.matching.Regex
import akka.contrib.pattern.{DistributedPubSubExtension, DistributedPubSubMediator}
import com.moongene.models.sys.SysAppsVault
import concurrent.duration.Duration
import java.util.concurrent.TimeUnit
import concurrent.ExecutionContext.Implicits.global
import com.moongene.services.core.GeoData
import com.typesafe.config.ConfigFactory
import java.net.InetAddress
import utility.Base64
import utility.UUIDHelper
import scala.util.parsing.json.JSONArray
import com.moongene.models.sys.SysAppsVault.AppVaultDetails
import reactivemongo.bson.Subtype.UuidSubtype
import reactivemongo.bson.BSONBinary
import com.moongene.models.messages.SysLoad
import com.moongene.services.Database
import reactivemongo.api.collections.default.BSONCollection
import reactivemongo.api.indexes.{Index, IndexType}

/*
  Gateway is the main entrance for all incoming messages. Here we do the following:
  - initialize HTTP service to receive events (REST based)
  - validate incoming events: authorization and values
  - extract Geo data from IP
  - forward events to corresponding workser if they passed all checks
 */
class Gateway extends Actor with HttpService with ActorLogging {
  val cluster = Cluster(context.system)
  val coreWorkers = context.actorOf(Props.empty.withRouter(FromConfig), name = "core-inbox")
   def actorRefFactory = context //This is needed for HttpService
  val appValidator = context.actorOf(Props[AppsVaultProxy], name = "validator-proxy")
  val gateDB = Database.getDatabase("gate")

  val allowUserSetIP = ConfigFactory.load().getBoolean("gene.allowUserSetIP")
  val geoDataDB = new GeoData

  //Subscribe to a global publisher, we need to be aware when new apps are added so we can accept them in real time
  import DistributedPubSubMediator.{ Subscribe, SubscribeAck, Publish }
  val clusterMediator = DistributedPubSubExtension(context.system).mediator
  clusterMediator ! Subscribe("AppsVaultUpdate", self)

  //Here we keep track of all Apps
  var validApps = Map[String, AppVaultDetails]()
  var getAppsScheduledEvent: Cancellable = null

  override def preStart() {
    //On start we need to fetch all apps from AppsVault
    getAppsScheduledEvent = context.system.scheduler.schedule(Duration.create(10, TimeUnit.SECONDS),
      Duration.create(5, TimeUnit.SECONDS), self, SysAppsVault.SelfUpdateAllApps())
  }

  override def postStop() {
    if(getAppsScheduledEvent != null) {
      getAppsScheduledEvent.cancel()
      getAppsScheduledEvent = null
    }
  }

  import com.moongene.models.track.GeneJsonProtocol._
  //Device ID can't include anything that is not a HEX symbol, - is allowed
  val deviceIdPattern = "[^a-fA-F0-9-]".r

  def encodeValue(value: String) = Base64.encodeToString((if(value == null || value == "") "Unknown".getBytes else value.getBytes), false)
  def validateDeviceId(id: String) = (deviceIdPattern replaceAllIn(id, "0")).toUpperCase.take(36) //Includes - in the GUID

  def validateAppId(id: String, token: String): Boolean = {
    val appDetails = validApps.get(id)
    if(appDetails != None && appDetails.get.token == token) true else false
  }

  def validateStartObject(so: StartObj.Start, httpIp: spray.http.HttpIp): Option[StartObj.Start] = {

    if(validateAppId(so.sys.auth.appId, so.sys.auth.appToken)) {
          val appDetails = validApps.get(so.sys.auth.appId).get
          //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
          val deviceFriendlyId = validateDeviceId(so.deviceId)
          val timestamp = so.sys.geotime.timestamp.toDateTime(appDetails.timezone)
          val ipAddress = if(allowUserSetIP && so.sys.geotime.ip != None) InetAddress.getByName(so.sys.geotime.ip.get) else httpIp.ip
          val friendlyCarrier = if(so.sys.device.carrier == "") "~" else so.sys.device.carrier
          val friendlyVendor = if(so.sys.device.vendor == "") "~" else so.sys.device.vendor
          val friendlyModel = if(so.sys.device.model == "") "~" else so.sys.device.model
          val friendlyLocale = if(so.sys.device.locale == "") "~" else so.sys.device.locale

      Some(
        so.copy(
          deviceId = deviceFriendlyId, deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId)),
          sys = so.sys.copy(
            geotime = so.sys.geotime.copy(
              ip = Some(ipAddress.getHostAddress),
              geoData = geoDataDB.get(ipAddress),
              timestamp = timestamp),
            device = so.sys.device.copy(
              carrier = friendlyCarrier,
              vendor = friendlyVendor,
              model = friendlyModel,
              locale = friendlyLocale)
            )
        )
      )
    } else
        None
  }

  def validateExitObject(eo: ExitObj.Exit, httpIp: spray.http.HttpIp): Option[ExitObj.Exit] = {
    if(validateAppId(eo.auth.appId, eo.auth.appToken)) {
      val appDetails = validApps.get(eo.auth.appId).get

      //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
      val deviceFriendlyId = validateDeviceId(eo.deviceId)
      val timestamp = eo.timestamp.toDateTime(appDetails.timezone)
      val ipAddress = if(allowUserSetIP && eo.ip != None) InetAddress.getByName(eo.ip.get) else httpIp.ip

      Some(eo.copy(deviceId = deviceFriendlyId, deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId)),
        ip = Some(ipAddress.getHostAddress), geoData = geoDataDB.get(ipAddress), timestamp = timestamp))
    } else
      None
  }

  def validateStateEventObject(se: StateEventObj.StateEvent): Option[StateEventObj.StateEvent] = {
    if(validateAppId(se.auth.appId, se.auth.appToken) && se.data1 != None && se.data2 != None) {
      val appDetails = validApps.get(se.auth.appId).get
      //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
      val deviceFriendlyId = validateDeviceId(se.deviceId)
      val localTimestamp = se.timestamp.toDateTime(appDetails.timezone)
      val eventData1 = Some(se.data1.get.take(64))
      val eventData2 = Some(se.data2.get.take(64))

      Some(se.copy(
        deviceId = deviceFriendlyId,
        deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId)),
        timestamp = localTimestamp,
        data1 = eventData1,
        data2 = eventData2
      ))
    } else
      None
  }

  def validateEconomyEventObject(ee: EconomyEventObj.EconomyEvent, httpIp: spray.http.HttpIp): Option[EconomyEventObj.EconomyEvent] = {
    if(validateAppId(ee.sys.auth.appId, ee.sys.auth.appToken)) {
      val appDetails = validApps.get(ee.sys.auth.appId).get
      //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
      val deviceFriendlyId = validateDeviceId(ee.deviceId)
      val timestamp = ee.sys.geotime.timestamp.toDateTime(appDetails.timezone)
      val preEvents = if(ee.preEvent != None) Some(ee.preEvent.get.takeRight(3)) else Some(List[String]())
      val preStates = if(ee.preState != None) Some(ee.preState.get.takeRight(3)) else Some(List[String]())

      val itemsAmount = if(ee.itemAmount == None) 1 else ee.itemAmount.get
      val currency = if(ee.paymentCurrency == None) "USD" else ee.paymentCurrency.get.toUpperCase
      val campaign = ee.campaignID.getOrElse("~")
      val ipAddress = if(allowUserSetIP && ee.sys.geotime.ip != None) InetAddress.getByName(ee.sys.geotime.ip.get) else httpIp.ip

      Some(ee.copy(
        deviceId = deviceFriendlyId,
        deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId)),
        itemAmount = Some(itemsAmount),
        campaignID = Some(campaign),
        paymentCurrency = Some(currency),
        sys = ee.sys.copy(
          geotime = ee.sys.geotime.copy(
            timestamp = timestamp,
            ip = Some(ipAddress.getHostAddress),
            geoData = geoDataDB.get(ipAddress))
        ),
        preEvent = if(preEvents.get.length != preStates.get.length) None else preEvents,
        preState = if(preEvents.get.length != preStates.get.length) None else preStates
      ))
    } else
      None
  }

  def validateEconomyBalanceObject(eb: EconomyBalanceObj.EconomyBalance): Option[EconomyBalanceObj.EconomyBalance] = {
    if(validateAppId(eb.auth.appId, eb.auth.appToken)) {
      val appDetails = validApps.get(eb.auth.appId).get
      //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
      val deviceFriendlyId = validateDeviceId(eb.deviceId)
      val timeStamp = eb.timestamp.toDateTime(appDetails.timezone)
      //TODO Consider changing this value to a higher value, also timeline to extend brackets from 0 - 100 to higher
      val itemsList = eb.balance.take(5).map( item =>
        EconomyBalanceObj.BalanceItem(
        id = item.id,
        amount = item.amount,
        timeline = Math.max(Math.min(100, item.timeline), 0))
      ):List[EconomyBalanceObj.BalanceItem]

      Some(eb.copy(deviceId = deviceFriendlyId, deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId)), timestamp = timeStamp, balance = itemsList))
    } else
      None
  }

  def validateStateChangeObject(sc: StateChangeObj.StateChange): Option[StateChangeObj.StateChange] = {
    if(validateAppId(sc.auth.appId, sc.auth.appToken)) {
      val appDetails = validApps.get(sc.auth.appId).get
      //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
      val deviceFriendlyId = validateDeviceId(sc.deviceId)

      Some(sc.copy(deviceId = deviceFriendlyId, deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId))))
    } else
      None
  }

  def validateFirstSessionEventObject(fse: FirstSessionEventObj.FirstSessionEvent): Option[FirstSessionEventObj.FirstSessionEvent] = {
    if(validateAppId(fse.auth.appId, fse.auth.appToken)) {
      val appDetails = validApps.get(fse.auth.appId).get
      //TODO We need to make sure version is of a valid format, we don't allow dots or other special symbols
      val deviceFriendlyId = validateDeviceId(fse.deviceId)

      Some(fse.copy(deviceId = deviceFriendlyId, deviceBinId = Some(UUIDHelper.getIdAsBytes(deviceFriendlyId))))
    } else
      None
  }

  def receive = sysReceive orElse httpReceive

  def sysReceive : Receive = {
    case selfUpdateAllApps: SysAppsVault.SelfUpdateAllApps => {
      appValidator ! SysAppsVault.GetApps()
      log.info("Gateway apps list  - sent request for full apps list.")
    }

    case allAppsMap: SysAppsVault.AllAppsMap => {
      if(getAppsScheduledEvent != null) {
        getAppsScheduledEvent.cancel()
        getAppsScheduledEvent = null //TODO Check if this a valid way!
      }

      validApps = allAppsMap.map
      log.info("Gateway apps list has been updated. New size: " + validApps.size)
    }

    case SubscribeAck(Subscribe("AppsVaultUpdate", self)) ⇒ {
      log.info("Gateway has subscribed to apps vault updates.")
    }

    case newApp: SysAppsVault.NewApp => {
      validApps = validApps + (newApp.id -> newApp.details)
      log.debug("New app has been added to Gateway. New size: " + validApps.size)

      //Execute ensure indices in case this hasn't been done yet
      ensureCollectionIndices(newApp.id)
    }

    case updateApp: SysAppsVault.UpdateApp => {
      //TODO Consider optimizing this
      validApps = validApps.filterKeys(_ == updateApp.id)
      validApps = validApps + (updateApp.id -> updateApp.details)
      log.debug("App has been updated at Gateway. Id: " + updateApp.id)
    }

    case delApp: SysAppsVault.DelApp => {
      //TODO Untested
      validApps = validApps.filterKeys(_ == delApp.id)
      log.debug("App has been deleted from Gateway. Id: " + delApp.id + " New size: " + validApps.size)

      //Drop collection now
      //TODO No errors check, consider adding
      gateDB.command(new reactivemongo.core.commands.Drop(delApp.id))
    }
  }

  def ensureCollectionIndices(appId: String) {
    val coll: BSONCollection = gateDB.collection(appId)

    //TODO No errors check, consider adding
    coll.indexesManager.ensure(Index(
      key = Seq(("d.p", IndexType.Ascending),
                ("d.pv", IndexType.Ascending),
                ("d.r", IndexType.Ascending),
                ("d.sw", IndexType.Ascending),
                ("d.sh", IndexType.Ascending),
                ("d.v", IndexType.Ascending),
                ("d.m", IndexType.Ascending),
                ("d.l", IndexType.Ascending),
                ("d.c", IndexType.Ascending),
                ("d.gy", IndexType.Ascending),
                ("d.gd", IndexType.Ascending),
                ("d.gi", IndexType.Ascending)),
      name = Some("Device Index")
    ))

    coll.indexesManager.ensure(Index(
      key = Seq(("eco.a", IndexType.Ascending),
                ("eco.p", IndexType.Ascending)),
      name = Some("Economy Index")

    ))
  }

  def processStart(obj: StartObj.Start, ip: HttpIp) = {
    val validObj = validateStartObject(obj, ip)
    if(validObj == None)
    {
      Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
      "Invalid Start object."
    } else
    {
      Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
      coreWorkers ! validObj.get
      "1"
    }
  }

  def processExit(obj: ExitObj.Exit, ip: HttpIp) = {
      val validObj = validateExitObject(obj, ip)
      if(validObj == None)
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
        "Invalid Exit object."
      } else
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
        coreWorkers ! validObj.get
        "1"
      }
  }

  def processEconomyEvent(obj: EconomyEventObj.EconomyEvent, ip: HttpIp) = {
      val validObj = validateEconomyEventObject(obj, ip)
      if(validObj == None)
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
        "Invalid Economy Event object."
      } else
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
        coreWorkers ! validObj.get
        "1"
      }
  }

  def processEconomyBalance(obj: EconomyBalanceObj.EconomyBalance) = {
      val validObj = validateEconomyBalanceObject(obj)
      if(validObj == None)
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
        "Invalid Economy Balance object."
      } else
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
        coreWorkers ! validObj.get
        "1"
      }
  }

  def processStateChange(obj: StateChangeObj.StateChange) = {
      val validObj = validateStateChangeObject(obj)
      if(validObj == None)
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
        "Invalid State Change object."
      } else
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
        coreWorkers ! validObj.get
        "1"
      }
    }

    def processStateEvent(obj: StateEventObj.StateEvent) = {
        val validObj = validateStateEventObject(obj)
        if(validObj == None)
        {
          Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
          "Invalid State Event object."
        } else
        {
          Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
          coreWorkers ! validObj.get
          "1"
        }
    }

  def processFirstSessionEvent(obj: FirstSessionEventObj.FirstSessionEvent) = {
      val validObj = validateFirstSessionEventObject(obj)
      if(validObj == None)
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
        "Invalid First Session Event object."
      } else
      {
        Gene.metricsLogger ! SysLoad(in = 0, out = 1, cur = -1)
        coreWorkers ! validObj.get
        "1"
      }
  }

  def httpReceive : Receive = runRoute({
    import spray.httpx.SprayJsonSupport.sprayJsonMarshaller
    import spray.httpx.SprayJsonSupport.sprayJsonUnmarshaller

    pathPrefix("track") {
      path("start") {
        post {
          entity(as[StartObj.Start]) { start => clientIP { ip =>
            log.debug("HTTP entity StartObj.Start came in: " + start)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processStart(start, ip))
          }}
        }
      } ~
      path("exit") {
        post {
          entity(as[ExitObj.Exit]) { exit => clientIP { ip =>
            log.debug("HTTP entity ExitObj.Exit came in: " + exit)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processExit(exit, ip))
          }}
        }
      } ~
      path("statechange") {
        post {
          entity(as[StateChangeObj.StateChange]) { statechange =>
            log.debug("HTTP entity StateChangeObj.StateChange came in: " + statechange)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processStateChange(statechange))
          }
        }
      } ~
      path("stateevent") {
        post {
          entity(as[StateEventObj.StateEvent]) { stateevent =>
            log.debug("HTTP entity StateEventObj.StateEvent came in: " + stateevent)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processStateEvent(stateevent))
          }
        }
      } ~
      path("firstsessionevent") {
        post {
          entity(as[FirstSessionEventObj.FirstSessionEvent]) { firstsessionevent =>
            log.debug("HTTP entity FirstSessionEventObj.FirstSessionEvent came in: " + firstsessionevent)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processFirstSessionEvent(firstsessionevent))
          }
        }
      } ~
      path("economyevent") {
        post {
          entity(as[EconomyEventObj.EconomyEvent]) { economyevent => clientIP { ip =>
            log.debug("HTTP entity EconomyEventObj.EconomyEvent came in: " + economyevent)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processEconomyEvent(economyevent, ip))
          }}
        }
      } ~
      path("economybalance") {
        post {
          entity(as[EconomyBalanceObj.EconomyBalance]) { economybalance =>
            log.debug("HTTP entity EconomyBalanceObj.EconomyBalance came in: " + economybalance)
            Gene.metricsLogger ! SysLoad(in = 1, out = 0, cur = 1)
            complete(processEconomyBalance(economybalance))
          }
        }
      } ~
      path("bundle") {
        post {
          entity(as[String]) { bundle:String => clientIP { ip =>
            log.debug("HTTP entity bundle came in: " + bundle)
            val bundleUrlDecoded = java.net.URLDecoder.decode(bundle.substring(5), "UTF-8")

            if(!bundle.startsWith("data="))
              complete("Invalid object.")
            else {
              val dataStr = new String(Base64.decode(bundleUrlDecoded))
              log.debug("HTTP bundle decoded: " + dataStr)
              val dataJson = dataStr.asJson
              if(dataJson.isInstanceOf[JsArray]) {
                val dataJsArr = dataJson.asInstanceOf[JsArray]
                Gene.metricsLogger ! SysLoad(in = dataJsArr.elements.length, out = 0, cur = dataJsArr.elements.length)
                dataJsArr.elements.foreach( jsVal =>
                  if(jsVal.isInstanceOf[JsObject]){
                    val jsObj = jsVal.asInstanceOf[JsObject]
                    val objType = jsObj.fields.get("type")
                    val objTypeStr = if(objType != None && objType.get.isInstanceOf[JsString])
                      objType.get.asInstanceOf[JsString].value else ""
                    try {
                      objTypeStr match {
                        case "start" =>  processStart(GeneJsonProtocol.impStartObjStart.read(jsObj), ip)
                        case "exit" =>  processExit(GeneJsonProtocol.impExitObjExit.read(jsObj), ip)
                        case "statechange" => processStateChange(GeneJsonProtocol.impStateChangeObjStateChange.read(jsObj))
                        case "stateevent" => processStateEvent(GeneJsonProtocol.impStateEventObjStateEvent.read(jsObj))
                        case "economyevent" => processEconomyEvent(GeneJsonProtocol.impEconomyEventObjEconomyEvent.read(jsObj), ip)
                        case "economybalance" => processEconomyBalance(GeneJsonProtocol.impEconomyBalanceObjEconomyBalance.read(jsObj))
                        case "firstsession" => processFirstSessionEvent(GeneJsonProtocol.impFirstSessionEventObjFirstSessionEvent.read(jsObj))
                      }
                    } catch {
                      case desEx: spray.json.DeserializationException => {
                        Gene.metricsLogger ! SysLoad(in = 0, out = 0, cur = -1)
                        log.debug("Failed to deserialize object into format " + objTypeStr, desEx)
                      }

                    }
                  }
                )
                complete("1")
              } else
                complete("Invalid object. Array is expected.")
            }
          }}
        }
      }
    }
  })
}
