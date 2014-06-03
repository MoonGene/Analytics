/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

trait ExecutionTrait {
  import scala.concurrent.ExecutionContext

  object Implicit {
     implicit val ec: ExecutionContext = ExecutionContext.Implicits.global
  }
}