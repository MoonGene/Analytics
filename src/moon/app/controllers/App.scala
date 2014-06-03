/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import models.{Account, MobileAppAccess, MobileApp, DataAccess}
import play.api.mvc._
import play.api.data._
import play.api.data.Forms._
import play.api.data.format.Formats._
import play.api.libs.json._
import play.api.data.validation .Constraints ._
import org.joda.time.{DateTimeZone, DateTime}
import org.joda.time.format._
import reactivemongo.bson.BSONObjectID
import concurrent.{Await, Future}
import reactivemongo.core.commands.LastError

/*
  App controller:
    - update App's details
    - manage Apps
 */

object App extends Controller with Secured with DataAccess  {
  val newappForm = Form(
        "appname" -> nonEmptyText
    )

  val AppForm = Form(
    mapping(
      "id" -> optional(of[String] verifying pattern(
        """[a-fA-F0-9]{24}""".r,
        "constraint.objectId",
        "error.objectId")),
      "name" -> nonEmptyText,
      "description" -> default(text, ""),
      "created" -> nonEmptyText,
      "token"  -> nonEmptyText
    ) ((
         id,
         name,
         description,
         created,
         token) =>
      MobileApp(
        id.map(new BSONObjectID(_)),
        name,
        List[MobileAppAccess](),
        false,
        false,
        Option(""),
        description,
        DateTime.parse(created)
      ))
      ((app : MobileApp) => Some(
        (app.id.map(_.stringify)),
        app.name,
        app.description,
        app.created.toString(ISODateTimeFormat.date()),
        app.token
      ))
  )

  val AdminAppForm = Form(
      mapping(
      "id" -> optional(of[String] verifying pattern(
        """[a-fA-F0-9]{6}""".r,
        "constraint.objectId",
        "error.objectId")),
      "name" -> nonEmptyText,
      "suspended" -> boolean,
      "suspensionDetails" -> optional(text),
      "description" -> default(text, ""),
      "created" -> nonEmptyText,
      "token"  -> nonEmptyText
      ) ((
        id,
        name,
        suspended,
        suspensionDetails,
        description,
        created,
        token) =>
          MobileApp(
            id.map(new BSONObjectID(_)),
            name,
            List[MobileAppAccess](),
            suspended,
            false,
            suspensionDetails,
            description,
            DateTime.parse(created)
            ))
        ((app : MobileApp) => Some(
          (app.id.map(_.stringify)),
          app.name,
          app.suspended,
          app.suspensionDetails,
          app.description,
          app.created.toString(ISODateTimeFormat.date()),
          app.token
        ))
  )

  def Create() = IsAuthenticated{ email => implicit request =>
    newappForm.bindFromRequest.fold(
      errors => Ok(Json.obj("code" -> -1, "message" -> "Invalid name.", "fields" -> "")),
      newappName =>
                Async {
                  val name = newappName
                  val appHolder = MobileApp(None, name)

                  val additionResult = for {
                      futureAccount <- accountByEmail(email)
                      appId <- appCreate(futureAccount.get, appHolder.copy(
                        timezone = futureAccount.get.timezone.getOrElse(DateTimeZone.UTC.getID)))
                      if(appId.isDefined)
                      addedToAccount <- appAddToAccount(futureAccount.get, appId.get)
                      addedToVaultUpdate <- appAddToVaultChange("new", appId.get, Some(appHolder.token),
                        Some(futureAccount.get.timezone.getOrElse(DateTimeZone.UTC.getID)))
                    } yield (addedToAccount, futureAccount, appId, addedToVaultUpdate)

                  additionResult.map { res =>
                    if(res._1.ok)
                      Ok(Json.obj(
                        "code" -> 0,
                        "name" -> name,
                        "id" -> res._3.get.toString(),
                        "redirect" -> routes.Analytics.dashboard(res._3.get.stringify).absoluteURL()))
                    else
                    {
                      appDelete(res._2.get, res._3.get)
                      Ok(Json.obj(
                        "code" -> 1,
                        "message" -> "Can't create a new app."))
                    }
                  }
                }
    )
  }

  def integrate(id: String, os: String) = IsAuthenticated{ email => request =>
    Async {
      val allFutures = for {
        futureAccount <- accountByEmail(email)
        futureApps <- appsAll(futureAccount.get)
      } yield (futureApps, futureAccount)

      allFutures.map { futures =>
        val sessionData = getSessionData(request)
        val selectedApp = appById(id, futures._1).get
        val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
        val appForm = AppForm.fill(selectedApp)
        if (id != "all"){
          Ok(views.html.App.integrate(selectedAppId, selectedApp, os, futures._1, futures._2.get, sessionData))
        }
        else{
          NotFound
        }
      }
    }
  }

  /// Gets all settings for the app
  def Get(id: String) = IsAuthenticated{ email => request =>
    Async {
      val allFutures = for {
        futureAccount <- accountByEmail(email)
        futureApps <- appsAll(futureAccount.get)
      } yield (futureApps, futureAccount)

      allFutures.map { futures =>
        val sessionData = getSessionData(request)
        val selectedApp = appById(id, futures._1).get
        val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
        val appForm = AppForm.fill(selectedApp)
        if(id != "all"){
          Ok(views.html.App.index(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, appForm))
        }
        else{
          Ok(views.html.App.all(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData))
        }
      }
    }
  }

  /// Updates all settings for the app
  def Update() = IsAuthenticated{ email => implicit request =>
    AppForm.bindFromRequest.fold(
      formWithErrors =>
        Async {
          val allFutures = for {
            futureAccount <- accountByEmail(email)
            futureApps <- appsAll(futureAccount.get)
          } yield (futureApps, futureAccount)

          allFutures.map { futures =>
            val sessionData = getSessionData(request)
            val selectedApp = appById(formWithErrors("id").value.get, futures._1).get
            val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
              Ok(views.html.App.index(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, formWithErrors))
          }
        },

      mobileApp =>
        Async {
          val allFutures = for {
            futureUpdateVault <- appAddToVaultChange("updated", mobileApp.id.get, Some(mobileApp.token), Some(mobileApp.timezone))
            futureAppUpdate <- appUpdate(mobileApp)
          } yield (futureUpdateVault, futureAppUpdate)

          allFutures.map { _ =>
             Redirect(routes.Analytics.index)
          }
        }
    )
  }

  def AdminUpdate() = IsAuthenticated{ email => implicit request =>
    AppForm.bindFromRequest.fold(
      formWithErrors =>
        Async {
          val allFutures = for {
            futureAccount <- accountByEmail(email)
            futureApps <- appsAll(futureAccount.get)
          } yield (futureApps, futureAccount)

          allFutures.map { futures =>
            val sessionData = getSessionData(request)
            val selectedApp = appById(formWithErrors("id").value.get, futures._1).get
            val selectedAppId = if(selectedApp.id == None) "all" else selectedApp.id.get.stringify
            Ok(views.html.App.index(selectedAppId, selectedApp, futures._1, futures._2.get, sessionData, formWithErrors))
          }
        },

      mobileApp =>
        Async {
          val allFutures = for {
            futureUpdateVault <- appAddToVaultChange("updated", mobileApp.id.get, Some(mobileApp.token), Some(mobileApp.timezone))
            futureAppUpdate <- appUpdate(mobileApp)
          } yield (futureUpdateVault, futureAppUpdate)

          allFutures.map { _ =>
            Redirect(routes.Analytics.index)
          }
        }
    )
  }

  def Delete(id: String) = IsAuthenticated{ email => request =>
    Async {
      val allFutures = for {
        futureAccount <- accountByEmail(email)
        futureApps <- appsAll(futureAccount.get)
      } yield (futureApps, futureAccount)

      allFutures.map { futures =>
        val selectedApp = appById(id, futures._1)
        if (selectedApp != None) {
          Async {
            val futureAccounts = accountAll(selectedApp.get)
            futureAccounts.map{ accounts =>
              if (accounts.size > 1)
                BadRequest
              else {
                val allFutures = for {
                  futureAppDelete <- appDelete(id, futures._2.get)
                  appAddToVaultChange <- appAddToVaultChange("deleted", selectedApp.get.id.get, None, None)
                } yield (futureAppDelete, appAddToVaultChange)

                allFutures.map{ allFuture => {}}

                Redirect(routes.Analytics.index)
              }
            }
          }
        }
        else{
          NotFound
        }
      }
    }
  }

  def generateToken = IsAuthenticated { email => implicit request =>
    Ok(Json.obj("code" -> 0, "token" -> MobileApp.randomToken())).withHeaders(CACHE_CONTROL -> "no-cache")
  }
}