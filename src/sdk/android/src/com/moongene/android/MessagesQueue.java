/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.android;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.SynchronousQueue;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import android.os.Message;
import android.util.Log;

import org.json.JSONObject;

/*
    MessagesQueue: a queue that sends events to the server in a separate thread
 */
class MessagesQueue {
    private static final String LOGTAG = "MoonGeneAPI";

    // Thread control constants
    private static int ADD_EVENT =              0; // add JSON event to DB
    private static int FLUSH_QUEUE =            1; // send out events to sserver

    private final QueueWorker   mWorker;
    private final Context       mContext;

    //Similar to Analytics, manage multiple instances if needed, though normally for a game it would be just one
    private static final Map<Context, MessagesQueue> instances = new HashMap<Context, MessagesQueue>();

    //Normally main activity is used as a context parameter
    public static MessagesQueue getInstance(Context context) {
        synchronized (instances) {
            Context appContext = context.getApplicationContext();
            MessagesQueue res;
            if (! instances.containsKey(appContext)) {
                if (AnalyticsConfig.DEBUG) {
                    Log.d(LOGTAG, "Create a new instances of MessagesQueue. Context: " + appContext);
                }
                res = new MessagesQueue(appContext);
                instances.put(appContext, res);
            }
            else {
                if (AnalyticsConfig.DEBUG) {
                    Log.d(LOGTAG, "Returning an existing instance of MessagesQueue. Context: " + appContext);
                }
                res = instances.get(appContext);
            }
            return res;
        }
    }

    MessagesQueue(Context context) {
        mContext = context;
        mWorker = new QueueWorker();
    }

    protected DatabaseAdapter createDBAdapter(Context context) {
        return new DatabaseAdapter(context);
    }

    protected HttpService getHTTPService(String host) {
        return new HttpService(host);
    }

    public void event(JSONObject eventsJson) {
        Message m = Message.obtain();
        m.what = ADD_EVENT;
        m.obj = eventsJson;
        mWorker.sendMessage(m);
    }

    public void pushToServer() {
        Message m = Message.obtain();
        m.what = FLUSH_QUEUE;
        mWorker.sendMessage(m);
    }

    // QueueWorker manages thread for an MessagesQueue instance
    private class QueueWorker {
        // Those help control multi-threading
        private final Object mHandlerLock = new Object();
        private Handler      mHandler;

        // Modify flush interval if needed in a config file
        private long mFlushInterval = AnalyticsConfig.FLUSH_RATE;
        private long mFlushCount = 0;

        // Necessary to calculate flush rate
        private long mAverageFlushRate = 0;
        private long mLastFlushTimestamp = -1;

        public QueueWorker() {
            mHandler = resetThread();
        }

        public boolean isDead() {
            synchronized(mHandlerLock) {
                return mHandler == null;
            }
        }

        public void sendMessage(Message msg) {
            if (isDead()) { /* For whatever reasons thread is dead */ }
            else {
                synchronized(mHandlerLock) {
                    if (mHandler != null)
                        mHandler.sendMessage(msg);
                }
            }
        }

        private Handler resetThread() {
            Handler res = null;

            final SynchronousQueue<Handler> handlerSyncQueue = new SynchronousQueue<Handler>();

            Thread thread = new Thread() {
                @Override
                public void run() {
                    if (AnalyticsConfig.DEBUG) {
                        Log.i(LOGTAG, "Starting queue worker thread " + this.getId());
                    }

                    Looper.prepare();

                    try {
                        handlerSyncQueue.put(new MessagesQueueHandler());
                    } catch (InterruptedException e) {
                        throw new RuntimeException("Can't create a new MessagesQueueHandler", e);
                    }

                    try {
                        Looper.loop();
                    } catch (RuntimeException e) {
                        Log.e(LOGTAG, "MessagesQueue thread died", e);
                    }
                }
            };

            //We don't need high priority, keep it low
            thread.setPriority(Thread.MIN_PRIORITY);
            thread.start();

            try {
                res = handlerSyncQueue.take();
            } catch (InterruptedException e) {
                throw new RuntimeException("Can't get thread handler.");
            }

            return res;
        }

        private class MessagesQueueHandler extends Handler {
            private final DatabaseAdapter mDBAdapter;

            public MessagesQueueHandler() {
                super();
                //Create new adapter
                mDBAdapter = createDBAdapter(mContext);
                mDBAdapter.deleteEvents(System.currentTimeMillis() - AnalyticsConfig.DATA_EXPIRATION, DatabaseAdapter.Table.EVENTS);
            }

            @Override
            public void handleMessage(Message msg) {
                try {
                    int queueDepth = -1;

                    if (msg.what == ADD_EVENT) {
                        JSONObject message = (JSONObject) msg.obj;
                        queueDepth = mDBAdapter.insertJSON(message, DatabaseAdapter.Table.EVENTS);
                    } else
                    if (msg.what == FLUSH_QUEUE) {
                        updateFlushFrequency();
                        pushAllData();
                    } else {
                        Log.e(LOGTAG, "Unknown message type in MessageQueueHandler: " + msg);
                    }

                    // We don't store more than FLUSH_WAIT_LIMIT events
                    if (queueDepth >= AnalyticsConfig.FLUSH_WAIT_LIMIT) {
                        updateFlushFrequency();
                        pushAllData();
                    } else
                    if(queueDepth > 0) {
                        if (!hasMessages(FLUSH_QUEUE)) {
                            //If no flush requests schedule one
                            sendEmptyMessageDelayed(FLUSH_QUEUE, mFlushInterval);
                        }
                    }
                } catch (RuntimeException e) {
                    Log.e(LOGTAG, "QueueWorker caught an unhandled exception.", e);
                    synchronized (mHandlerLock) {
                        //Disable handler and stop sending
                        mHandler = null;
                        try {
                            Looper.myLooper().quit();
                        } catch (Exception ee) {
                            Log.e(LOGTAG, "Failed to stop the looper", ee);
                        }
                    }
                    throw e;
                }
            }

            private void pushAllData() {
                pushData(DatabaseAdapter.Table.EVENTS, "/track/bundle");
            }

            private void pushData(DatabaseAdapter.Table table, String endpointUrl) {
                String[] eventsData = mDBAdapter.buildDataString(table);

                //If there is some data, let's send it
                if (eventsData != null) {
                    String msgId = eventsData[0];
                    String msgData = eventsData[1];
                    HttpService httpService = getHTTPService(AnalyticsConfig.DEBUG ? AnalyticsConfig.DEV_ENDPOINT : AnalyticsConfig.PROD_ENDPOINT);
                    HttpService.ServiceResult res = httpService.postData(msgData, endpointUrl);

                    if (res == HttpService.ServiceResult.OK) {
                        mDBAdapter.deleteEvents(msgId, table);
                    } else
                    if (res == HttpService.ServiceResult.FAILED_RETRY) {
                        // Schedule another try if needed
                        if (!hasMessages(FLUSH_QUEUE)) {
                            sendEmptyMessageDelayed(FLUSH_QUEUE, mFlushInterval);
                        }
                    } else {
                        //Not possible to continue, clean it up
                        mDBAdapter.deleteEvents(msgId, table);
                    }
                }
            }
        }

        private void updateFlushFrequency() {
            long timeNow = System.currentTimeMillis();
            long flushCount = mFlushCount + 1;

            if (mLastFlushTimestamp > 0)
                mAverageFlushRate = (timeNow - mLastFlushTimestamp + (mAverageFlushRate * mFlushCount)) / flushCount;

            mLastFlushTimestamp = timeNow;
            mFlushCount = flushCount;
        }
    }
}
