/**
 * Copyright (c) 2014, MoonGene. All rights reserved.
 *
 * This source code is licensed under the GPL license found in the
 * LICENSE_GPL file in the root directory of this source tree. An alternative
 * commercial license is also available upon request.
 */

package com.moongene.android;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import org.apache.http.client.HttpClient;
import org.apache.http.client.entity.UrlEncodedFormEntity;
import org.apache.http.client.methods.HttpPost;
import org.apache.http.HttpEntity;
import org.apache.http.NameValuePair;
import org.apache.http.impl.client.DefaultHttpClient;
import org.apache.http.message.BasicNameValuePair;

import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;

import android.util.Log;

import com.moongene.android.utility.Base64Coder;

/*
    HttpService: helper to work with HTTP requests
 */
class HttpService {
    private static final String LOGTAG = "MoonGeneAPI";
    private final String        mHttpHost;

    public static enum ServiceResult {
        OK,
        FAILED_RETRY,
        FAILED_ABANDON
    }

    public HttpService(String host) {
        mHttpHost = host;
    }

    public ServiceResult postData(String data, String path) {
        List<NameValuePair> nameValueList = new ArrayList<NameValuePair>(1);
        nameValueList.add(new BasicNameValuePair("data", Base64Coder.encodeString(data)));
        return postHttpRequest(mHttpHost + path, nameValueList);
    }

    private ServiceResult postHttpRequest(String endpointUrl, List<NameValuePair> nameValueList) {
        ServiceResult res = ServiceResult.FAILED_ABANDON;
        HttpClient httpClient = new DefaultHttpClient();
        HttpPost   httpPost = new HttpPost(endpointUrl);

        try {
            httpPost.setEntity(new UrlEncodedFormEntity(nameValueList));
            HttpEntity entity = httpClient.execute(httpPost).getEntity();

            if (entity != null) {
                String result = streamToString(entity.getContent());
                if (result.equals("1\n")) {
                    res = ServiceResult.OK;
                }
            }
        } catch (IOException e) {
            Log.i(LOGTAG, "Can't post data to MoonGene Server, worth trying again. ", e);
            res = ServiceResult.FAILED_RETRY;
        } catch (OutOfMemoryError e) {
            Log.e(LOGTAG, "Can't post data to MoonGene Server, OutOfMemory. Abandoning.", e);
            res = ServiceResult.FAILED_ABANDON;
        }

        return res;
    }

    public static String streamToString(final InputStream stream) throws IOException {
        BufferedReader readBuffer = new BufferedReader(new InputStreamReader(stream));
        StringBuilder  sb = new StringBuilder();
        //Read the buffer now and create a string
        String line = null;
        while ((line = readBuffer.readLine()) != null) {
            sb.append(line + "\n");
        }
        readBuffer.close();
        return sb.toString();
    }
}