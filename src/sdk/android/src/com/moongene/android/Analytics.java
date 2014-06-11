/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.android;

import com.moongene.android.utility.SysInfo;
import com.moongene.android.utility.Base64Coder;
import org.json.JSONException;
import org.json.JSONObject;

import java.text.DateFormat;
import java.text.SimpleDateFormat;
import java.util.*;
import java.util.concurrent.ArrayBlockingQueue;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.util.DisplayMetrics;
import android.util.Log;

public class Analytics {
    public static final String ANALYTICS_VERSION = "1.0.0";
    private static final String LOGTAG = "MoonGeneAPI";

    private static final DateFormat ENGAGE_DATE_FORMAT = new SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss");
    static {
        ENGAGE_DATE_FORMAT.setTimeZone(TimeZone.getTimeZone("UTC"));
    }

    // Map different instances
    private static final Map<String, Map<Context, Analytics>> instances = new HashMap<String, Map<Context, Analytics>>();

    private final SharedPreferences mStoredPreferences;
    private final Context           mContext;
    private final SysInfo           mSysInfo;
    private final MessagesQueue     mMessages;
    private final String            mAppToken;
    private final String            mAppId;
    private String                  mAppVersion = "";
    private String                  mUserUniqueId;

    private ArrayBlockingQueue<String> purchaseTriggerEventsHistory = new ArrayBlockingQueue<String>(3);
    private ArrayBlockingQueue<String> purchaseTriggerStatesHistory = new ArrayBlockingQueue<String>(3);
    private String      currentStateName = "Start";
    private Integer     currentStateType = 0; //System
    private String      lastEventName = "~";
    private Long        currentStateTime = 0L;
    private Boolean     acceptTracking = true;
    private Boolean     mFirstSession = false;
    private long        appStartTime = 0;
    private long        stateStartTime = 0;
    private long        statePauseStartTime = 0;
    private long        statePauseTime = 0;

    private void calcCurrentStateTime() {
        long sysCurTime = System.currentTimeMillis();
        //Update statePauseTime
        if(statePauseStartTime != 0) {
            statePauseTime += (sysCurTime - statePauseStartTime) / 1000;
            statePauseStartTime = sysCurTime;
        }

        currentStateTime = (sysCurTime - stateStartTime) / 1000 - statePauseTime;
    }

    public void pause() {
        if(statePauseStartTime != 0) return;
        statePauseStartTime = System.currentTimeMillis();
    }

    public void unpause() {
        if(statePauseStartTime == 0) return;
        long sysCurTime = System.currentTimeMillis();
        statePauseTime += (sysCurTime - statePauseStartTime) / 1000;
        statePauseStartTime = 0;
    }

    Analytics(Context context, String appId, String appToken) {
        mContext = context;
        mAppToken = appToken;
        mAppId = appId;
        mSysInfo = getSysInfo();
        mMessages = getAnalyticsMessages();
        mStoredPreferences = context.getSharedPreferences("com.moongene.android.MoonGeneAPI_" + appId, Context.MODE_PRIVATE);
        loadPreferences();

        appStartTime = System.currentTimeMillis();
        stateStartTime = System.currentTimeMillis();
        purchaseTriggerEventsHistory.add(b64(lastEventName));
        purchaseTriggerStatesHistory.add(b64(currentStateName));

        mAppVersion = b64(mSysInfo.getVersionName() == null ? "Unknown" : mSysInfo.getVersionName());
        sessionStart();
    }

    public static Analytics getInstance(Context context, String appId, String appToken) {
        synchronized (instances) {
            Context appContext = context.getApplicationContext();
            //Take into account token as well, normally it would be just one instance
            Map <Context, Analytics> instances = Analytics.instances.get(appId + appToken);
            if (instances == null) {
                instances = new HashMap<Context, Analytics>();
                Analytics.instances.put(appToken, instances);
            }
            Analytics instance = instances.get(appContext);
            if (instance == null) {
                instance = new Analytics(appContext, appId,  appToken);
                instances.put(appContext, instance);
            }
            return instance;
        }
    }

    MessagesQueue getAnalyticsMessages() {
        return MessagesQueue.getInstance(mContext);
    }

    private long utcCurTime() {
        //According to the documentation this is already UTC
        return System.currentTimeMillis();
    }

    private String b64(String in) {
        return Base64Coder.encodeString(in);
    }

    public void sessionExit() {
        if(!acceptTracking) return;

        //Notify that we are now finishing the session
        stateChange("Exit", 0);
        acceptTracking = false;

        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackSessionExit");
        try {
            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "exit");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("sessionLength", (System.currentTimeMillis() - appStartTime) / 1000 ); //we need to pass sseconds
            dataObj.put("auth", getSysAuthProperties());
            dataObj.put("timestamp", utcCurTime());

            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackSessionExit. ", e);
        }

        flush();
    }

    private void sessionStart() {
        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackSessionStart");

        try {
            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "start");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("sys", getSysProperties());

            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackSessionStart. ", e);
        }

        //We don't add this event to history because it is the default one
    }

    private void addEventHistory(String state, String event) {
        addEventHistory(state, event, 1);
    }

    private void addEventHistory(String state, String event, Integer stateType) {
        //We track 3 last events for purchase trigger
        if(!event.equals("~") && !event.equals("")) {
            purchaseTriggerEventsHistory.add(b64(event));
            purchaseTriggerStatesHistory.add(b64(state));
        }

        //and the whole history of the first session, if this is the first session
        //then let's generate a first session event
        if(mFirstSession)
            firstSession(currentStateName, currentStateType, lastEventName, state, stateType, event);

        lastEventName = event;
    }

    public void stateChange(String stateName) {
        stateChange(stateName, 1);
    }

    private void stateChange(String stateName, Integer type) {
        if(!acceptTracking) return;
        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackStateChange");
        calcCurrentStateTime();
        addEventHistory(stateName, "~", type);

        try {
            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "statechange");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("auth", getSysAuthProperties());
            dataObj.put("timestamp", utcCurTime());
            dataObj.put("newState", getStateInfoProperties(stateName, type));
            //We don't allow previous state to be 0
            dataObj.put("oldState", getStateInfoProperties(currentStateName, currentStateType, currentStateTime));
            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackStateChange. ", e);
        }

        //Update our current state with the new data
        currentStateName = stateName;
        currentStateType = 1;
        currentStateTime = 0L;
        stateStartTime = System.currentTimeMillis();
        statePauseTime = 0;
    }

    public void stateEvent(String event) {
        stateEvent(event, "Default");
    }

    public void stateEvent(String event, String timeline) {
        stateEvent(event, timeline, "", "");
    }

    public void stateEvent(String event, String timeline, String data1) {
        stateEvent(event, timeline, data1, "");
    }

    public void stateEvent(String event, String timeline, String data1, String data2) {
        if(!acceptTracking) return;
        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackStateEvent");
        calcCurrentStateTime();
        //Save also this event in the list of pre-purchase events
        addEventHistory(currentStateName, event, 1);

        try {
            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "stateevent");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("auth", getSysAuthProperties());
            dataObj.put("timestamp", utcCurTime());
            dataObj.put("state", getStateInfoProperties(currentStateName, currentStateType, currentStateTime));
            dataObj.put("timeline", b64(timeline));
            dataObj.put("timeOffset", currentStateTime);
            dataObj.put("event", b64(event));
            dataObj.put("data1", b64(!data1.equals("") ? data1 : "~"));
            dataObj.put("data2", b64(!data2.equals("") ? data2 : "~"));

            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackStateEvent. ", e);
        }
    }

    public void economyEvent(Long paymentAmount, String itemID) {
        economyEvent(paymentAmount, itemID, 1L);
    }

    public void economyEvent(Long paymentAmount, String itemID, Long itemAmount) {
        economyEvent(paymentAmount, itemID, itemAmount, "");
    }

    public void economyEvent(Long paymentAmount, String itemID, Long itemAmount, String campaign) {
        economyEvent(paymentAmount, itemID, itemAmount, campaign, "Default");
    }

    public void economyEvent(Long paymentAmount, String itemID, Long itemAmount, String campaign, String timeline) {
        if(!acceptTracking) return;
        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackEconomyEvent");
        calcCurrentStateTime();
        addEventHistory(currentStateName, "Purchase", 1);

        try {
            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "economyevent");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("sys", getSysProperties());
            dataObj.put("timestamp", utcCurTime());

            //When and where happened
            dataObj.put("state", getStateInfoProperties(currentStateName, currentStateType, currentStateTime));
            dataObj.put("timeline", b64(timeline));
            dataObj.put("timeOffset", currentStateTime);

            //Purchase info
            dataObj.put("paymentAmount", paymentAmount);
            //dataObj.put("paymentCurrency", "USD");
            dataObj.put("itemID", b64(itemID));
            dataObj.put("campaignID", b64(!campaign.equals("") ? campaign : "~"));

            //Purchase trigger data
            dataObj.put("preEvent", purchaseTriggerEventsHistory.toArray());
            dataObj.put("preState", purchaseTriggerStatesHistory.toArray());

            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackEconomyEvent. ", e);
        }
    }

    public void economyBalance(EconomyBalanceItem[] balances) {
        economyBalance(balances, 0);
    }

    public void economyBalance(EconomyBalanceItem[] balances, Integer timeline) {
        if(!acceptTracking) return;
        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackEconomyBalance");

        try {
            List<JSONObject> jsonBalances = new ArrayList<JSONObject>(balances.length);
            for(int i = 0; i < balances.length; ++i)
                jsonBalances.add(getBalanceItemProperties(
                        b64(balances[i].id),
                        balances[i].amount,
                        timeline
                ));

            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "economybalance");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("auth", getSysAuthProperties());
            dataObj.put("timestamp", utcCurTime());
            dataObj.put("balance", jsonBalances.toArray());

            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackEconomyBalance. ", e);
        }
    }

    private void firstSession(String fromState, Integer fromStateType, String fromEvent, String toState, Integer toStateType, String toEvent) {
        if(!acceptTracking) return;
        if(AnalyticsConfig.DEBUG) Log.d(LOGTAG, "trackFirstSession");

        try {
            JSONObject dataObj = new JSONObject();
            dataObj.put("type", "firstsession");
            dataObj.put("deviceId", mUserUniqueId);
            dataObj.put("version", mAppVersion);
            dataObj.put("auth", getSysAuthProperties());
            dataObj.put("timestamp", utcCurTime());

            dataObj.put("fromState", getStateInfoProperties(fromState, fromStateType));
            dataObj.put("fromEvent", b64(fromEvent));
            dataObj.put("toState", getStateInfoProperties(toState, toStateType));
            dataObj.put("toEvent", b64(toEvent));

            mMessages.event(dataObj);
        } catch (JSONException e) {
            Log.e(LOGTAG, "Exception in trackFirstSession. ", e);
        }
    }

    public void flush() {
        if (AnalyticsConfig.DEBUG) {
            Log.d(LOGTAG, "flushEvents");
        }
        mMessages.pushToServer();
    }

    public String getUserUniqueId() {
        return mUserUniqueId;
     }

    private JSONObject getStateInfoProperties(String name, Integer type) throws JSONException {
        return getStateInfoProperties(name, type, 0L);
    }

    private JSONObject getStateInfoProperties(String name, Integer type, Long duration) throws JSONException {
        JSONObject res = new JSONObject();
        res.put("name", b64(name));
        res.put("stType", type);
        if(duration > 0L)
            res.put("duration", duration);
        return res;
    }

    private JSONObject getBalanceItemProperties(String id, Long amount, Integer timeline) throws JSONException {
        JSONObject res = new JSONObject();
        res.put("id", id);
        res.put("amount", amount);
        res.put("timeline", timeline);
        return res;
    }


    interface InstanceProcessor {
        public void process(Analytics m);
    }

    static void allInstances(InstanceProcessor processor) {
        synchronized (instances) {
            for (Map<Context, Analytics> contextInstances: instances.values()) {
                for (Analytics instance:contextInstances.values()) {
                    processor.process(instance);
                }
            }
        }
    }

    SysInfo getSysInfo() {
        return new SysInfo(mContext);
    }

    private JSONObject getSysProperties() throws JSONException {
        JSONObject res = new JSONObject();
        res.put("auth", getSysAuthProperties());
        res.put("device", getSysDeviceProperties());
        res.put("geotime", getSysGeoData());
        return res;
    }

    private JSONObject getSysAuthProperties() throws JSONException {
        JSONObject res = new JSONObject();

        res.put("appId", mAppId);
        res.put("appToken", mAppToken);
        return res;
    }

    private JSONObject getSysGeoData() throws JSONException {
        JSONObject res = new JSONObject();
        res.put("timestamp", utcCurTime());
        return res;
    }

    private JSONObject getSysDeviceProperties() throws JSONException {
        JSONObject res = new JSONObject();

        res.put("platform", 1);
        res.put("version", Build.VERSION.RELEASE == null ? "Unknown" : Build.VERSION.RELEASE);

        String carrier = mSysInfo.getNetworkOperator();
        res.put("carrier", null != carrier ? carrier : "Unknown");
        res.put("vendor", Build.BRAND == null ? "Unknown" : Build.BRAND.toUpperCase());
        res.put("model", Build.MODEL == null ? "Unknown" : Build.MODEL);

        DisplayMetrics displayMetrics = mSysInfo.getDisplayMetrics();
        res.put("screen_h", displayMetrics.heightPixels);
        res.put("screen_w", displayMetrics.widthPixels);
        double x = Math.pow(displayMetrics.widthPixels/displayMetrics.xdpi,2);
        double y = Math.pow(displayMetrics.heightPixels/displayMetrics.ydpi,2);
        double screenInches = Math.sqrt(x+y);
        res.put("screen", screenInches);
        res.put("locale", Locale.getDefault().toString());
        return res;
    }

    void resetPreferences() {
        SharedPreferences.Editor prefsEdit = mStoredPreferences.edit();
        prefsEdit.clear().commit();
        loadPreferences();
    }

    private void loadPreferences() {
        mUserUniqueId = mStoredPreferences.getString("userUniqueId", null);

        if (mUserUniqueId == null) {
            mUserUniqueId = UUID.randomUUID().toString();
            savePreferences();
        }

        String firstSessionMarker = mStoredPreferences.getString("firstSession", null);
        if(firstSessionMarker == null) {
            mFirstSession = true;
            savePreferences();
        }
    }

    private void savePreferences() {
        SharedPreferences.Editor prefsEditor = mStoredPreferences.edit();
        prefsEditor.putString("userUniqueId", mUserUniqueId);
        if(mFirstSession) prefsEditor.putString("firstSession", "yes");
        prefsEditor.commit();
    }
} 