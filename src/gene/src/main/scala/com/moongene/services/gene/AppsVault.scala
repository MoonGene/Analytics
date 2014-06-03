/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.gene

import akka.actor.{Cancellable, ActorLogging, Actor}
import com.moongene.services.Database
import collection.immutable.HashMap
import reactivemongo.bson.{BSONObjectID, BSONDocument}
import collection.mutable
import concurrent.ExecutionContext.Implicits.global
import akka.contrib.pattern.{DistributedPubSubExtension, DistributedPubSubMediator}
import com.moongene.models.sys.SysAppsVault
import concurrent.duration.Duration
import java.util.concurrent.TimeUnit
import com.moongene.models.sys.SysAppsVault.AppVaultDetails
import org.joda.time.DateTimeZone

/*
  AppsVault is a singleton within the analytics cluster. It keeps track of all applications and
  notifies about any changes all other works.
 */
class AppsVault extends Actor with ActorLogging {
  lazy val appsColl = Database.getCollection("guard", "apps")
  var apps = Map[String, AppVaultDetails]()
  var appsUpdateScheduledEvent: Cancellable = null

  //Subscribe to a global publisher, we need to be aware when new apps are added so we can distribute that across all nodes
  import DistributedPubSubMediator.Publish
  val clusterMediator = DistributedPubSubExtension(context.system).mediator

  override def preStart() {

    //TODO Make this part also scheduled, to make sure that we can always grab the latest even if mongo was down during the start of this actor
    val appsDocsFuture = appsColl.find(BSONDocument(), BSONDocument("_id" -> 1, "token" -> 2, "timezone" -> 3)).cursor[BSONDocument].toList()
    appsDocsFuture.map( appsDocs => {
      log.debug("AppsVault has started. Got " + appsDocs.size + " apps from DB.")
      val mutableAppsMap = mutable.HashMap[String, AppVaultDetails]()
      appsDocs.foreach(d => {
        val appId = d.getAs[BSONObjectID]("_id")
        val appToken = d.getAs[String]("token")
        val appTimezoneS = d.getAs[String]("timezone")
        var appTimezone = DateTimeZone.UTC
        //TODO This has to thought through once again, because with day time savings we might need to update this later
        if(appTimezoneS != None) {
          try {
            appTimezone = DateTimeZone.forID(appTimezoneS.get)
          } catch {
            case e: IllegalArgumentException => appTimezone = DateTimeZone.UTC
          }
        }

        if(appId != None && appToken != None && appTimezone != None)
          mutableAppsMap.put(appId.get.stringify, AppVaultDetails(appToken.get, appTimezoneS.get, appTimezone))
      })

      apps = mutableAppsMap.map(kv => (kv._1,kv._2)).toMap
      log.info("AppsVault apps list has been updated. New size: " + apps.size)

      appsUpdateScheduledEvent = context.system.scheduler.scheduleOnce(Duration.create(3, TimeUnit.SECONDS), self,
        SysAppsVault.SelfCheckUpdateDoc())
    })
  }

  override def postStop() {
    if(appsUpdateScheduledEvent != null) {
      appsUpdateScheduledEvent.cancel()
      appsUpdateScheduledEvent = null
    }
  }

  def receive = {
    case getAppsMsg: SysAppsVault.GetApps => {
      sender ! SysAppsVault.AllAppsMap(apps)
    }

    case checkUpdateDoc: SysAppsVault.SelfCheckUpdateDoc => {
      log.debug("AppsVault - checking update doc...")

      //Just to avoid spamming in case it takes long time to update, we reschedule once DB fetch is done
      val appsUpdateFuture = appsColl.find(BSONDocument("_id" -> "APPSVAULTCHANGES"),
        BSONDocument("_id" -> 1, "new" -> 2, "updated" -> 3, "deleted" -> 4)).one[BSONDocument]

      appsUpdateFuture.map( updateDoc => {
        if(updateDoc != None) {
          val newApps = updateDoc.get.getAs[List[BSONDocument]]("new").getOrElse(List())
          val updatedApps = updateDoc.get.getAs[List[BSONDocument]]("updated").getOrElse(List())
          val deletedApps = updateDoc.get.getAs[List[BSONDocument]]("deleted").getOrElse(List())

          if(newApps.size > 0) {
            log.debug("AppsVault - new apps are available")
            newApps.foreach(a => {
              val newappId = a.getAs[String]("id")
              val newappToken = a.getAs[String]("token")
              val newappTimezoneS = a.getAs[String]("timezone")
              var newappTimezone = DateTimeZone.UTC
              //TODO This has to thought through once again, because with day time savings we might need to update this later
              if(newappTimezoneS != None) {
                try {
                  newappTimezone = DateTimeZone.forID(newappTimezoneS.get)
                } catch {
                  case e: IllegalArgumentException => newappTimezone = DateTimeZone.UTC
                }
              }

              if(newappId != None && newappToken != None && newappTimezone != None && apps.get(newappId.get) == None) {
                apps = apps + (newappId.get -> AppVaultDetails(newappToken.get, newappTimezoneS.get, newappTimezone))
                //TODO Optimize, we may want to send all apps in batch just to make this faster
                clusterMediator ! Publish("AppsVaultUpdate", SysAppsVault.NewApp(newappId.get,
                  AppVaultDetails(newappToken.get, newappTimezoneS.get, newappTimezone)))
              }
            })
          }

          if(updatedApps.size > 0) {
            log.debug("AppsVault - updated apps are available")
            throw new Exception("UpdatedApps are not yet support in AppsVault!")
          }

          if(deletedApps.size > 0) {
            log.debug("AppsVault - deleted apps are available")
            throw new Exception("deletedApps are not yet support in AppsVault!")
          }

          //Now remove all those values from our VAULTCHANGES doc
          if(newApps.size > 0 || updatedApps.size > 0 || deletedApps.size > 0) {
            appsColl.update(BSONDocument("_id" -> "APPSVAULTCHANGES"), BSONDocument(
              "$pullAll" -> BSONDocument(
                "new" -> newApps,
                "updated" -> updatedApps,
                "deleted" -> deletedApps)))}
        }

        appsUpdateScheduledEvent = context.system.scheduler.scheduleOnce(Duration.create(3, TimeUnit.SECONDS), self,
          SysAppsVault.SelfCheckUpdateDoc())
      })
    }
  }

}
