/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.android.utility;

import android.content.Context;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.PackageManager.NameNotFoundException;
import android.Manifest;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.telephony.TelephonyManager;
import android.util.DisplayMetrics;
import android.util.Log;
import android.view.Display;
import android.view.WindowManager;

import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;


/*
    SysInfo: detects hardware capabilities
 */

public class SysInfo {

    public static final String LOGTAG = "MoonGeneAPI";

    //Hardware caps
    private final Context           mContext;
    private final DisplayMetrics    mDisplayMetrics;
    private final String            mVersionName;
    private final Integer           mVersionCode;
    private final Boolean           mNFC;
    private final Boolean           mTelephony;

    public String getVersionName() {
        return mVersionName;
    }

    public Integer getVersionCode() {
        return mVersionCode;
    }

    public boolean getNFC() {
        return mNFC;
    }

    public boolean getTelephony() {
        return mTelephony;
    }

    public DisplayMetrics getDisplayMetrics() {
        return mDisplayMetrics;
    }

    public String getPhoneRadioType() {
        String type = null;

        TelephonyManager manager = (TelephonyManager) mContext.getSystemService(Context.TELEPHONY_SERVICE);
        if (null != manager) {
            switch(manager.getPhoneType()) {
                case 0x00000000: type = "none"; break; // TelephonyManager.PHONE_TYPE_NONE
                case 0x00000001: type = "gsm";  break; // TelephonyManager.PHONE_TYPE_GSM
                case 0x00000002: type = "cdma"; break; // TelephonyManager.PHONE_TYPE_CDMA
                case 0x00000003: type = "sip";  break; // TelephonyManager.PHONE_TYPE_SIP
                default: type = null;
            }
        }

        return type;
    }

    public String getNetworkOperator() {
        TelephonyManager telephonyManager = (TelephonyManager) mContext.getSystemService(Context.TELEPHONY_SERVICE);
        return (null != telephonyManager) ? telephonyManager.getNetworkOperatorName() : null;
    }


    public Boolean getWifiConnected() {
        Boolean res = null;

        if (PackageManager.PERMISSION_GRANTED == mContext.checkCallingOrSelfPermission(Manifest.permission.ACCESS_NETWORK_STATE)) {
            ConnectivityManager connManager = (ConnectivityManager) this.mContext.getSystemService(Context.CONNECTIVITY_SERVICE);
            NetworkInfo wifiInfo = connManager.getNetworkInfo(ConnectivityManager.TYPE_WIFI);
            res = wifiInfo.isConnected();
        }

        return res;
    }

    public SysInfo(Context context) {
        //Save context for further usage
        mContext = context;

        //Extract package version
        PackageManager manager = mContext.getPackageManager();
        Display display = ((WindowManager) mContext.getSystemService(Context.WINDOW_SERVICE)).getDefaultDisplay();
        mDisplayMetrics = new DisplayMetrics();
        display.getMetrics(mDisplayMetrics);

        String pkgName = null;
        Integer pkgCode = null;
        Boolean NFCStatus = null;
        Boolean TelephonyStatus = null;

        try {
            PackageInfo info = manager.getPackageInfo(mContext.getPackageName(), 0);
            pkgName = info.versionName;
            pkgCode = info.versionCode;
        } catch (NameNotFoundException e) {
            Log.w(LOGTAG, "SysInfo context doesn't exist!");
        }

        mVersionName = pkgName;
        mVersionCode = pkgCode;

        //Use reflection to detect some of the capabilities, as they might not exist
        Class<? extends PackageManager> managerClass = manager.getClass();
        Method sysFeatureMethod = null;
        try {
            sysFeatureMethod = managerClass.getMethod("hasSystemFeature", String.class);
            if (sysFeatureMethod != null) {
                try {
                    NFCStatus = (Boolean) sysFeatureMethod.invoke(manager, "android.hardware.nfc");
                    TelephonyStatus = (Boolean) sysFeatureMethod.invoke(manager, "android.hardware.telephony");
                } catch (InvocationTargetException e) {
                    Log.w(LOGTAG, "Failed to invoke hasSystemFeature, may not be supported.");
                } catch (IllegalAccessException e) {
                    Log.w(LOGTAG, "Failed to invoke hasSystemFeature, may not be supported.");
                }
            }
        } catch (NoSuchMethodException e) {
            //not supported
        }

        mNFC = NFCStatus;
        mTelephony = TelephonyStatus;
    }
}
