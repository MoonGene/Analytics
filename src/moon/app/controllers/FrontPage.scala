/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import play.api.mvc.{Action, Controller}
import models.DataAccess
import play.api.data.Form
import play.api.data.Forms._

/*
  FrontPage:
    - front page functionality
 */

object FrontPage extends Controller with DataAccess {
  val contactUsForm = Form(
    tuple(
      "email" -> nonEmptyText,
      "password" -> nonEmptyText
    )
  )

  def about = Action { implicit request =>
    Ok(views.html.front.about())
  }

  def features = Action { implicit request =>
    Ok(views.html.front.features())
  }
}
