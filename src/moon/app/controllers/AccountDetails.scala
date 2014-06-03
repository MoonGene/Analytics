/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import play.api.mvc.Controller
import play.api.data.Form
import play.api.data.Forms._
import play.api.data.format.Formats._

import models._
import reactivemongo.bson.BSONObjectID
import play.api.data.validation.Constraints._
import scala.Some
import concurrent.{Future, Promise}

/*
  AccountDetails controller:
    - user apps stats
    - user contact details
 */

object AccountDetails  extends Controller with Secured with DataAccess {

  val ContactDetailsForm: Form[ContactDetails] = Form(
    mapping(
      "id" -> (of[String] verifying pattern(
        """[a-fA-F0-9]{24}""".r,
        "constraint.objectId",
        "error.objectId")),
      "firstName" -> nonEmptyText,
      "lastName" -> text,
      "company" -> text,
      "email" -> email,
      "phone" -> optional(text),
      "website" -> optional(text)
    )
    // Binding
    {
      (id, firstName, lastName, company, email, phone, website) => ContactDetails(
        new BSONObjectID(id),
        firstName,
        lastName,
        company,
        email,
        phone,
        website
      )
    }
    // Unbinding
    {
      contactDetails: ContactDetails => Some(
        contactDetails.id.stringify,
        contactDetails.firstName,
        contactDetails.lastName,
        contactDetails.company,
        contactDetails.email,
        contactDetails.phone,
        contactDetails.website
        )
    }
  )

  def settings = IsAuthenticated{ email => request =>
    Async {
      val allAppsFuture = for {
          futureAccount <- accountByEmail(email)
          futureApps <- appsAll(futureAccount.get)
        } yield (futureApps, futureAccount)

      allAppsFuture.map { allApps =>
        val sessionData = getSessionData(request)
        val acc = allApps._2.get
        val form = ContactDetailsForm.fill(new ContactDetails(acc.id.get, acc.firstName, acc.lastName, acc.company,
          acc.email, acc.phone, acc.website))
        Ok(views.html.account.settings(allApps._1, sessionData, allApps._2.get, form))
      }
    }
  }

  def settingsUpdate = IsAuthenticated{ email => implicit request =>
    ContactDetailsForm.bindFromRequest.fold(
      formWithErrors =>
        Async {
          val allAppsFuture = for {
            futureAccount <- accountByEmail(email)
            futureApps <- appsAll(futureAccount.get)
          } yield (futureApps, futureAccount)

          allAppsFuture.map { allApps =>
            val sessionData = getSessionData(request)
            Ok(views.html.account.settings(allApps._1, sessionData, allApps._2.get, formWithErrors))
          }
        },

      contactDetails =>
        Async {
          contactDetailsUpdate(contactDetails).map { _ =>
            Redirect(routes.AccountDetails.settings)
          }
        }
    )
  }
}
