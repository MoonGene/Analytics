import java.io.File
import play.api._
import play.api.mvc.Results._
import com.typesafe.config.ConfigFactory
import mvc.{Result, RequestHeader}

object Global extends GlobalSettings {
  override def onLoadConfig(config: Configuration, path: File, classloader: ClassLoader, mode: Mode.Mode): Configuration = {
    val modeSpecificConfig = config ++ Configuration(ConfigFactory.load(s"application.${mode.toString.toLowerCase}.conf"))
    super.onLoadConfig(modeSpecificConfig, path, classloader, mode)
  }

  override def onHandlerNotFound(request: RequestHeader): Result = {
    NotFound(
      views.html.notFound()
    )
  }
}