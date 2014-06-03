/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import models.{AccountAccessLevel, DataAccess}

import play.api._
import play.api.mvc._
import concurrent.{Future, Promise}
import org.joda.time.DateTime

/*
  Admin controller:
    - health metrics' graphs
    - users management
    - apps management
 */
object Admin extends Controller with DataAccess with Secured {
  def health = IsAccountAccessLevel(AccountAccessLevel.Admin) { email => request =>
    Async {
      accountByEmail(email).map( acc => {
        Ok(views.html.admin.health(acc.get, getSessionData(request)))
      })
    }
  }

  def users = IsAccountAccessLevel(AccountAccessLevel.Admin) { email => request =>
    Async {
      accountByEmail(email).map( acc => {
        Ok(views.html.admin.users(acc.get, getSessionData(request)))
      })
    }
  }

  def apps = IsAccountAccessLevel(AccountAccessLevel.Admin) { email => request =>
    Async {
      accountByEmail(email).map( acc => {
        Ok(views.html.admin.apps(acc.get, getSessionData(request)))
      })
    }
  }
}