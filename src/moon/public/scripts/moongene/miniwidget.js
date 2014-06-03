//TODO Add chart
//http://jsfiddle.net/NYEaX/5/

function convertDateToUTC(date) { return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()); }

function miniWidgetMauDauFormat(d) {
    if(d > 1000000) return (d / 1000000).toFixed(1) + "M";
    if(d > 100000) return (d / 1000).toFixed(0) + "k";
    if(d > 10000) return (d / 1000).toFixed(1) + "k";
    if(d > 1000) return (d / 1000).toFixed(2) + "k";
    return d;
}

function miniWidgetCurrencyFormat(d) {
    if(d == 0) return "$0.0";

    d = d / 100;
    var currencyFormat = d3.format(",");
    if(d > 10000) return "$" + miniWidgetMauDauFormat(d);
    if(d > 100) return "$" + currencyFormat(d.toFixed(0));
    return "$" + d.toFixed(2);
}

function miniCurrencyFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    return "$" + currencyFormat(d.toFixed(2));
}

function miniWidgetSessionLengthFormat(d) {
    if(d == 0) return "0";
    if(d > 3600) return (d / 3600).toFixed(1) + "h";
    if(d > 60) return (d / 60).toFixed(1) + "m";
    return d + "s";
}

//TODO Doesn't work with arrays
/*
 A few caveats:
 recursive objects will not work. For example:
 var o = { a: "foo" };
 o.b = o;
 flatten(o);
 will recurse until it throws an exception.

 Like ruquay's answer, this pulls out array elements just like normal object properties. If you want to keep arrays intact, add "|| prop instanceof Array" to the exceptions.

 If you call this on objects from a different window or frame, dates and regular expressions will not be included, since instanceof will not work properly. You can fix that by replacing it with the default toString method like this:

 Object.prototype.toString.call(prop) === "[object Date]"
 Object.prototype.toString.call(prop) === "[object RegExp]"
 Object.prototype.toString.call(prop) === "[object Array]"
 */
function flattenJson(obj, depth, includePrototype, into, prefix) {
    depth = depth != undefined ? depth : -1;
    into = into != undefined ? into : {};
    prefix = prefix != undefined ? prefix : "";

    for (var k in obj)
        if (includePrototype || obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" &&
                !(prop instanceof Date || prop instanceof RegExp) &&
                depth != 0) {
                flattenJson(prop, depth - 1, includePrototype, into, prefix + k + "_");
            }
            else {
                into[prefix + k] = prop;
            }
        }

    return into;
}

function miniRemoveNonDayObjValues(obj, depth) {
    var result = {};
    depth = depth != undefined ? depth : -1;

    for (var k in obj)
        if (obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" && !(prop instanceof Date || prop instanceof RegExp) && depth != 0 && k != "geo") {
                //Uncomment if you want to have a path like 2013.9.c l s p a pu values
                result/*[k] */= miniRemoveNonDayObjValues(prop, depth - 1);
            }
            else {
                if(prop && (typeof prop !== "object" ||
                    k == "geo" ||
                    k == "campaigns" ||
                    k == "packages" ||
                    k == "e")) {
                    result[k] = prop
                    delete obj[k]
                }
            }
        }

    return result
}

function miniEnsureValuesPresence(val) {
    if(val.c == undefined) val.c = 0;
    if(val.l == undefined) val.l = 0;
    if(val.s == undefined) val.s = 0;
    if(val.a == undefined) val.a = 0;
    if(val.p == undefined) val.p = 0;
    if(val.pu == undefined) val.pu = 0;
}

function miniAddWidgetData(w1, w2) {
    return {
        c: w1.c + w2.c,
        l: w1.l + w2.l,
        s: w1.s + w2.s,
        a: w1.a + w2.a,
        p: w1.p + w2.p,
        pu: w1.pu + w2.pu,
        days: w1.days + w2.days
            };
}

function miniPrepareMonth(json, dateFrom, dateTo) {
    var parseDate = d3.time.format("%Y_%m_%d").parse;

    //Flat the aggregated data va
    //Rip out c, l and s values, those are monthly and we will display them in widgets
    var monthCLS = miniRemoveNonDayObjValues(json.va, 2);
    var timeNow = new Date();

    //Flatten aggregated - all versions data and add date to every data point
    json.va.flat = flattenJson(json.va, 2);
    //Prepare data for widgets in case it is missing
    if(json.va.widgets == undefined) json.va.widgets = { c: 0, l: 0, s: 0, a: 0, p: 0, pu: 0, days: 0};


    var flatArray2 = [];
    for(var dd in json.va.flat)
        if (json.va.flat.hasOwnProperty(dd) ){
            var parsedDate = parseDate(dd);
            json.va.flat[dd].date = parsedDate;
            miniEnsureValuesPresence(json.va.flat[dd]);

            if(parsedDate.getFullYear() == timeNow.getFullYear() &&
                parsedDate.getMonth() == timeNow.getMonth() &&
                parsedDate.getDate() == timeNow.getDate()) {
                json.va.today = json.va.flat[dd];
            }

            if(dateFrom <= parsedDate && dateTo >= parsedDate) {
                json.va.widgets.c += json.va.flat[dd].c;
                json.va.widgets.l += json.va.flat[dd].l;
                json.va.widgets.s += json.va.flat[dd].s;
                json.va.widgets.a += json.va.flat[dd].a;
                json.va.widgets.p += json.va.flat[dd].p;
                json.va.widgets.pu += json.va.flat[dd].pu;
                json.va.widgets.days += 1;
            }


            json.va.flat[dd].mo = monthCLS;
            flatArray2.push(json.va.flat[dd]);
        }
    json.va.flat = flatArray2; //Convert from objects list to array
    json.va.title = "All";

    //Do the same for all other versions
    var versionsArray = [];
    versionsArray.push(json.va);
    for (var v in json.v)
        if (json.v.hasOwnProperty(v) ){
            var versionMonthlyCLS = miniRemoveNonDayObjValues(json.v[v], 2);
            json.v[v].flat = flattenJson(json.v[v], 2);

            var flatArray = [];
            for(var d in json.v[v].flat)
                if (json.v[v].flat.hasOwnProperty(d) ){
                    json.v[v].flat[d].date = parseDate(d);
                    json.v[v].flat[d].mo = versionMonthlyCLS;
                    miniEnsureValuesPresence(json.v[v].flat[d]);

                    flatArray.push(json.v[v].flat[d]);
                }

            json.v[v].flat = flatArray;
            var titleDecoded = atob(v);
            json.v[v].title = titleDecoded;
            versionsArray.push(json.v[v])
        }
    json.v = versionsArray;
}

function miniPrepareData(json, dateFrom, dateTo) {

    var monthsArray = [];
    var totalPUs = 0;
    var totalDays = 0;
    var aggregatedWidgetData = undefined;
    for (var m in json)
        if (json.hasOwnProperty(m) ){
            miniPrepareMonth(json[m], dateFrom, dateTo);
            if(aggregatedWidgetData == undefined) aggregatedWidgetData = json[m].va.widgets;
            totalPUs += json[m].va.flat[0].mo.pu;
            totalDays += json[m].va.flat.length;
            monthsArray.push(json[m]);
            if(aggregatedWidgetData != json[m].va.widgets)
                aggregatedWidgetData = miniAddWidgetData(aggregatedWidgetData, json[m].va.widgets);
        }

    for (var mw in json)
        if (json.hasOwnProperty(mw) ){
            json[mw].va.widgets = aggregatedWidgetData;
        }

    json.months = monthsArray;
    //Merge now months together so we can have one long list per version
    var firstMonth = json.months[0];
    //We don't need to merge aggregated version VA, as it is added to general versions array with
    //title all, so we skip this one it will be done along with other versions

    //Now merge the rest of versions, here we need to make sure that the version that we merge
    //also exists in the first month, if it doesn't we create that field and just copy it
    for(var j = 1; j < json.months.length; ++j) {
        for(var mm = 0; mm < json.months[j].v.length; ++mm) {
            var versionName = json.months[j].v[mm].title;
            //Now find an index for this version in the first month
            var firstMonthVersionIndex = -1;
            for(var fm = 0; fm < firstMonth.v.length; ++fm)
                if(firstMonth.v[fm].title == versionName){
                    firstMonthVersionIndex = fm;
                    break;
                }

            if(firstMonthVersionIndex == -1) {
                //Just copy this version completely because first month doesn't have this entry
                firstMonth.v.push(json.months[j].v[mm]);
            } else {
                //Merge those two versions together
                firstMonth.v[firstMonthVersionIndex].flat = firstMonth.v[firstMonthVersionIndex].flat.concat(json.months[j].v[mm].flat);
            }
        }
    }


    for(var st = json.months[0].v.length - 1; st >= 0; --st)
        json.months[0].v[st].flat.sort(function(a,b){
            a = new Date(a.date);
            b = new Date(b.date);
            return a < b ? -1 : a > b ? 1 : 0;
        });

    var monthIndex = json.months.length - 1; //Take the last month only
    json.months[monthIndex].va.widgets.PUPerDay = totalPUs / totalDays;
    json.months[monthIndex].va.widgets.pu = json.months[monthIndex].va.widgets.days * json.months[monthIndex].va.widgets.PUPerDay;
}

function miniUpdateWidgets(dataUrl, dateFrom, dateTo, appId) {

    d3.json(dataUrl, function(error, json) {

        var usePlaceholders = json == undefined || jQuery.isEmptyObject(json) || (json.code != undefined && json.code < 0);

        if(!usePlaceholders) {
            //Convert data to a format that D3JS can digest
            miniPrepareData(json, dateFrom, dateTo);

            //Update our widgets with fresh values
            var monthIndex = json.months.length - 1;
            var widgetEntry = json.months[monthIndex].va.widgets;

            var mauValue = widgetEntry.c;
            var sessionLenghValue = widgetEntry.s == 0 ? 0 : (widgetEntry.l / widgetEntry.s);
            var dauValue = (typeof json.months[monthIndex].va.today === "undefined") ? 0 /*lastEntry.c */: json.months[monthIndex].va.today.c;

            var arpu = mauValue == 0 ? 0 : (widgetEntry.a / mauValue);
            var arppu = widgetEntry.pu == 0 ? 0 : (widgetEntry.a / widgetEntry.pu);
            var dailyRev = (typeof json.months[monthIndex].va.today === "undefined") ? 0 /*lastEntry.c */: json.months[monthIndex].va.today.a;

            $("#WidgetMau" + appId).text(miniWidgetMauDauFormat(mauValue));
            $("#WidgetDau" + appId).text(miniWidgetMauDauFormat(dauValue));
            $("#WidgetSessionLength" + appId).text(miniWidgetSessionLengthFormat(sessionLenghValue));

            $("#WidgetARPU" + appId).text(miniWidgetCurrencyFormat(arpu));
            $("#WidgetARPPU" + appId).text(miniWidgetCurrencyFormat(arppu));
            $("#WidgetDailyRevenue" + appId).text(miniWidgetCurrencyFormat(dailyRev));
        }
    })
}

function miniwidget(appId) {
    var todayDate = new Date();
    var twoWeeksAgoDate = new Date(); twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
    todayDate.setHours(23, 59, 59);
    twoWeeksAgoDate.setHours(0, 0, 0, 0);

    var dataUrl = "/data/dashboard/" + appId + "/" + convertDateToUTC(twoWeeksAgoDate).getTime() + "/" + convertDateToUTC(todayDate).getTime();
    miniUpdateWidgets(dataUrl, twoWeeksAgoDate, todayDate, appId);
}
