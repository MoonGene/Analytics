/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services

import akka.actor.{ActorLogging, Actor}
import akka.cluster.ClusterEvent._
import akka.cluster.ClusterEvent.MemberUp
import akka.cluster.ClusterEvent.MemberExited
import akka.cluster.ClusterEvent.LeaderChanged
import akka.cluster.ClusterEvent.RoleLeaderChanged
import akka.cluster.ClusterEvent.UnreachableMember
import akka.cluster.ClusterEvent.CurrentClusterState
import akka.cluster.ClusterEvent.ClusterMetricsChanged
import akka.cluster.ClusterEvent.MemberRemoved

class ClusterListener extends Actor with ActorLogging {
  def receive = {
    case state: CurrentClusterState ⇒
      log.info("Current members: {}", state.members.mkString(", "))
    case MemberExited(member) ⇒
      log.info("Member exited: {}", member)
    case MemberUp(member) ⇒
      log.info("Member is Up: {}", member)
    case MemberRemoved(member, previousStatus) ⇒
      log.info("Member removed: {} after {}", member, previousStatus)
    case UnreachableMember(member) ⇒
      log.info("Member detected as unreachable: {}", member)
    //case ClusterMetricsChanged(nodeMetrics) ⇒
    //  log.info("Cluster metrics changed: {}", nodeMetrics)
    case RoleLeaderChanged(role, leader) ⇒
      log.info("Role leader changed: {}", role, leader)
    case LeaderChanged(leader) ⇒
      log.info("Leader changed: {}", leader)
    case _: ClusterDomainEvent ⇒ // ignore
      }
}
