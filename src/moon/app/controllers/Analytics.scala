/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import models.{ DataAccess, MobileApp, Account}

import play.api._
import play.api.mvc._

/*
    Analytics controller:
      - dashboard
      - basic analytics: segmentation, funnels, retention, people, geo
      - intelligent analytics: behavior, economy, marketing, evolution, engineering
 */

object Analytics extends Controller with Secured with DataAccess {

  def index = IsAuthenticated { email => request =>
      Redirect(routes.Analytics.dashboard("all"))
  }

  def dashboard(appId: String) = IsAuthenticated{ email => request =>
    Async {
      val allFutures = for {
          futureAccount <- accountByEmail(email)
          futureApps <- appsAll(futureAccount.get)
        } yield (futureApps, futureAccount)

      allFutures.map { futures =>
        val sessionData = getSessionData(request)
        val selectedApp = appById(appId, futures._1).get
        val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
        Ok(views.html.analytics.dashboard(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, None))
      }
    }
  }

  def basic(friendlyName: String, page: String) = IsAuthenticated{ email => implicit request =>
    Async {
      val allFutures = for {
          futureAccount <- accountByEmail(email)
          futureApps <- appsAll(futureAccount.get)
        } yield (futureApps, futureAccount)

      allFutures.map { futures =>
        val sessionData = getSessionData(request)
        val selectedApp = appById(friendlyName, futures._1).get
        val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
        val locationPath = Some(routes.Analytics.basic("APPID", page).absoluteURL())

        page match {
          case "segmentation" => Ok(views.html.analytics.basic.segmentation(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, locationPath))
          case "funnels" => Ok(views.html.analytics.basic.funnels(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, locationPath))
          case "retention" => Ok(views.html.analytics.basic.retention(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, locationPath))
          case "people" => Ok(views.html.analytics.basic.people(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, locationPath))
          case "geo" => Ok(views.html.analytics.basic.geo(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, locationPath))
        }
      }
    }
  }
  def intelligent(friendlyName: String, category: String, page: String) = IsAuthenticated{ email => implicit request =>
    Async {
      val allFutures = for {
          futureAccount <- accountByEmail(email)
          futureApps <- appsAll(futureAccount.get)
        } yield (futureApps, futureAccount)

      allFutures.map { futures =>
        val sessionData = getSessionData(request)
        val selectedApp = appById(friendlyName, futures._1).get
        val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
        val locationPath = Some(routes.Analytics.intelligent("APPID", category, page).absoluteURL())

        category match {
          case "behavior" => {
            page match {
              case "profile" => Ok(views.html.analytics.intelligent.behavior.profile(selectedAppId, selectedApp, futures._1, "User Profile", futures._2.get, sessionData, locationPath))
              case "appflow" => Ok(views.html.analytics.intelligent.behavior.appflow(selectedAppId, selectedApp, futures._1,"App Flow", futures._2.get, sessionData, locationPath))
              case "firstsession" => Ok(views.html.analytics.intelligent.behavior.firstsession(selectedAppId, selectedApp, futures._1, "First Session", futures._2.get, sessionData, locationPath))
            }
          }
          case "economy" => {
            page match {
              case "profile" => Ok(views.html.analytics.intelligent.economy.profile(selectedAppId, selectedApp, futures._1, "User Profile", futures._2.get, sessionData, locationPath))
              case "economybalance" => Ok(views.html.analytics.intelligent.economy.balance(selectedAppId, selectedApp, futures._1, "Balance", futures._2.get, sessionData, locationPath))
              case "purchasetrigger" => Ok(views.html.analytics.intelligent.economy.trigger(selectedAppId, selectedApp, futures._1, "Purchase Trigger", futures._2.get, sessionData, locationPath))
            }
          }
          case "marketing" => {
            page match {
              case "notification" => Ok(views.html.analytics.intelligent.marketing.page(selectedAppId, selectedApp, futures._1, "Notification", futures._2.get, sessionData, locationPath))
              case "trafficchannels" => Ok(views.html.analytics.intelligent.marketing.page(selectedAppId, selectedApp, futures._1, "Traffic Channels", futures._2.get, sessionData, locationPath))
              case "abtesting" => Ok(views.html.analytics.intelligent.marketing.page(selectedAppId, selectedApp, futures._1, "A/B Testing", futures._2.get, sessionData, locationPath))
            }
          }
          case "evolution" => {
            page match {
              case "timeline" => Ok(views.html.analytics.intelligent.evolution.page(selectedAppId, selectedApp, futures._1, "Timeline", futures._2.get, sessionData, locationPath))
              case "behaviorprofile" => Ok(views.html.analytics.intelligent.evolution.page(selectedAppId, selectedApp, futures._1, "Behavior Profile", futures._2.get, sessionData, locationPath))
              case "economyprofile" => Ok(views.html.analytics.intelligent.evolution.page(selectedAppId, selectedApp, futures._1, "Economy Profile", futures._2.get, sessionData, locationPath))
            }
          }
          case "engineering" => {
            page match {
              case "crashreport" => Ok(views.html.analytics.intelligent.engineering.page(selectedAppId, selectedApp, futures._1, "Crash Report", futures._2.get, sessionData, locationPath))
              case "crashflow" => Ok(views.html.analytics.intelligent.engineering.page(selectedAppId, selectedApp, futures._1, "Crash Flow", futures._2.get, sessionData, locationPath))
              case "deviceprofile" => Ok(views.html.analytics.intelligent.engineering.page(selectedAppId, selectedApp, futures._1, "Device Profile", futures._2.get, sessionData, locationPath))
              case "networkprofile" => Ok(views.html.analytics.intelligent.engineering.page(selectedAppId, selectedApp, futures._1, "Network Profile", futures._2.get, sessionData, locationPath))
            }
          }
        }
      }
    }
  }
}

