/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.services

import akka.cluster.Cluster
import akka.cluster.ClusterEvent.ClusterMetricsChanged
import akka.cluster.ClusterEvent.CurrentClusterState
import akka.cluster.NodeMetrics
import akka.cluster.StandardMetrics.HeapMemory
import akka.cluster.StandardMetrics.Cpu
import akka.actor.{ActorLogging, Actor}

//MetricsListener listens for cluster metric changes that is functionality provided by AKKA framework
class MetricsListener extends Actor with ActorLogging {
  val selfAddress = Cluster(context.system).selfAddress

  override def preStart() {
    Cluster(context.system).subscribe(self, classOf[ClusterMetricsChanged])
  }
  override def postStop() {
    Cluster(context.system).unsubscribe(self)
  }

  def receive = {
    case ClusterMetricsChanged(clusterMetrics) ⇒
      clusterMetrics.filter(_.address == selfAddress) foreach { nodeMetrics ⇒
        logMetrics(nodeMetrics)
      }
    case state: CurrentClusterState ⇒ // ignore
  }

  def logMetrics(nodeMetrics: NodeMetrics) {
    nodeMetrics match {
      case Cpu(address, timestamp, Some(systemLoadAverage), cpuCombined, processors) ⇒
        log.info("[{}] Load: {} ({} processors)", address, systemLoadAverage, processors)

      case HeapMemory(address, timestamp, used, committed, max) ⇒
        log.info("[{}] Used heap: {} MB", address, used.doubleValue / 1024 / 1024)

      case _ ⇒ // no heap or cpu info
    }
  }
}