//TODO Merge with Common, this is used in segmentation

function segmentPlatformByID(id) {
    switch(id) {
        case "1":
        case 1:   return "Android";

        case "2":
        case 2:   return "iOS";
    }
    return "Unknown";
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

function ecoProfRemoveNonDayObjValues(obj, depth) {
    var result = {};
    depth = depth != undefined ? depth : -1;

    for (var k in obj)
        if (obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" && !(prop instanceof Date || prop instanceof RegExp) && depth != 0 && k != "geo") {
                //Uncomment if you want to have a path like 2013.9.c l s p a pu values
                result/*[k] */= ecoProfRemoveNonDayObjValues(prop, depth - 1);
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

function ecoProfEnsureValuesPresence(val) {
    if(val.c == undefined) val.c = 0;
    if(val.l == undefined) val.l = 0;
    if(val.s == undefined) val.s = 0;
    if(val.a == undefined) val.a = 0;
    if(val.p == undefined) val.p = 0;
    if(val.pu == undefined) val.pu = 0;
}

function ecoProfilePrepareData(json) {
    var parseDate = d3.time.format("%Y_%m_%d").parse;

    //Flat the aggregated data va
    //Rip out c, l and s values, those are monthly and we will display them in widgets
    var monthCLS = ecoProfRemoveNonDayObjValues(json.va, 2);
    var flatEcoItems = [];
    for(var eco in monthCLS.e) if (monthCLS.e.hasOwnProperty(eco) )
    {
        var elValuesArr = [];
        for(var elValue in monthCLS.e[eco]) if (monthCLS.e[eco].hasOwnProperty(elValue) && elValue != "c") elValuesArr.push(
            {
                x: parseInt(elValue),
                yt: monthCLS.e[eco][elValue],
                yc: monthCLS.e[eco].c[elValue],
                y:  monthCLS.e[eco][elValue] / monthCLS.e[eco].c[elValue]
            });
        monthCLS.e[eco] = elValuesArr;

        flatEcoItems.push(
        {
            "text": atob(eco),
            "id": eco,
            "elem": monthCLS.e[eco]
        });
    }
    monthCLS.flatEcoItems = flatEcoItems; //Convert from objects list to array


    var timeNow = new Date();

    //Flatten aggregated - all versions data and add date to every data point
    json.va.flat = flattenJson(json.va, 2);
    var flatArray2 = [];
    for(var dd in json.va.flat)
    if (json.va.flat.hasOwnProperty(dd) ){
        var parsedDate = parseDate(dd);
        json.va.flat[dd].date = parsedDate;
        ecoProfEnsureValuesPresence(json.va.flat[dd]);

        if(parsedDate.getFullYear() == timeNow.getFullYear() &&
           parsedDate.getMonth() == timeNow.getMonth() &&
           parsedDate.getDate() == timeNow.getDate()) {
            json.va.today = json.va.flat[dd];
        }

        //Convert to array also items
        var ecoItemsArray = [];
        if(json.va.flat[dd].e != undefined) {
            for(var item in json.va.flat[dd].e) if (json.va.flat[dd].e.hasOwnProperty(item) && item != "c" )
                { ecoItemsArray.push(
                    {
                        "id": item,
                        "val": json.va.flat[dd].e[item],
                        "hits": json.va.flat[dd].e.c[item]
                    });
                }
            json.va.flat[dd].eobj = json.va.flat[dd].e;
            json.va.flat[dd].e = ecoItemsArray;
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
        var versionMonthlyCLS = ecoProfRemoveNonDayObjValues(json.v[v], 2);
        json.v[v].flat = flattenJson(json.v[v], 2);

        var flatArray = [];
        for(var d in json.v[v].flat)
        if (json.v[v].flat.hasOwnProperty(d) ){
            json.v[v].flat[d].date = parseDate(d);
            json.v[v].flat[d].mo = versionMonthlyCLS;
            ecoProfEnsureValuesPresence(json.v[v].flat[d]);

            flatArray.push(json.v[v].flat[d]);
        }

        json.v[v].flat = flatArray;
        json.v[v].title = atob(v); //decode title
        versionsArray.push(json.v[v])
    }
    json.v = versionsArray;
}

$(function(){
    initializeEconomyProfileInfo();
});

function initializeEconomyProfileInfo() {
    var todayDate = new Date();
    var dataUrl = "/data/eco/profile/" + mobileAppId + "/" + convertDateToUTC(todayDate).getTime();

    var countryCodeToCountryName = {}
    d3.json("/assets/scripts/moongene/graph/geo_world.json", function(error, json) {
        var geometries = json.objects.geo_countries.geometries;
        for (var i = 0; i < geometries.length; i++) {
            countryCodeToCountryName[geometries[i].id] = geometries[i].properties.name;
        }

        ecoProfileInitTables(dataUrl, todayDate, countryCodeToCountryName);
    });

}

function formatTimeTill(hours) {
    if(hours >= 24) {
        return (hours / 24).toFixed(2) + " days";
    } else {
        return hours.toFixed(2) + " hours";
    }
}

function findMostCommonPackage(obj) {
    var mostCommon = {};

    for(var d in obj)
    if (obj.hasOwnProperty(d) ){
        var curVal = obj[d];

        if(mostCommon.most == undefined) {
            mostCommon.most = {};
            mostCommon.most.val = curVal;
            mostCommon.most.id = d;
        } else {
            if(mostCommon.most.avgValue < curVal) {
                mostCommon.most.avgValue = curVal;
                mostCommon.most.id = d;
            }
        }
    }

    return mostCommon;
}

function findMostLeastElements(obj) {
    var mostLeast = {};

    for(var d in obj)
    if (obj.hasOwnProperty(d) ){
        var curObj = obj[d];
        var curAvgVal = curObj.a / curObj.pu;
        if(mostLeast.most == undefined) {
            mostLeast.most = curObj;
            mostLeast.most.avgValue = curAvgVal;
            mostLeast.most.id = d;
            mostLeast.least = curObj;
            mostLeast.least.avgValue = curAvgVal;
            mostLeast.least.id = d;
        } else {
            if(mostLeast.most.avgValue < curAvgVal) {
                mostLeast.most = curObj;
                mostLeast.most.avgValue = curAvgVal;
                mostLeast.most.id = d;
            }
            if(mostLeast.least.avgValue > curAvgVal) {
                mostLeast.least = curObj;
                mostLeast.least.avgValue = curAvgVal;
                mostLeast.least.id = d;
            }
        }
    }

    return mostLeast;
}

function ecoProfileInitTables(dataUrl, todayDate, countryCodeToCountryName) {
    d3.json(dataUrl, function(error, json) {
        //Show placeholder if needed
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
            return;
        } else
            $("#noDataBlock").hide();

        ecoProfilePrepareData(json);
        var country = findMostLeastElements(json.va.flat[0].mo.geo);
        var platform = findMostLeastElements(json.ecoprof.p);
        var platformVersion = findMostLeastElements(json.ecoprof.pv);
        var vendor = findMostLeastElements(json.ecoprof.v);

        var timeTill1 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p1 != undefined) ?
            (json.ecoprof.ts.p1.t / json.ecoprof.ts.p1.c) : 0; //ts.p1.t is hours
        var sessionsTill1 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p1 != undefined) ?
            (json.ecoprof.ts.p1.s / json.ecoprof.ts.p1.c) : 0; //ts.p1.s number of sessions

        var timeTill2 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p2 != undefined) ?
            (json.ecoprof.ts.p2.t / json.ecoprof.ts.p2.c) : 0; //ts.p2.t is hours
        var sessionsTill2 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p2 != undefined) ?
            (json.ecoprof.ts.p2.s / json.ecoprof.ts.p2.c) : 0; //ts.p2.s number of sessions

        var timeTill3 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p3 != undefined) ?
            (json.ecoprof.ts.p3.t / json.ecoprof.ts.p3.c) : 0; //ts.p3.t is hours
        var sessionsTill3 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p3 != undefined) ?
            (json.ecoprof.ts.p3.s / json.ecoprof.ts.p3.c) : 0; //ts.p3.s number of sessions

        var mostPopular1 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p1 != undefined) ?
            atob(findMostCommonPackage(json.ecoprof.ts.p1.p).most.id) : "Unknown";
        var mostPopular2 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p2 != undefined) ?
            atob(findMostCommonPackage(json.ecoprof.ts.p2.p).most.id) : "Unknown";
        var mostPopular3 = (json.ecoprof.ts != undefined && json.ecoprof.ts.p3 != undefined) ?
            atob(findMostCommonPackage(json.ecoprof.ts.p3.p).most.id) : "Unknown";

        $("#timeTillFirstPurchase").text(formatTimeTill(timeTill1));
        $("#timeTillSecondPurchase").text(formatTimeTill(timeTill2));
        $("#timeTillThirdPurchase").text(formatTimeTill(timeTill3));
        $("#sessionsTillFirstPurchase").text(sessionsTill1.toFixed(2));
        $("#sessionsTillSecondPurchase").text(sessionsTill2.toFixed(2));
        $("#sessionsTillThirdPurchase").text(sessionsTill3.toFixed(2));
        $("#mostCommonFirstPurchase").text(mostPopular1.toString());
        $("#mostCommonSecondPurchase").text(mostPopular2.toString());
        $("#mostCommonThirdPurchase").text(mostPopular3.toString());

        $("#mostPayingCountry").text(countryCodeToCountryName[country.most.id]);
        $("#mostPayingCountryVal").text("$ " + (country.most.avgValue / 100).toFixed(2));
        $("#leastPayingCountry").text(countryCodeToCountryName[country.least.id]);
        $("#leastPayingCountryVal").text("$ " + (country.least.avgValue / 100).toFixed(2));

        $("#mostPayingVendor").text(atob(vendor.most.id));
        $("#mostPayingVendorVal").text("$ " + (vendor.most.avgValue / 100).toFixed(2));
        $("#leastPayingVendor").text(atob(vendor.least.id));
        $("#leastPayingVendorVal").text("$ " + (vendor.least.avgValue / 100).toFixed(2));

        $("#mostPayingPlatform").text(segmentPlatformByID(platform.most.id));
        $("#mostPayingPlatformVal").text("$ " + (platform.most.avgValue / 100).toFixed(2));
        $("#leastPayingPlatform").text(segmentPlatformByID(platform.least.id));
        $("#leastPayingPlatformVal").text("$ " + (platform.least.avgValue / 100).toFixed(2));

        var mostPayingVersion = platformVersion.most.id.split("~");
        var leastPayingVersion = platformVersion.least.id.split("~");
        $("#mostPayingVersion").text(segmentPlatformByID(mostPayingVersion[0]) + ": " + atob(mostPayingVersion[1]));
        $("#mostPayingVersionVal").text("$ " + (platformVersion.most.avgValue / 100).toFixed(2));
        $("#leastPayingVersion").text(segmentPlatformByID(leastPayingVersion[0]) + ": " + atob(leastPayingVersion[1]));
        $("#leastPayingVersionVal").text("$ " + (platformVersion.least.avgValue / 100).toFixed(2));

        $("#mostPayingTrafficSource").text("Organic");
        $("#mostPayingTrafficSourceVal").text("$");
        $("#leastPayingTrafficSource").text("Organic");
        $("#leastPayingTrafficSourceVal").text("$");


    });
}
