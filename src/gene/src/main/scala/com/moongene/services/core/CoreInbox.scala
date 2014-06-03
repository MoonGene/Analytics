/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services.core

import akka.actor.{Props, RootActorPath, ActorLogging, Actor}
import akka.cluster.{MemberStatus, Cluster, Member}
import akka.cluster.ClusterEvent.{CurrentClusterState, MemberUp}
import akka.routing.{FromConfig, RoundRobinRouter}
import com.moongene.models.track._
import com.moongene.Core
import com.moongene.models.messages.SysLoad

class CoreInbox extends Actor with ActorLogging {
  val cluster = Cluster(context.system)
  //TODO Should be potentially moved to the config file
  val coreProcessor = context.system.actorOf(Props[CoreProcessor].withRouter(RoundRobinRouter(50)), name = "processor")

  override def preStart() {
    cluster.subscribe(self, classOf[MemberUp])
  }

  override def postStop() {
    cluster.unsubscribe(self)
  }

  // Here we log system load counters and forward messages processing to the
  // core processor workers, which are responsible for processing of various events
  def receive = {
    case so: StartObj.Start => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward so
    }

    case ex: ExitObj.Exit => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward ex
    }

    case sc: StateChangeObj.StateChange => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward sc
    }

    case se: StateEventObj.StateEvent => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward se
    }

    case ee: EconomyEventObj.EconomyEvent => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward ee
    }

    case eb: EconomyBalanceObj.EconomyBalance => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward eb
    }

    case fse: FirstSessionEventObj.FirstSessionEvent => {
      Core.metricsLogger ! SysLoad(1, 0, 1)
      coreProcessor forward fse
    }
  }
}
