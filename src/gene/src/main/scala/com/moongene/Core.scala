/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene

import akka.actor._
import akka.cluster.Cluster
import akka.cluster.ClusterEvent._
import services.core.CoreInbox
import services.{MetricsLogger, ClusterListener}

/**
 * Core Node works with pre-baked data and does no security or validness checks. The main purpose
 * is to place data in DB and potentially do some delayed process or extra analytics. Core is a part
 * of the analytics cluster and works with Gene and database.
 */
object Core extends App {
  implicit def ec = concurrent.ExecutionContext.Implicits.global
  implicit val system = ActorSystem("ClusterSystem")

  // Inbox to which events will be coming from Gene Nodes.
  val coreInbox = system.actorOf(Props[CoreInbox], name = "core-inbox")

  // Initialize a cluster
  val clusterListener = system.actorOf(Props[ClusterListener], name = "cluster-listener")
  Cluster(system).subscribe(clusterListener, classOf[ClusterDomainEvent])

  // Log hardware state on this CoreNode
  val metricsLogger = system.actorOf(Props(classOf[MetricsLogger], "Core", ""), name = "metrics-logger")
}


