/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package services

import org.xhtmlrenderer.pdf.ITextRenderer
import java.io.{StringReader, StringWriter, ByteArrayOutputStream}
import org.w3c.tidy.Tidy

/*
  PdfService helper to create PDF documents from HTML
 */
object PdfService {
  def generatePdf(content: String) : Array[Byte] = {
    val os = new ByteArrayOutputStream()

    val renderer = new ITextRenderer()
    renderer.setDocumentFromString(tidify(content))
    renderer.layout()
    renderer.createPDF(os)

    os.toByteArray;
  }

  def tidify(body: String) : String = {
    val tidy = new Tidy()
    tidy.setXHTML(true)
    val writer = new StringWriter()
    tidy.parse(new StringReader(body), writer)

    writer.getBuffer().toString()
  }
}