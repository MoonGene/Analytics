/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import concurrent.Future
import reactivemongo.core.commands.LastError
import com.moongene.Core
import com.moongene.models.messages.DBLoad

//Utility trait to catch results from DB queries and approriately decrement current load and check for errors
trait MetricsHelper extends ExecutionTrait {
  import Implicit._
  def dbCallMetric(call: Future[LastError], lastErrorCheck: Boolean = true, recoverCheck: Boolean = true) = {
    Core.metricsLogger ! DBLoad(out = 1, cur = 1)
    call.map({ lastError =>
      Core.metricsLogger ! DBLoad(cur = -1, err = if (!lastError.ok && lastErrorCheck) 1 else 0)
    }).recover {
      case _ => if(recoverCheck) { Core.metricsLogger ! DBLoad(cur = -1, err = 1) }
    }
  }
}
