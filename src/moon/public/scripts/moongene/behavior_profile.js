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

function dashWidgetSessionLengthFormat(d) {
    if(d > 3600) return (d / 3600).toFixed(1) + "h";
    if(d > 60) return (d / 60).toFixed(1) + "m";
    return d.toFixed(0) + "s";
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

function behProfRemoveNonDayObjValues(obj, depth) {
    var result = {};
    depth = depth != undefined ? depth : -1;

    for (var k in obj)
        if (obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" && !(prop instanceof Date || prop instanceof RegExp) && depth != 0 && k != "geo") {
                //Uncomment if you want to have a path like 2013.9.c l s p a pu values
                result/*[k] */= behProfRemoveNonDayObjValues(prop, depth - 1);
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

function behProfEnsureValuesPresence(val) {
    if(val.c == undefined) val.c = 0;
    if(val.l == undefined) val.l = 0;
    if(val.s == undefined) val.s = 0;
    if(val.a == undefined) val.a = 0;
    if(val.p == undefined) val.p = 0;
    if(val.pu == undefined) val.pu = 0;
}

function behProfilePrepareData(json) {
    var parseDate = d3.time.format("%Y_%m_%d").parse;

    //Flat the aggregated data va
    //Rip out c, l and s values, those are monthly and we will display them in widgets
    var monthCLS = behProfRemoveNonDayObjValues(json.va, 2);
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
        behProfEnsureValuesPresence(json.va.flat[dd]);

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
        var versionMonthlyCLS = behProfRemoveNonDayObjValues(json.v[v], 2);
        json.v[v].flat = flattenJson(json.v[v], 2);

        var flatArray = [];
        for(var d in json.v[v].flat)
        if (json.v[v].flat.hasOwnProperty(d) ){
            json.v[v].flat[d].date = parseDate(d);
            json.v[v].flat[d].mo = versionMonthlyCLS;
            behProfEnsureValuesPresence(json.v[v].flat[d]);

            flatArray.push(json.v[v].flat[d]);
        }

        json.v[v].flat = flatArray;
        json.v[v].title = atob(v); //decode title
        versionsArray.push(json.v[v])
    }
    json.v = versionsArray;
}

$(function(){
    initializeBehaviorProfileInfo();
});

function initializeBehaviorProfileInfo() {
    var todayDate = new Date();
    var dataUrl = "/data/behavior/profile/" + mobileAppId + "/" + convertDateToUTC(todayDate).getTime();

    var countryCodeToCountryName = {}
    d3.json("/assets/scripts/moongene/graph/geo_world.json", function(error, json) {
        if(json == undefined) return;
        var geometries = json.objects.geo_countries.geometries;
        for (var i = 0; i < geometries.length; i++) {
            countryCodeToCountryName[geometries[i].id] = geometries[i].properties.name;
        }

        behProfileInitTables(dataUrl, todayDate, countryCodeToCountryName);
    });

}

function formatTimeTill(hours) {
    if(hours >= 24) {
        return (hours / 24).toFixed(2) + " days";
    } else {
        return hours.toFixed(2) + " hours";
    }
}

function findMostLeastPlayingCountry(obj) {
    var mostLeast = {};

    for(var d in obj)
    if (obj.hasOwnProperty(d) ){
        var curObj = obj[d];
        var curAvgVal = curObj.l / curObj.c;
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

function objectToArray(obj, cutFirst) {
    cutFirst = cutFirst === undefined ? 0 : cutFirst;
    var objArray = [];
    for(var o in obj)
        if (obj.hasOwnProperty(o) ){
            var id = cutFirst == 0 ? o : o.substr(cutFirst);
            if(typeof obj[o] === "object") {
                if(id.length == 1)
                    obj[o]._id = segmentPlatformByID(id);
                else
                    obj[o]._id = atob(id);
            } else {
                obj[o] = { _id: atob(id), value: obj[o] };
            }

            objArray.push(obj[o]);
        }

    return objArray;
}

function behProfileInitTables(dataUrl, todayDate, countryCodeToCountryName) {
    d3.json(dataUrl, function(error, json) {
        //Show placeholder if needed
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
            return;
        } else
            $("#noDataBlock").hide();

        behProfilePrepareData(json);

        var tableBody = $("#behaviorProfileSessions");
        tableBody.empty();

        for(var vi = 0; vi < json.v.length; ++vi) {
            var vInfo = json.v[vi];
            var vDaysNum = vInfo.flat.length;
            var vTitle = vInfo.title;
            var vSessions = vInfo.flat[0].mo.s;
            var vTotalLength = vInfo.flat[0].mo.l;
            var vUnique = vInfo.flat[0].mo.c;

            var tableEntry = "<tr><td width='33%'>" + vTitle + "</td><td>" +
                dashWidgetSessionLengthFormat(vTotalLength / vSessions) + "</td><td>" +
                (vSessions / vUnique).toFixed(1) + "</td><a/tr>";

            tableBody.append(tableEntry);
        }

        //Look for most and least playing countries
        var country = findMostLeastPlayingCountry(json.va.flat[0].mo.geo);
        $("#mostPlayingCountryVal").html(
            "<img src='" + commonPath + "images/flags/24x24/" + country.most.id.toLowerCase() + ".png'>&nbsp;" +
            countryCodeToCountryName[country.most.id] + "<br>Daily play time: " +
            dashWidgetSessionLengthFormat(country.most.avgValue / json.va.flat.length) +
            "<br>Sessions per day: " + (country.most.s / json.va.flat.length).toFixed(1));

        $("#leastPlayingCountryVal").html(
            "<img src='" + commonPath + "images/flags/24x24/" + country.least.id.toLowerCase() + ".png'>&nbsp;" +
            countryCodeToCountryName[country.least.id] + "<br>Daily play time: " +
            dashWidgetSessionLengthFormat(country.least.avgValue / json.va.flat.length) +
            "<br>Sessions per day: " + (country.least.s / json.va.flat.length).toFixed(1));

        //Prepare hardware usage graphs
        for(var o in json.hw.os) if (json.hw.os.hasOwnProperty(o) ){
                var internalObj = json.hw.os[o];
                var values = objectToArray(internalObj);
                json.hw.os[o] = {value: values, total: d3.sum(values, function(d) { return d.value; })};
            }
        json.hw.os = objectToArray(json.hw.os);

        for(var w in json.hw.hw) if (json.hw.hw.hasOwnProperty(w) ){
            var internalObj = json.hw.hw[w];
            var values = objectToArray(internalObj);
            json.hw.hw[w] = {value: values, total: d3.sum(values, function(d) { return d.value; })};
        }
        json.hw.hw = objectToArray(json.hw.hw, 2);


        //Create an array with all graphs that we need to draw, the first one will be
        //a total and other ones with breakdown of versions
        var chartOSData = [];
        chartOSData.push({ y: 0, v: json.hw.os});
        for(var ii = 0; ii < json.hw.os.length; ++ii) {
            chartOSData.push({ y: ii + 1, v: json.hw.os[ii]});
        }


        //Calculate and set sizes for graph blocks
        var graphMarginY = 20;
        var graphOSDivName = "profile_os";
        var graphOSDivElem = $("#" + graphOSDivName);
        var graphOSWidth = graphOSDivElem.width();
        var graphOSRadius = graphOSWidth / 4;
        var graphOSHeight = (1 + json.hw.os.length) * (graphOSRadius * 2 + graphMarginY);
        var graphOSMarginX = graphOSWidth / 2;
        graphOSDivElem.height(graphOSHeight);

        var graphHWDivName = "profile_device";
        var graphHWDivElem = $("#" + graphHWDivName);
        var graphHWWidth = graphHWDivElem.width();
        var graphHWRadius = graphHWWidth / 3;
        var graphHWHeight = graphHWRadius * 2 + graphMarginY;
        var graphHWMarginX = graphHWWidth / 2;
        graphHWDivElem.height(graphHWHeight);

        var pieColors = d3.scale.category20();
        var osPie = d3.layout.pie()
            .value(function(d) { return +d.total; })
            .sort(function(a, b) { return b.total - a.total; });
        var osSpecificPie = d3.layout.pie()
            .value(function(d) { return +d.value; })
            .sort(function(a, b) { return b.value - a.value; });
        var hwPie = d3.layout.pie()
            .value(function(d) { return +d.total; })
            .sort(function(a, b) { return b.total - a.total; });

        var osArc = d3.svg.arc()
            .innerRadius(graphOSRadius / 2)
            .outerRadius(graphOSRadius);

        var hwArc = d3.svg.arc()
            .innerRadius(graphHWRadius / 2)
            .outerRadius(graphHWRadius);

        var graphOSSVG = d3.select("#" + graphOSDivName).append("svg")
            .attr("width", graphOSDivElem.width())
            .attr("height", graphOSDivElem.height())
            .append("g");

        var graphHWSVG = d3.select("#" + graphHWDivName).append("svg")
            .attr("width", graphHWDivElem.width())
            .attr("height", graphHWDivElem.height())
            .append("g");

        var osCharts = graphOSSVG.selectAll("g")
            .data(chartOSData)
            .enter().append("g")
            .attr("transform", function(d) { return "translate(" + graphOSMarginX + "," + (graphOSRadius + d.y * (graphOSRadius * 2 + graphMarginY)) + ")"; });

        var hwCharts = graphHWSVG.append("g")
            .attr("transform", function(d) { return "translate(" + graphHWMarginX + "," + (graphHWRadius) + ")"; });

        osCharts.append("svg:text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(function(d) {
                return d.y == 0 ? "OS" : d.v._id;
            });

        hwCharts.append("svg:text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text("Devices");

        var osG = osCharts.selectAll("g")
            .data(function(d) { return d.y == 0 ? osPie(d.v) : osSpecificPie(d.v.value); })
            .enter().append("svg:g");

        var hwG = hwCharts.selectAll("g")
            .data(hwPie(json.hw.hw))
            .enter().append("svg:g");

        osG.append("svg:path")
            .attr("d", osArc)
            .style("fill", function(d) {
                return pieColors(d.data._id);
            })
            .append("svg:title")
            .text(function(d) { return d.data._id; });

        hwG.append("svg:path")
            .attr("d", hwArc)
            .style("fill", function(d) {
                return pieColors(d.data._id);
            })
            .append("svg:title")
            .text(function(d) {
                var fullList = d.data._id + ": " + d.data.total + "\n\n";
                for(var i = 0; i < d.data.value.length; ++i)
                    fullList += d.data.value[i]._id + ": " + d.data.value[i].value + "\n";
                return fullList;
            });

         // Add a label to the larger arcs, translated to the arc centroid and rotated.
        osG.filter(function(d) { return d.endAngle - d.startAngle > .2; }).append("svg:text")
         .attr("dy", ".35em")
         .attr("text-anchor", "middle")
         .attr("transform", function(d) { return "translate(" + osArc.centroid(d) + ")rotate(" + angle(d) + ")"; })
         .text(function(d) { return d.data._id; });

        hwG.filter(function(d) { return d.endAngle - d.startAngle > .2; }).append("svg:text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .attr("transform", function(d) { return "translate(" + hwArc.centroid(d) + ")rotate(" + angle(d) + ")"; })
            .text(function(d) { return d.data._id; });

         // Computes the label angle of an arc, converting from radians to degrees.
         function angle(d) {
             var a = (d.startAngle + d.endAngle) * 90 / Math.PI - 90;
             return a > 90 ? a - 180 : a;
         }

        //Now draw hardware usage graphs


    });
}
