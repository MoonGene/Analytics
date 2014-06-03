/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import play.api.mvc._
import services.PdfService

import play.api.data.Form
import play.api.data.Forms._
import models.DataAccess

/*
  Utils controller:
    - generates invoice PDF on request
    - subscribe users to various subscription lists
 */
object Utils extends Controller with DataAccess  {
  val targetForm = Form(
    single(
      "target" -> nonEmptyText
    )
  )

  val subscribeForm = Form (
    tuple(
      "email" -> nonEmptyText,
      "code" -> nonEmptyText,
      "name" -> optional(text)
    )
  )

  def pdf() = Action { implicit request =>
    targetForm.bindFromRequest().fold(
      formWithErrors => {
        BadRequest
      },
      target => {
        Ok(PdfService.generatePdf(target)).as("application/pdf")
      }
    )
  }

  def subscribe() = Action { implicit request =>
    subscribeForm.bindFromRequest().fold(
      formWithErrors => {
        BadRequest
      },
      info => {
        subscribeUser(info._3, info._1, info._2)
        Ok("")
      }
    )
  }
}