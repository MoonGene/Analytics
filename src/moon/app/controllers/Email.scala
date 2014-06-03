/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import play.api.mvc.{Action, Controller}
import services.{EmailService, EmailMessage}
import play.api.data._
import play.api.data.Forms._
import org.apache.commons.codec.digest.DigestUtils
import play.api.libs.json.Json
import play.api.Play

/*
  Email controller:
    - send emails
 */
object Email extends Controller {
  val secretKey = Play.current.configuration.getString("application.secretKey").getOrElse("")

  val form: Form[EmailMessage] = Form(
    mapping(
      "to" -> nonEmptyText,
      "from" -> nonEmptyText,
      "replyTo" -> optional(text),
      "cc" -> optional(text),
      "topic" -> nonEmptyText,
      "body" -> nonEmptyText,
      "template" -> optional(text)
    )(EmailMessage.apply)(EmailMessage.unapply)
  )

  def send(hash: String) = Action { implicit request =>
    form.bindFromRequest.fold(
      formWithErrors => BadRequest,
      message => {
        if (!hash.equals(DigestUtils.md5Hex(message.to + secretKey))) {
          Unauthorized(Json.obj("code" -> 1, "message" -> "Unauthorized"))
        } else {
          EmailService.sendEmail(message)
          Ok
        }
      }
    )
  }
}
