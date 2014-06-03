/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package controllers

import _root_.models._

import _root_.models.SessionData
import play.api._
import play.api.mvc._
import play.api.data._
import play.api.data.Forms._
import scala.concurrent.Promise
import scala.util.Random
import play.api.libs.json._
import com.github.nscala_time.time.Imports._
import reactivemongo.bson.BSONObjectID
import scala.Some
import services.{EmailMessage, EmailService}

/*
  Auth controller:
    - authorization: login and logout
    - registration: signup
    - password management: forgot, reset, etc.
 */

object Auth extends Controller with DataAccess {

  val randGenerator = new Random(new java.security.SecureRandom())

  val loginForm = Form(
    tuple(
      "email" -> nonEmptyText,
      "password" -> nonEmptyText,
      "remember" -> boolean
    )
  )

  val signupForm = Form(
    tuple(
      "email" -> nonEmptyText,
      "password" -> nonEmptyText,
      "firstName" -> nonEmptyText,
      "lastName" -> nonEmptyText,
      "company" -> text,
      "timezone" -> optional(text)
    )
  )

  val forgotPasswordForm = Form(
    single(
      "email" -> nonEmptyText
    )
  )

  def login = Action { implicit request =>
      loginForm.bindFromRequest.fold(
      errors => Ok(Json.obj("code" -> -1, "message" -> "Invalid email or password.", "fields" -> "")),
      auth =>
        Async{
          val futureAcc = accountByEmail(auth._1)

          for {
            maybeAccount <- futureAcc
            result <- Promise.successful(maybeAccount.map { account =>
              val loginPassHash = hashifyPassword(auth._2, account.salt)

              if (loginPassHash != account.pass)
                Ok(Json.obj("code" -> 1, "message" -> "Password or login is incorrect.", "fields" -> ""))
              else
              {
                if (account.suspended)
                  Ok(Json.obj("code" -> 2, "message" -> "Your account has been suspended. Contact support.", "fields" -> ""))
                else
                {
                  //Update account login date
                  val newLoginToken = randomToken(account)
                  val tokensList = (account.tokens :+ newLoginToken).takeRight(5)
                  val rememberTime = if(auth._3 == true) Some(2592000) else None
                  accountUpdateLoginDate(account.copy(tokens = tokensList), DateTime.now, updateTokens = (rememberTime != None))

                  Ok(Json.obj("code" -> 0, "message" -> "Login successful.", "fields" -> "", "redirect" -> routes.Analytics.index().absoluteURL())
                    ).withSession("email" -> account.email,
                                  "first_name" -> account.firstName,
                                  "last_name" -> account.lastName,
                                  "company" -> account.company,
                                  "access" -> account.accessLevel.toString
                    ).withCookies(Cookie("login_token", newLoginToken, rememberTime), //One month expiration time,
                                  Cookie("login_email", account.email, rememberTime)) //we want people to reenter it occasionally

                }
              }
            }).future

          } yield result.getOrElse(Ok(Json.obj("code" -> 3, "message" -> "Password or login is incorrect.", "fields" -> "")))
        }
    )
  }

  def signup = Action { implicit request =>
      signupForm.bindFromRequest.fold(
      errors => Ok(Json.obj("code" -> -1, "message" -> "Invalid values entered. Please correct to proceed.", "fields" -> "")),
      auth =>
        Async{
          for {
            maybeAccount <- accountByEmail(auth._1)
            result <- Promise.successful(maybeAccount.map { account =>
              Ok(Json.obj("code" -> 1, "message" -> "Account associated with this email already exists.", "fields" -> ""))
            }).future
          } yield result.getOrElse {

          //No account exists for this email, let's create a new one
          val newSalt = randomSalt()
          val passwordHash = hashifyPassword(auth._2, newSalt)
          val newAcc = Account(
              id = None,
              firstName = auth._3,
              lastName = auth._4,
              company = auth._5,
              email = auth._1.toLowerCase,
              phone = None,
              website = None,
              timezone = auth._6,
              pass = passwordHash,
              salt = newSalt,
              suspended = false,
              suspensionDetails = None,
              key = randomAccountKey(),
              accessLevel = AccountAccessLevel.User,
              created = DateTime.now,
              lastLogin = DateTime.now,
              apps = List[BSONObjectID](),
              tokens = List[String](randomToken(passwordHash, auth._1.toLowerCase)),
              segments = None
            )

            Async {
              val futureRes = accountCreate(newAcc)
              for {
                maybeRes <- futureRes
                res <- Promise.successful(
                  {
                    if (maybeRes == true) {
                      val rememberTime = if(auth._3 == true) Some(2592000) else None
                      Ok(Json.obj("code" -> 0, "message" -> "Signup successful.", "fields" -> "", "redirect" -> routes.Analytics.index().absoluteURL())
                        ).withSession("email" -> newAcc.email,
                                      "first_name" -> newAcc.firstName,
                                      "last_name" -> newAcc.lastName,
                                      "company" -> newAcc.company,
                                      "access" -> newAcc.accessLevel.toString
                        ).withCookies(Cookie("login_token", newAcc.tokens(0), Some(2592000)), //One month expiration time,
                                      Cookie("login_email", newAcc.email, Some(2592000))) //we want people to reenter it occasionally
                    }
                    else
                      Ok(Json.obj("code" -> 2, "message" -> "Can't create an account. Please try again later.", "fields" -> ""))
                  }
                ).future
              } yield res
            }
          }
        }
    )
  }

  def signout = Action { implicit request =>
    val tokenCookie = request.cookies.get("login_token")
    val emailCookie = request.cookies.get("login_email")
    if(tokenCookie != None && emailCookie != None)
      accountDeleteTokenByEmail(emailCookie.get.value, tokenCookie.get.value)

    Redirect(routes.Application.index())
      .withNewSession
      .discardingCookies(DiscardingCookie("login_email"), DiscardingCookie("login_token"))
      .flashing("success" -> "You've been logged out.")
  }

  def forgotPassword = Action { implicit request =>
    Ok(views.html.forgotPassword(forgotPasswordForm.fill(""), false))
  }

  def sendResetPasswordLink = Action { implicit request =>
      forgotPasswordForm.bindFromRequest().fold(
        formWithErrors => {
          Ok(views.html.forgotPassword(formWithErrors, false))
        },
        email => {
          Async {
            val futureAccount = accountByEmail(email)
            for {
              maybeAccount <- futureAccount
              result <- Promise.successful(maybeAccount.map(account => {
                val time = DateTime.now.getMillis + (1000 * 60 * 30) // half an hour
                val link = routes.Auth.resetPassword(account.email, randomToken(account.pass, account.email, time), time).absoluteURL()

                val content = "Follow <a href='" + link + "'>this link</a> to reset your password."
                EmailService.sendEmail(EmailMessage(email, "mg-support@moongene.com", null, null, "Password Reset", content, null))
                Ok(views.html.forgotPassword(forgotPasswordForm.fill(email), true))
              })).future
            } yield result.getOrElse({
              val form = forgotPasswordForm.fill(email)
              Ok(views.html.forgotPassword(form.withError("email", "No user with such email found"), false))
            })
          }
        }
      )
  }

  def resetPassword(email: String, hash: String, time: Long) = Action {
    Async {
      val futureAccount = accountByEmail(email)
      for {
        maybeAccount <- futureAccount
        result <- Promise.successful(maybeAccount.map(account => {
          val token = randomToken(account.pass, account.email, time)
          if (token.equals(hash) && (time - DateTime.now.getMillis) < (1000 * 60 * 30)) { // half an hour
              val password = randomSalt().substring(0, 8)
              val passwordHash = hashifyPassword(password, account.salt)
              accountUpdatePassword(account, passwordHash)
              Ok(views.html.resetPassword(password, true))
          } else {
            Ok(views.html.resetPassword("", false))
          }
        })).future
      } yield result.getOrElse({
        Ok(views.html.resetPassword("", false))
      })
    }
  }

  def hashifyPassword(pass: String, salt: String) : String = {
    val md = java.security.MessageDigest.getInstance("SHA-1")
    md.digest((pass + salt).getBytes("UTF-8")).map("%02x".format(_)).mkString
  }

  def randomSalt() = randGenerator.alphanumeric.take(32).mkString
  def randomAccountKey() = randGenerator.alphanumeric.take(5).mkString + System.currentTimeMillis()

  def randomToken(pass: String, email: String, time: Long = DateTime.now.getMillis) : String = {
    val md = java.security.MessageDigest.getInstance("SHA-1")
    md.digest((pass + email + time).getBytes("UTF-8")).map("%02x".format(_)).mkString
  }

  def randomToken(acc: Account) : String = randomToken(acc.pass, acc.email).toLowerCase
}


/*
  Secured is an utility trail that helps checking user's status, level, etc.
 */
trait Secured {
  private def email(request: RequestHeader) = request.session.get("email")
  private def onUnauthorized(request: RequestHeader) = Results.Redirect(routes.Application.index)

  def IsAuthenticated(f: => String => Request[AnyContent] => Result) =
    Security.Authenticated(email, onUnauthorized) { user =>
    Action(request => f(user)(request))
  }

  def getSessionData(request: Request[AnyContent]) : SessionData = {
    SessionData(request.session.get("first_name").get,
                request.session.get("last_name").get,
                request.session.get("company").get,
                request.session.get("email").get,
                AccountAccessLevel.levelFromStr(request.session.get("access").get))
  }

  import AccountAccessLevel._
  def IsAccountAccessLevel(level: AccountAccessLevel)(f: => String => Request[AnyContent] => Result) = IsAuthenticated { user => request =>
    if(getSessionData(request).access == level) {
        f(user)(request)
    } else {
      Results.Forbidden("You are not authorized to view this page.")
    }
  }
}