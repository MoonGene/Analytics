/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package models

import models.AccountAccessLevel._

/*
  Values stored in session
 */
case class SessionData(
  firstName: String,
  lastName: String,
  company: String,
  email: String,
  access: AccountAccessLevel)