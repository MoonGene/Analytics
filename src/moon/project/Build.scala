import sbt._
import Keys._
import play.Project._

object ApplicationBuild extends Build {

  val appName         = "moon"
  val appVersion      = "1.0.5-SNAPSHOT"

  val appDependencies = Seq(

    "com.github.nscala-time" %% "nscala-time" % "0.4.2",
    "org.reactivemongo" %% "play2-reactivemongo" % "0.9",
    "org.apache.commons" % "commons-email" % "1.3.2",
    "org.xhtmlrenderer" % "core-renderer" % "R8",
    "net.sf.jtidy" % "jtidy" % "r938"
  )

  val main = play.Project(appName, appVersion, appDependencies).settings(
    //resolvers += "Sonatype Snapshots" at "http://oss.sonatype.org/content/repositories/snapshots/"
  )
}
