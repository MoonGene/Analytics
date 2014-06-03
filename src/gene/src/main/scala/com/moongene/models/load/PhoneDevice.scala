/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.models.load

import play.api._
import scala.util.Random

case class PhoneDevice(vendor: String,
                       model: String,
                       platform: Byte,
                       version: String,
                       screen_w: Short,
                       screen_h: Short,
                       size: Float,
                       ram: Int)

object PhoneDevice {
  val allDevices = all()

  def random() : PhoneDevice = {
    val rand = new Random(System.currentTimeMillis())
    allDevices(rand.nextInt(allDevices.length))
  }

  def all():List[PhoneDevice] = {
    val allDevices = List(
        PhoneDevice("Acer", "beTouch E110", 1, "1.5",320,240,2.8f,256),
        PhoneDevice("Acer", "Liquid A1 (S100)", 1, "1.6",800,480,3.5f,256),
        PhoneDevice("Acer", "Liquid E", 1, "2.1",800,480,3.5f,512),
        PhoneDevice("Acer", "Liquid E Ferrari", 1, "2.1",800,480,3.5f,512),
        PhoneDevice("Acer", "Acer Liquid Metal", 1, "2.2",800,480,3.6f,512),
        PhoneDevice("Acer", "Acer Stream S110", 1, "2.1",800,480,3.7f,512),
        PhoneDevice("Asus", "Padfone", 1, "4.0",960,540,4.3f,1024),
        PhoneDevice("Asus", "Padfone 2", 1, "4.1",1280,720,4.7f,2048),
        PhoneDevice("HTC", "Dream", 1, "1.6",480,320,3.2f,192),
        PhoneDevice("HTC", "Legend", 1, "2.1",480,320,3.2f,384),
        PhoneDevice("HTC", "Nexus One", 1, "2.2",800,480,3.7f,512),
        PhoneDevice("HTC", "Desire", 1, "2.1",800,480,3.7f,576),
        PhoneDevice("HTC", "Desire HD", 1, "2.2",800,480,4.3f,768),
        PhoneDevice("HTC", "Desire Z", 1, "2.2",800,480,3.7f,512),
        PhoneDevice("HTC", "Desire S", 1, "2.3",800,480,3.7f,768),
        PhoneDevice("HTC", "Incredible S", 1, "2.2",800,480,4.0f,768),
        PhoneDevice("HTC", "Sensation", 1, "2.3",960,540,4.3f,768),
        PhoneDevice("HTC", "Evo 3D", 1, "2.3",960,540,4.3f,1024),
        PhoneDevice("HTC", "Sensation XE", 1, "2.3",960,540,4.3f,768),
        PhoneDevice("HTC", "Sensation XL", 1, "2.3",800,480,4.7f,768),
        PhoneDevice("HTC", "Amaze 4G", 1, "2.3",960,540,4.3f,1024),
        PhoneDevice("HTC", "Vivid", 1, "2.3",960,540,4.5f,1024),
        PhoneDevice("HTC", "One V", 1, "4.0",800,480,3.7f,512),
        PhoneDevice("HTC", "One S", 1, "4.0",960,540,4.3f,1024),
        PhoneDevice("HTC", "One X", 1, "4.0",1280,720,4.7f,1024),
        PhoneDevice("HTC", "Evo 4G LTE", 1, "4.0",1280,720,4.7f,1024),
        PhoneDevice("Karbonn", "A15", 1, "4.0",800,480,4.0f,512),
        PhoneDevice("LG", "Google Nexus 4", 1, "4.2",1280,768,4.7f,2048),
        PhoneDevice("Motorola", "Droid RAZR MAXX", 1, "2.3",960,540,4.3f,1024),
        PhoneDevice("Motorola", "Droid RAZR I", 1, "4.0",960,540,4.3f,1024),
        PhoneDevice("Motorola", "Droid RAZR HD", 1, "4.1",1280,720,4.7f,1024),
        PhoneDevice("Panasonic", "Eluga", 1, "2.3",960,540,4.3f,1024),
        PhoneDevice("Panasonic", "Eluga Power", 1, "4.0",1280,720,5.0f,1024),
        PhoneDevice("Samsung", "Moment", 1, "1.5",480,320,3.2f,256),
        PhoneDevice("Samsung", "Galaxy Ace 2", 1, "2.3",800,480,3.8f,768),
        PhoneDevice("Samsung", "i9000 Galaxy S", 1, "2.3",800,480,4.0f,512),
        PhoneDevice("Sony", "Xperia Z", 1, "4.1",1920,1080,5.0f,2048),
        PhoneDevice("Sony Ericsson", "Xperia X10", 1, "2.1",854,480,4.0f,384),
        PhoneDevice("Cherry Mobile", "Flare", 1, "4.0",800,480,4.0f,512),
        PhoneDevice("Huawei", "U8120 Joy", 1, "2.1",320,240,2.8f,256),
        PhoneDevice("ZTE", "Warp", 1, "2.3.5",854,480,4.3f,512),
        PhoneDevice("Apple", "iPhone 3GS", 2, "6.1.3",480,320,3.5f,256),
        PhoneDevice("Apple", "iPhone 4S", 2, "5.0",960,640,3.5f,512),
        PhoneDevice("Apple", "iPhone 5", 2, "6.0",1136,640,4.0f,1024),
        PhoneDevice("Apple", "iPad 2", 2, "4.3",1024,768,9.7f,512),
        PhoneDevice("Apple", "iPad 3", 2, "5.1",2048,1536,9.7f,1024)
    )
    allDevices
  }
}
