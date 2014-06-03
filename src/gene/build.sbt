name := "core"

version := "1.0"

scalaVersion := "2.10.2"

mainClass := Some("com.gene.core.CoreApp")

resolvers += "Typesafe Repository" at "http://repo.typesafe.com/typesafe/releases/"

resolvers += "Typesafe Repository" at "http://repo.typesafe.com/typesafe/repo/"

resolvers += "Sonata Repository" at "http://oss.sonatype.org/content/repositories/releases/"

//Need for reactivemongo 0.10 snapshot   , that is compiled for akka 2.2
resolvers += "Sonata Snapshots"  at "http://oss.sonatype.org/content/repositories/snapshots/"

//We need version later than 1.2-8 to be compatible with akka 2.2.0 final
resolvers += "Spray Repository" at "http://repo.spray.io"

resolvers += "Spray Nightly Builds" at "http://nightlies.spray.io"

resolvers += "Maven For Random String Utils" at "http://repo1.maven.org/maven2"

seq(com.github.retronym.SbtOneJar.oneJarSettings: _*)

libraryDependencies ++= Seq(
  "com.typesafe.akka"      %%  "akka-actor"   % "2.2.0",
  "com.typesafe.akka"      %%  "akka-testkit" % "2.2.0",
  "com.typesafe.akka"      %%  "akka-remote"  % "2.2.0",
  "com.typesafe.akka"      %%  "akka-cluster" % "2.2.0",
  "com.typesafe.akka"      %%  "akka-slf4j"   % "2.2.0",
  "com.typesafe.akka"      %%  "akka-contrib" % "2.2.0",
  "com.github.nscala-time" %% "nscala-time"   % "0.4.2",
  "io.spray"               %  "spray-can"     % "1.2-20130822",
  "io.spray"               %  "spray-routing" % "1.2-20130822",
  "io.spray"               %  "spray-testkit" % "1.2-20130822",
  "io.spray"               %  "spray-client"  % "1.2-20130822",
  "io.spray"               %% "spray-json"    % "1.2.5",
  "org.fusesource"         %  "sigar"         % "1.6.4",
  "org.reactivemongo"      %% "reactivemongo" % "0.11.0-SNAPSHOT",
  "org.slf4j"              %  "slf4j-api"     % "1.7.2",
  "ch.qos.logback"         % "logback-classic"% "1.0.13",
  "ch.qos.logback"         % "logback-core"   % "1.0.13",
  "org.apache.commons"     % "commons-lang3"  % "3.0",
  "com.maxmind.geoip2"     % "geoip2"         % "0.4.1"
	)

conflictWarning := ConflictWarning.disable

libraryDependencies ++= Seq(
    "com.typesafe.akka"      %%  "akka-agent"   % "2.2.0"
)

lazy val logback = "ch.qos.logback" % "logback-classic" % "1.0.13"