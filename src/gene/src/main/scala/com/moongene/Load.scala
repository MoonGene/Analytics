/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene

import akka.actor.ActorSystem
import models.load.PhoneDevice
import models.track.Common.SysAuth
import models.track.ExitObj.Exit
import models.track._
import models.track.StartObj.Start
import models.track.StateChangeObj.StateChange
import spray.util._
import com.typesafe.config.{Config, ConfigFactory}
import spray.client.pipelining._
import concurrent.{Await, Future}
import spray.can.Http
import akka.io.IO
import akka.pattern.ask
import models.track.StartObj._
import util.Random
import concurrent.ExecutionContext.Implicits.global
import scala.concurrent.duration._
import spray.http._
import scala.Some
import spray.http.HttpResponse
import spray.httpx.SprayJsonSupport._
import org.joda.time.{DateTimeZone, DateTime}
import scala.collection.JavaConverters._
import models.track.StartObj.Start
import models.track.Common.SysAuth
import collection.mutable.ArrayBuffer
import collection.mutable
import org.apache.commons.lang3.RandomStringUtils
import scala.Some
import spray.http.HttpResponse
import com.moongene.LoadTestVersion
import utility.Base64
import reactivemongo.bson.BSONBinary
import reactivemongo.bson.Subtype.UuidSubtype

case class LoadTestVersion(id: String, session: List[Integer], release: DateTime, dayWave: List[Integer])

object LoadTestConfig {
  val config = ConfigFactory.load()
  val serverPort = config.getInt("load-test.server.port")
  val serverHost = config.getString("load-test.server.host")
  val continuous = config.getBoolean("load-test.time.continuous")
  val timeFrom = DateTime.parse(config.getString("load-test.time.from")).toDateTime(DateTimeZone.UTC)
  val timeTo = DateTime.parse(config.getString("load-test.time.to")).toDateTime(DateTimeZone.UTC)

  val appIds = config.getStringList("load-test.apps.ids").asScala.toList
  val appTokens = config.getStringList("load-test.apps.tokens").asScala.toList
  val appVersionsList = config.getConfigList("load-test.apps.versions")
  val retentionDrop = config.getIntList("load-test.apps.retentionDayDrop").asScala.toList
  var appVersions = List[LoadTestVersion]()

  for(vObj <- appVersionsList.toArray) {
    val v = vObj.asInstanceOf[Config]
    val version = LoadTestVersion(v.getString("id"), v.getIntList("session").asScala.toList,
      DateTime.parse(v.getString("release")).toDateTime(DateTimeZone.UTC), v.getIntList("dayWave").asScala.toList)
    appVersions = appVersions :+  version
  }
}

/*
  Load Testing System. Continuous and fixed time range load tests are possible.
  App versions, intensity, retention and other parameters are configurable.
 */
object Load extends App {

  //Uncomment to generate new cookies
  //println("dev cookie: " + akka.util.Crypt.generateSecureCookie)
  //println("release cookie: " + akka.util.Crypt.generateSecureCookie)


  def b64(value: String, default: String = "Unknown") = Base64.encodeToString((if(value == null || value == "") default.getBytes else value.getBytes), false)

  println("Destination server: " + LoadTestConfig.serverHost + ":" + LoadTestConfig.serverPort)
  println("Load emulation period(UTC): " + LoadTestConfig.timeFrom + " till " + LoadTestConfig.timeTo)

  println("version: " + LoadTestConfig.appVersions(0))

  var totalAmountOfUsers = 0
  var totalAmountOfUniqueUsers = 0
  var totalTimeSpent = 0L
  val random = new Random(new java.security.SecureRandom())
  implicit val loadSystem = ActorSystem("GeneLoadSystem")

  var totalEventsSent: Long = 0L
  var retentionUsersCache = new mutable.ListMap[String, ArrayBuffer[StartObj.Start]]

  def sendSessionSequence(sessionSequence: List[List[AnyRef]]) = {
    val pendingRequests = mutable.ArrayBuffer[Future[HttpResponse]]()
    var totEvSent = 0
    val pipeline = sendReceive

    import com.moongene.models.track.GeneJsonProtocol._
    sessionSequence.foreach { oneSession =>
      oneSession.foreach { ssObj =>
        ssObj match {
          case ssStartObj: StartObj.Start => {
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/start", ssStartObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating StartEvent of a user: " + ssStartObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case ssExitObj: ExitObj.Exit => {
            totalTimeSpent += ssExitObj.sessionLength
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/exit", ssExitObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating ExitEvent of a user: " + ssExitObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case ssStateChangeObj: StateChangeObj.StateChange => {
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/statechange", ssStateChangeObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating StateChangeEvent of a user: " + ssStateChangeObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case ssEconomyEventObj: EconomyEventObj.EconomyEvent => {
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/economyevent", ssEconomyEventObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating EconomyEvent of a user: " + ssEconomyEventObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case ssStateEventObj: StateEventObj.StateEvent => {
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/stateevent", ssStateEventObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating StateEvent of a user: " + ssStateEventObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case ssEconomyBalanceObj: EconomyBalanceObj.EconomyBalance => {
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/economybalance", ssEconomyBalanceObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating EconomyBalance of a user: " + ssEconomyBalanceObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case ssFirstSessionEventObj: FirstSessionEventObj.FirstSessionEvent => {
            val response: Future[HttpResponse] = pipeline(Post(LoadTestConfig.serverHost + ":" +
              LoadTestConfig.serverPort + "/track/firstsessionevent", ssFirstSessionEventObj))
            response.map { resp => print(resp.entity.asString) }.recover {
              case e => println("Error simulating FirstSessionEvent of a user: " + ssFirstSessionEventObj + " {}", e)
            }

            pendingRequests += response
            totEvSent += 1
          }

          case _ => {
            println("Unknown ssObj type.")
          }
        }}}

    (pendingRequests, totEvSent)
  }

  if(LoadTestConfig.continuous) {
    val currentDate = DateTime.now()
    while(true) {

      var appIndex = 0
      for(appIdsIter <- LoadTestConfig.appIds) {
        println("Simulation of app: " + appIdsIter)

        val retDiff = LoadTestConfig.retentionDrop(1) - LoadTestConfig.retentionDrop(0)
        val retentionDrop: Int = if(retDiff == 0) LoadTestConfig.retentionDrop(0) else
          (random.nextInt(retDiff) + LoadTestConfig.retentionDrop(0))

        val curAppCache = retentionUsersCache.get(appIdsIter)
        if(curAppCache != None) {
          var cacheBuf = curAppCache.get
          println("Retention buffer found: " + cacheBuf.size)
          cacheBuf = util.Random.shuffle(cacheBuf)
          val amountToRemove: Int = (cacheBuf.size / 100.0 * retentionDrop).toInt
          cacheBuf.remove(0, amountToRemove)
          println("Retention buffer after removing " + amountToRemove + "(" + retentionDrop + "%): " + cacheBuf.size)
          retentionUsersCache(appIdsIter) = cacheBuf
        }

        for(appVersionIter <- LoadTestConfig.appVersions) {
          if(appVersionIter.release.isAfter(currentDate)) {
            println("Version " + appVersionIter.id + " has not been yet released.")
          } else {
            //println("Version " + appVersionIter.id + " simulation started.")

            val newWaveSize: Int = 5

            println("Generating new wave users...")
            val retCache = retentionUsersCache.get(appIdsIter)
            val returningUsers = if(retCache == None) 0 else retCache.get.size
            val dayTotalUsers = newWaveSize + returningUsers
            val newWaveUsers = new Array[StartObj.Start](dayTotalUsers)
            for(i <- 0 until newWaveSize) {
              newWaveUsers(i) = genNewUser(currentDate, appIdsIter, LoadTestConfig.appTokens(appIndex), appVersionIter.id)
            }
            totalAmountOfUniqueUsers = totalAmountOfUniqueUsers + newWaveSize

            //Add also retention users
            if(retCache != None)
              for(i <- 0 until returningUsers) {
                val cachedUser = retCache.get(i)
                //Update also date for this user
                newWaveUsers(i + newWaveSize) = cachedUser.copy(sys = cachedUser.sys.copy(geotime =
                  cachedUser.sys.geotime.copy(timestamp = currentDate)))
              }

            println("Wave size: " + newWaveUsers.size)
            retentionUsersCache(appIdsIter) = newWaveUsers.to[mutable.ArrayBuffer]

            totalAmountOfUsers = totalAmountOfUsers + dayTotalUsers
            //println("Sending out events sequences...")

            val pendingRequests = mutable.ArrayBuffer[Future[HttpResponse]]()
            for (i <- 0 until dayTotalUsers) {
              //println("Version Check: " + newWaveUsers(i).data.version + " & " + appVersionIter.id)
              if(newWaveUsers(i).version == b64(appVersionIter.id))
              {
                //Generate sequence of user events
                var sessionSequence = List[List[AnyRef]](genUserSession(appVersionIter, newWaveUsers(i), firstSession = true))
                if(random.nextBoolean())
                  sessionSequence = sessionSequence :+ genUserSession(appVersionIter, newWaveUsers(i))
                if(random.nextBoolean())
                  sessionSequence = sessionSequence :+ genUserSession(appVersionIter, newWaveUsers(i))

                //println(sessionSequence)
                val sendResult = sendSessionSequence(sessionSequence)
                pendingRequests ++= sendResult._1
                totalEventsSent += sendResult._2

              } else
                totalAmountOfUsers = totalAmountOfUsers - 1
              Future(true)
            }

            // wait until requests complete
            print("Awaiting daily http requests...")
            for (req <- pendingRequests) Await.ready(req, Duration(100, SECONDS))
            println("done. events: " + totalEventsSent + " users: " + totalAmountOfUniqueUsers)
          }
        }

        appIndex += 1
      }
    }

  } else {
    var currentDate = LoadTestConfig.timeFrom
    while({currentDate.isBefore(LoadTestConfig.timeTo)}) {
      println("Simulating day  " + currentDate.getYear + "-" + currentDate.getMonthOfYear + "-" + currentDate.getDayOfMonth)

      //TODO Add token to app ids
      var appIndex = 0
      for(appIdsIter <- LoadTestConfig.appIds) {
        println("Simulation of app: " + appIdsIter)

        val retDiff = LoadTestConfig.retentionDrop(1) - LoadTestConfig.retentionDrop(0)
        val retentionDrop: Int = if(retDiff == 0) LoadTestConfig.retentionDrop(0) else
          (random.nextInt(retDiff) + LoadTestConfig.retentionDrop(0))

        val curAppCache = retentionUsersCache.get(appIdsIter)
        if(curAppCache != None) {
          var cacheBuf = curAppCache.get
          println("Retention buffer found: " + cacheBuf.size)
          cacheBuf = util.Random.shuffle(cacheBuf)
          val amountToRemove: Int = (cacheBuf.size / 100.0 * retentionDrop).toInt
          cacheBuf.remove(0, amountToRemove)
          println("Retention buffer after removing " + amountToRemove + "(" + retentionDrop + "%): " + cacheBuf.size)
          retentionUsersCache(appIdsIter) = cacheBuf
        }

        for(appVersionIter <- LoadTestConfig.appVersions) {
          if(appVersionIter.release.isAfter(currentDate)) {
            println("Version " + appVersionIter.id + " has not been yet released.")
          } else {
            println("Version " + appVersionIter.id + " simulation started.")

            val sizeDiff = appVersionIter.dayWave(1) - appVersionIter.dayWave(0)
            val newWaveSize: Int = if(sizeDiff == 0) appVersionIter.dayWave(0) else
              (random.nextInt(sizeDiff) + appVersionIter.dayWave(0))

            println("Generating new wave users...")
            val retCache = retentionUsersCache.get(appIdsIter)
            val returningUsers = if(retCache == None) 0 else retCache.get.size
            val dayTotalUsers = newWaveSize + returningUsers
            val newWaveUsers = new Array[StartObj.Start](dayTotalUsers)
            for(i <- 0 until newWaveSize) {
              newWaveUsers(i) = genNewUser(currentDate, appIdsIter, LoadTestConfig.appTokens(appIndex), appVersionIter.id)
            }
            totalAmountOfUniqueUsers = totalAmountOfUniqueUsers + newWaveSize

            //Add also retention users
            if(retCache != None)
              for(i <- 0 until returningUsers) {
                val cachedUser = retCache.get(i)
                //Update also date for this user
                newWaveUsers(i + newWaveSize) = cachedUser.copy(sys = cachedUser.sys.copy(geotime =
                  cachedUser.sys.geotime.copy(timestamp = currentDate)))
              }

            println("Version daily params. New wave: " + newWaveSize + ". Total for today: " + newWaveUsers.size)
            retentionUsersCache(appIdsIter) = newWaveUsers.to[mutable.ArrayBuffer]

            totalAmountOfUsers = totalAmountOfUsers + dayTotalUsers
            println("Sending out events sequences...")

            val pendingRequests = mutable.ArrayBuffer[Future[HttpResponse]]()
            for (i <- 0 until dayTotalUsers) {
              //println("Version Check: " + newWaveUsers(i).data.version + " & " + appVersionIter.id)
              if(newWaveUsers(i).version == b64(appVersionIter.id))
              {
                //Generate sequence of user events
                var sessionSequence = List[List[AnyRef]](genUserSession(appVersionIter, newWaveUsers(i), firstSession = true))
                if(random.nextBoolean())
                  sessionSequence = sessionSequence :+ genUserSession(appVersionIter, newWaveUsers(i))
                if(random.nextBoolean())
                  sessionSequence = sessionSequence :+ genUserSession(appVersionIter, newWaveUsers(i))

                //println(sessionSequence)
                val sendResult = sendSessionSequence(sessionSequence)
                pendingRequests ++= sendResult._1
                totalEventsSent += sendResult._2

              } else
                totalAmountOfUsers = totalAmountOfUsers - 1
              Future(true)
            }

            // wait until requests complete
            print("Awaiting daily http requests...")
            for (req <- pendingRequests) Await.ready(req, Duration(100, SECONDS))
            println("done.")
          }
        }

        appIndex += 1
      }

      currentDate = currentDate.plusDays(1)
      //Thread.sleep(100)
    }

    println("Simulation has been successfully completed.")
    println("Total amount of users: " + totalAmountOfUsers)
    println("Total of unique: " + totalAmountOfUniqueUsers)
    println("Total sessions time: " + totalTimeSpent)
    println("Total number of events sent: " + totalEventsSent)
  }


  //shutdown()

  def genFirstSession(so: StartObj.Start) = {
    val sessionEvents = mutable.ArrayBuffer[FirstSessionEventObj.FirstSessionEvent]()
    val availableEvents = List[String](
      b64("Start"), b64("End"), b64("Player Died"), b64("Powerup Picked up"), b64("Powerup Used")/*,
      b64("Boss Fight"), b64("Boss Defeated"), b64("Tutorial Completed"), b64("Tutorial Started")  */
    )
    val availableStates = List[String](
      b64("Level"), b64("Level"), b64("Level"), b64("Level"), b64("Level")/*,
      b64("Level"), b64("Level"), b64("Main Menu"), b64("Main Menu") */
    )

    val sequenceLength = 3 + new Random().nextInt(10)
    for(i <- 0 to sequenceLength) {
      val randomEvent = new Random().nextInt(availableEvents.length)
      val fse = FirstSessionEventObj.FirstSessionEvent(
        so.deviceId, None, so.version, so.sys.auth, so.sys.geotime.timestamp,
        Common.StateInfo(
          name = if(i == 0) b64("Start") else sessionEvents(i - 1).toState.name,
          stType = if(i == 0) 0 else sessionEvents(i - 1).toState.stType,
          duration = None
        ),
        if(i == 0) b64("~") else sessionEvents(i - 1).toEvent,
        Common.StateInfo(
          name = availableStates(randomEvent),
          stType = 1,
          duration = None
        ),
        availableEvents(randomEvent)
      )

      sessionEvents += fse
    }

    sessionEvents += FirstSessionEventObj.FirstSessionEvent(
      so.deviceId, None, so.version, so.sys.auth, so.sys.geotime.timestamp,
      Common.StateInfo(
        name = sessionEvents(sequenceLength - 1).toState.name,
        stType = sessionEvents(sequenceLength - 1).toState.stType,
        duration = None
      ),
      sessionEvents(sequenceLength - 1).toEvent,
      Common.StateInfo(
        name = b64("Exit"),
        stType = 0,
        duration = None
      ),
      "~"
    )

    sessionEvents
  }

  def genUserSession(loadVersion: LoadTestVersion, so: StartObj.Start, firstSession: Boolean = false) = {

    val purchaseTriggerEvents = List[List[String]](
      List[String](b64("Start"), b64("Player Died")),
      List[String](b64("Start"), b64("Player Died"), b64("Start")),
      List[String](b64("Start"), b64("Roulette Start")),
      List[String](b64("Roulette Start"), b64("Roulette Lose"), b64("Roulette Start")),
      List[String](b64("Invite Received")),
      List[String](b64("Invite Received"), b64("Start"))
    )
    val purchaseTriggerStates = List[List[String]](
      List[String](b64("Level"), b64("Level")),
      List[String](b64("Level"), b64("Level"), b64("Level")),
      List[String](b64("Level"), b64("Post Level")),
      List[String](b64("Post Level"), b64("Post Level"), b64("Post Level")),
      List[String](b64("Main Menu")),
      List[String](b64("Main Menu"), b64("Level"))
    )


    val lengthDiff = loadVersion.session(1) - loadVersion.session(0)
    val newLength: Int = if(lengthDiff == 0) loadVersion.session(0) else
      (random.nextInt(lengthDiff) + loadVersion.session(0))

    val sc1 = StateChangeObj.StateChange(
      deviceId = so.deviceId,
      deviceBinId = None,
      version = so.version,
      auth = so.sys.auth,
      timestamp = so.sys.geotime.timestamp.plusSeconds(1),
      newState = Common.StateInfo(b64("Main Menu"), 1, duration = None),
      oldState = Common.StateInfo(b64("Start"), 0, duration = Some(1)))

    val sc2 = StateChangeObj.StateChange(
      deviceId = so.deviceId,
      deviceBinId = None,
      version = so.version,
      auth = so.sys.auth,
      timestamp = so.sys.geotime.timestamp.plusSeconds(2),
      newState = Common.StateInfo(b64("Game"), 1, duration = None),
      oldState = Common.StateInfo(b64("Main Menu"), 1, duration = Some(15)))

    val sc3 = StateChangeObj.StateChange(
      deviceId = so.deviceId,
      deviceBinId = None,
      version = so.version,
      auth = so.sys.auth,
      timestamp = so.sys.geotime.timestamp.plusSeconds(3),
      newState = Common.StateInfo(b64("Exit"), 0, duration = None),
      oldState = Common.StateInfo(b64("Game"), 1, duration = Some(56)))

    val randomPreEvents = new Random().nextInt(purchaseTriggerEvents.length)
    val hasPaid = if(new Random().nextFloat() > 0.5) true else false
    val sc4 = EconomyEventObj.EconomyEvent(
      deviceId = so.deviceId,
      deviceBinId = None,
      version = so.version,
      sys = Common.Sys(auth = so.sys.auth, device = so.sys.device, geotime = so.sys.geotime.copy(timestamp = so.sys.geotime.timestamp.plusSeconds(6))),
      state = Common.StateInfo(b64("Game"), 1, duration = None),
      timeline = (if(new Random().nextBoolean()) b64("Lev1") else b64("Lev2")),
      timeOffset = new Random().nextInt(5) + 3,
      paymentAmount = 95,
      itemID = (if(new Random().nextBoolean()) b64("Silver Coins") else b64("Gold Coins")),
      paymentCurrency = None,
      itemAmount = None,
      campaignID = None,
      preEvent = Some(purchaseTriggerEvents(randomPreEvents)),
      preState = Some(purchaseTriggerStates(randomPreEvents))
    )

    val sc5 = EconomyBalanceObj.EconomyBalance(
      deviceId = so.deviceId,
      deviceBinId = None,
      version = so.version,
      auth = so.sys.auth,
      timestamp = so.sys.geotime.timestamp.plusSeconds(7),
      balance = List[EconomyBalanceObj.BalanceItem](
        EconomyBalanceObj.BalanceItem(
          id = b64("Silver Coins"),
          amount = random.nextInt(1000),
          timeline = random.nextInt(10)
        ),
        EconomyBalanceObj.BalanceItem(
          id = b64("Gold Coins"),
          amount = random.nextInt(100),
          timeline = random.nextInt(10)
        ),
        EconomyBalanceObj.BalanceItem(
          id = b64("Wooden Key"),
          amount = random.nextInt(10),
          timeline = random.nextInt(10)
        )
      )
    )

    val exitObj = ExitObj.Exit(so.deviceId, None, so.version, newLength, so.sys.geotime.timestamp.plusSeconds(newLength),
      so.sys.auth, so.sys.geotime.ip, None)

    val stateEvent1 = StateEventObj.StateEvent(so.deviceId, None, so.version, so.sys.auth, so.sys.geotime.timestamp, Common.StateInfo(b64("Game"), 1, duration = None),
      (if(new Random().nextBoolean()) b64("Lev1") else b64("Lev3")), new Random().nextInt(8) + 3, b64("Test Event 1"), Some(b64("data1", "~")), Some(b64("data2", "~")) )

    val stateEvent2 = StateEventObj.StateEvent(so.deviceId, None, so.version, so.sys.auth, so.sys.geotime.timestamp, Common.StateInfo(b64("Game"), 1, duration = None),
      b64("Lev1"), new Random().nextInt(10) + 3, b64("Test Event 2"), Some(b64("data1", "~")), Some(b64("data2", "~")) )

    val sessionEvents = if(hasPaid) List[AnyRef](so, sc1, sc2, sc3, sc4, sc5, exitObj, stateEvent1, stateEvent2) else
      List[AnyRef](so, sc1, sc2, sc3, sc5, exitObj, stateEvent1, stateEvent2)

    if(firstSession) {
      sessionEvents.zipAll(genFirstSession(so),"","").flatMap{ case (a, b) => Seq(a, b) }.filter(_ != "")
    } else
      sessionEvents
  }

  def genNewUser(date: DateTime, app: String, token: String, appVersion: String) : StartObj.Start = {
    val newDevice = PhoneDevice.random()

    Start(
        deviceId = RandomStringUtils.random(8, "0123456789ABCDEF") + "-" + RandomStringUtils.random(4, "0123456789ABCDEF") + "-" + RandomStringUtils.random(4, "0123456789ABCDEF") + "-" +
                  RandomStringUtils.random(4, "0123456789ABCDEF") + "-" + RandomStringUtils.random(12, "0123456789abcdef"),
        deviceBinId = None,
        version = b64(appVersion),
        sys = Common.Sys(
              auth = SysAuth(
                appId = app,
                appToken = token
              ),
              device = Common.SysDevice(
                screen = newDevice.size,
                screen_h = newDevice.screen_h,
                screen_w = newDevice.screen_w,
                vendor = newDevice.vendor,
                locale = "en_US",
                model = newDevice.model,
                carrier = "T-Mobile",
                version = newDevice.version,
                platform = newDevice.platform
              ),
              geotime = Common.SysGeoTime(
                timestamp = date,
                ip = Some(random.nextInt(255).toString + "." + random.nextInt(255) + "." + random.nextInt(255) + "." + random.nextInt(255)),
                geoData = None
              )
        )
      )
  }

  def shutdown() {
    IO(Http).ask(Http.CloseAll)(5.second).await
    loadSystem.shutdown()
  }
}