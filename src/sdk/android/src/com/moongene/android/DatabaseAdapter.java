/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.android;

import java.io.File;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import android.util.Log;

import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteException;
import android.database.sqlite.SQLiteOpenHelper;

/*
    DatabaseAdapter: helper to work with an SQLite database
 */

class DatabaseAdapter {
    private static final String LOGTAG = "MoonGeneAPI";

    public enum Table {
        EVENTS ("events");

        Table(String name) { mTable = name; }
        public String getName() { return mTable; }
        private final String mTable;
    }

    private final DatabaseHelper mDb;
    public static final String   KEY_DATA = "data";
    public static final String   KEY_CREATED_TIME = "created_time";
    private static final String  DB_NAME = "moongene";
    private static final int     DB_VERSION = 4;

    private static final String CREATE_TABLE_EVENTS = "create table " + Table.EVENTS.getName() +
            " (_id integer primary key autoincrement, " + KEY_DATA + " string not null, " +
            KEY_CREATED_TIME + " integer not null);";
    private static final String TABLE_EVENTS_INDICES = "create index if not exists time_idx ON " +
            Table.EVENTS.getName() + " (" + KEY_CREATED_TIME + ");";

    private static class DatabaseHelper extends SQLiteOpenHelper {
        private final File mDBFile;

        DatabaseHelper(Context context, String dbName) {
            super(context, dbName, null, DB_VERSION);
            mDBFile = context.getDatabasePath(dbName);
        }

        public void deleteDatabase() {
            close();
            mDBFile.delete();
        }

        @Override
        public void onCreate(SQLiteDatabase db) {
            if (AnalyticsConfig.DEBUG) {
                Log.d(LOGTAG, "Create a new table for events with indices.");
            }

            db.execSQL(CREATE_TABLE_EVENTS);
            db.execSQL(TABLE_EVENTS_INDICES);
        }

        @Override
        public void onUpgrade(SQLiteDatabase db, int oldVersion, int newVersion) {
            if (AnalyticsConfig.DEBUG) {
                Log.d(LOGTAG, "App upgrade - recreating existing tables and indices.");
            }

            db.execSQL("drop table if exists " + Table.EVENTS.getName());
            db.execSQL(CREATE_TABLE_EVENTS);
            db.execSQL(TABLE_EVENTS_INDICES);
        }
    }

    public DatabaseAdapter(Context context) {
        this(context, DB_NAME);
    }

    public DatabaseAdapter(Context context, String dbName) {
        if (AnalyticsConfig.DEBUG) {
            Log.d(LOGTAG, "New Database adapter for DB '" + dbName + "' with context " + context);
        }

        mDb = new DatabaseHelper(context, dbName);
    }

    public int insertJSON(JSONObject j, Table table) {
        String tableName = table.getName();
        if (AnalyticsConfig.DEBUG) {
            Log.d(LOGTAG, "Insert new JSON into the table " + tableName);
        }

        Cursor cur = null;
        int count = -1;

        try {
            SQLiteDatabase db = mDb.getWritableDatabase();
            ContentValues cv = new ContentValues();
            cv.put(KEY_DATA, j.toString());
            cv.put(KEY_CREATED_TIME, System.currentTimeMillis());
            db.insert(tableName, null, cv);

            //Count number of rows in the table and return it
            cur = db.rawQuery("select count(*) from " + tableName, null);
            cur.moveToFirst();
            count = cur.getInt(0);
        } catch (SQLiteException e) {
            Log.e(LOGTAG, "Inserting JSON into the table " + tableName + " caused exception. Resetting DB.", e);
            mDb.deleteDatabase();
        } finally {
            mDb.close();
            if (cur != null) cur.close();
        }
        return count;
    }

    public void deleteEvents(String deleteTillID, Table table) {
        String tableName = table.getName();
        if (AnalyticsConfig.DEBUG) {
            Log.d(LOGTAG, "Delete events with ID up to " + deleteTillID + " from " + tableName);
        }

        try {
            SQLiteDatabase db = mDb.getWritableDatabase();
            db.delete(tableName, "_id <= " + deleteTillID, null);
        } catch (SQLiteException e) {
            Log.e(LOGTAG, "Deleting events from the table " + tableName + " caused exception. Resetting DB.", e);
            mDb.deleteDatabase();
        } finally {
            mDb.close();
        }
    }

    public void deleteEvents(long time, Table table) {
        String tableName = table.getName();
        if (AnalyticsConfig.DEBUG) {
            Log.d(LOGTAG, "Delete events till timestamp " + time + " from " + tableName);
        }

        try {
            SQLiteDatabase db = mDb.getWritableDatabase();
            db.delete(tableName, KEY_CREATED_TIME + " <= " + time, null);
        } catch (SQLiteException e) {
            Log.e(LOGTAG, "Deleting events from the table " + tableName + " caused exception. Resetting DB.", e);
            mDb.deleteDatabase();
        } finally {
            mDb.close();
        }
    }

    public void deleteDB() {
        mDb.deleteDatabase();
    }

    //Build a string to send to the analytics service. Max ID and events string is generated.
    public String[] buildDataString(Table table) {
        String tableName = table.getName();
        String res = null;
        String max_id = null;
        Cursor cur = null;

        try {
            SQLiteDatabase db = mDb.getReadableDatabase();
            JSONArray jsonArr = new JSONArray();
            cur = db.rawQuery("select * from " + tableName + " order by " + KEY_CREATED_TIME + " asc limit 50", null);

            while (cur.moveToNext()) {
                if ( cur.isLast() ) max_id = cur.getString( cur.getColumnIndex("_id") );
                try {
                    JSONObject j = new JSONObject( cur.getString( cur.getColumnIndex(KEY_DATA) ) );
                    jsonArr.put(j);
                } catch (JSONException e) {
                    //Skip this row
                }
            }

            if ( jsonArr.length() > 0 ) res = jsonArr.toString();
        } catch (SQLiteException e) {
            //Not critical, if DB is corrupt we will delete on insert
            Log.e(LOGTAG, "Exception in buildDataString for table " + tableName, e);
            max_id = null;
            res = null;
        } finally {
            mDb.close();
            if (cur != null)cur.close();
        }

        if (max_id != null && res != null) {
            String[] ret = {max_id, res};
            return ret;
        }
        return null;
    }
}
