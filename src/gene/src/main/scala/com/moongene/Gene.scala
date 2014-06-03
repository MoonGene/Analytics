/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene

import services.gene.{AppsVault, Gateway}
import services.{Database, MetricsLogger, MetricsListener, ClusterListener}
import akka.actor.{PoisonPill, ActorSystem, Props}
import akka.io.IO
import spray.can.Http
import akka.cluster.ClusterEvent.ClusterDomainEvent
import akka.cluster.Cluster
import akka.contrib.pattern.ClusterSingletonManager

/**
 * Gene Node is an internet facing service that does authorization checks, pre-processes data (e.g. geo data from IP),
 * values validation and more. GeneNode has minimum or now communication at all with the database and designed to do
 * initial filtering of incoming data. Gene is a part of the analytics cluster and works with Core and database.
 */
object Gene extends App {
  implicit val system = ActorSystem("ClusterSystem")

  // Public facing HTTP service
  val httpService = system.actorOf(Props[Gateway], "http-service")

  // Create and initialize the cluster
  val clusterListener = system.actorOf(Props[ClusterListener], name = "cluster-listener")
  Cluster(system).subscribe(clusterListener, classOf[ClusterDomainEvent])

  // Currently listening cluster metrics is not needed
  // val metricsListener = system.actorOf(Props[MetricsListener], name = "cluster-metrics-listener")
  // Cluster(system).subscribe(metricsListener, classOf[ClusterDomainEvent])

  // Create AppsVault singleton - a service that is responsible for keeping track of all apps and
  // notifying all nodes in case of changes (e.g. new security token, new app added)
  system.actorOf(ClusterSingletonManager.props(
    singletonProps = handOverData ⇒ Props[AppsVault],
    singletonName = "app-validator",
    terminationMessage = PoisonPill,
    role = None),
    name = "app-validator-singleton")

  // Log hardware metrics on this node
  val metricsLogger = system.actorOf(Props(classOf[MetricsLogger], "Gene", ""), name = "metrics-logger")

  // Kickstart the HTTP service
  IO(Http) ! Http.Bind(httpService, interface = GeneConfig.serverHost, port = GeneConfig.serverPort)
}