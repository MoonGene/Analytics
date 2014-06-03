//TODO Add chart
//http://jsfiddle.net/NYEaX/5/

function convertDateToUTC(date) { return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()); }

var graphMargins = {
    left: 42,
    right: 10,
    top: 5,
    bottom: 50
};

function dashWidgetMauDauFormat(d) {
    if(d > 1000000) return (d / 1000000).toFixed(1) + "M";
    if(d > 100000) return (d / 1000).toFixed(0) + "k";
    if(d > 10000) return (d / 1000).toFixed(1) + "k";
    if(d > 1000) return (d / 1000).toFixed(2) + "k";
    return d;
}

function dashWidgetCurrencyFormat(d) {
    if(d == 0) return "$0.0";
    d = d / 100;
    var currencyFormat = d3.format(",");
    if(d > 10000) return "$" + dashWidgetMauDauFormat(d);
    if(d > 100) return "$" + currencyFormat(d.toFixed(0));
    return "$" + d.toFixed(2);
}

function dashCurrencyFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    return "$" + currencyFormat(d.toFixed(2));
}

function dashCurrencyAxisFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    if(d > 10000) return "$" + dashWidgetMauDauFormat(d);
    if(d > 100) return "$" + currencyFormat(d.toFixed(0));
    return "$" + d.toFixed(d < 10 && d != 0 ? 2 : 0);
}

function dashWidgetSessionLengthFormat(d) {
    if(d == 0) return "0";

    if(d > 3600) return (d / 3600).toFixed(1) + "h";
    if(d > 60) return (d / 60).toFixed(1) + "m";
    return d + "s";
}

function dashTooltipDauMauFormat(d) {
    return d.toFixed(3);
}

function dashTooltipTimeFormat(d) {
    var hours = (d / 3600).toFixed(0);
    var minutes = ((d % 3600) / 60).toFixed(0);
    var seconds = ((d % 3600) % 60).toFixed(0);

    if(hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
    if(minutes > 0) return minutes + "m " + seconds + "s";
    return seconds + "s";
}

function dashYAxisTimeFormat(d) {
    if(d < 60) return d + "s"; else
    if(d < 3600){
        if(d >= 600)
            return (d / 60).toFixed(0) + "m";
        if(d % 60 > 0)
            return (d / 60).toFixed(1) + "m";
        else
            return (d / 60) + "m";
    }  else
        return (d / 3600).toFixed(0) + "h"
}

function dashTimeFormat(d) {
    var formatFull = d3.time.format("%b %-d");
    var formatShort = d3.time.format("%-d");

    var date = new Date(d);
    if(date.getDate() == 1 || date.getDate() == 10 || date.getDate() == 20)
        return formatFull(d);
    else
        return formatShort(d);
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

function dashRemoveNonDayObjValues(obj, depth) {
    var result = {};
    depth = depth != undefined ? depth : -1;

    for (var k in obj)
        if (obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" && !(prop instanceof Date || prop instanceof RegExp) && depth != 0 && k != "geo") {
                //Uncomment if you want to have a path like 2013.9.c l s p a pu values
                result/*[k] */= dashRemoveNonDayObjValues(prop, depth - 1);
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


function dashEnsureValuesPresence(val) {
    if(val.c == undefined) val.c = 0;
    if(val.l == undefined) val.l = 0;
    if(val.s == undefined) val.s = 0;
    if(val.a == undefined) val.a = 0;
    if(val.p == undefined) val.p = 0;
    if(val.pu == undefined) val.pu = 0;
}

function dashPrepareMonth(json) {
    var parseDate = d3.time.format("%Y_%m_%d").parse;

    //Flat the aggregated data va
    //Rip out c, l and s values, those are monthly and we will display them in widgets
    var monthCLS = dashRemoveNonDayObjValues(json.va, 2);
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
        dashEnsureValuesPresence(json.va.flat[dd]);

        if(parsedDate.getFullYear() == timeNow.getFullYear() &&
           parsedDate.getMonth() == timeNow.getMonth() &&
           parsedDate.getDate() == timeNow.getDate()) {
            json.va.today = json.va.flat[dd];
        }

        if(dashGraphObjects.dateFrom <= parsedDate && dashGraphObjects.dateTo >= parsedDate) {
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
        var versionMonthlyCLS = dashRemoveNonDayObjValues(json.v[v], 2);
        json.v[v].flat = flattenJson(json.v[v], 2);

        var flatArray = [];
        for(var d in json.v[v].flat)
        if (json.v[v].flat.hasOwnProperty(d) ){
            json.v[v].flat[d].date = parseDate(d);
            json.v[v].flat[d].mo = versionMonthlyCLS;
            dashEnsureValuesPresence(json.v[v].flat[d]);

            flatArray.push(json.v[v].flat[d]);
        }

        json.v[v].flat = flatArray;
        var titleDecoded = atob(v);
        json.v[v].title = titleDecoded;
        versionsArray.push(json.v[v])
    }
    json.v = versionsArray;
}

function dashPrepareData(json) {

    var monthsArray = [];
    var totalPUs = 0;
    var totalDays = 0;
    var aggregatedWidgetData = undefined;

    for (var m in json)
    if (json.hasOwnProperty(m) ){
        dashPrepareMonth(json[m]);
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

var dashGraphObjects = {};

function recalcPeriod() {
    var newPeriod = dashGraphObjects.maxDau == undefined ? 1000 : dashGraphObjects.maxDau * 50;
    return newPeriod < 1000 ? 1000 : newPeriod;
}

function dashUpdateWidgets(json) {
    var monthIndex = json.months.length - 1;
    var widgetEntry = json.months[monthIndex].va.widgets;

    var mauValue = widgetEntry.c;
    var sessionLenghValue = widgetEntry.s == 0 ? 0 : (widgetEntry.l / widgetEntry.s);
    var dauValue = (typeof json.months[monthIndex].va.today === "undefined") ? 0 /*lastEntry.c */: json.months[monthIndex].va.today.c;

    var arpu = mauValue == 0 ? 0 : (widgetEntry.a / mauValue);
    var arppu = widgetEntry.pu == 0 ? 0 : (widgetEntry.a / widgetEntry.pu);
    var dailyRev = (typeof json.months[monthIndex].va.today === "undefined") ? 0 /*lastEntry.c */: json.months[monthIndex].va.today.a;

    $("#WidgetMau").text(dashWidgetMauDauFormat(mauValue));
    $("#WidgetDau").text(dashWidgetMauDauFormat(dauValue));
    $("#WidgetSessionLength").text(dashWidgetSessionLengthFormat(sessionLenghValue));

    $("#WidgetARPU").text(dashWidgetCurrencyFormat(arpu));
    $("#WidgetARPPU").text(dashWidgetCurrencyFormat(arppu));
    $("#WidgetDailyRevenue").text(dashWidgetCurrencyFormat(dailyRev));

}

function dashDrawGraphs(dataUrl, dateFrom, dateTo) {
    dashGraphObjects.chartDauName = "dashchart_dau";
    dashGraphObjects.chartDauElem = $("#" + dashGraphObjects.chartDauName);
    dashGraphObjects.chartDauMauName = "dashchart_daumau";
    dashGraphObjects.chartDauMauElem = $("#" + dashGraphObjects.chartDauMauName);
    dashGraphObjects.chartSessionsName = "dashchart_sessions";
    dashGraphObjects.chartSessionsElem = $("#" + dashGraphObjects.chartSessionsName);
    dashGraphObjects.chartSessionLengthName = "dashchart_sessionlength";
    dashGraphObjects.chartSessionLengthElem = $("#" + dashGraphObjects.chartSessionLengthName);
    dashGraphObjects.chartRevenueName = "dashchart_revenue";
    dashGraphObjects.chartRevenueElem = $("#" + dashGraphObjects.chartRevenueName);
    dashGraphObjects.chartTransactionsName = "dashchart_paymenttransactions";
    dashGraphObjects.chartTransactionsElem = $("#" + dashGraphObjects.chartTransactionsName);

    dashGraphObjects.graphWidth = dashGraphObjects.chartDauElem.width() - graphMargins.left - graphMargins.right;
    dashGraphObjects.graphHeight = dashGraphObjects.chartDauElem.height() - graphMargins.top - graphMargins.bottom;
    dashGraphObjects.dateFrom = dateFrom;
    dashGraphObjects.dateTo = dateTo;

    d3.json(dataUrl, function(error, json) {

        var usePlaceholders = json == undefined || jQuery.isEmptyObject(json) || (json.code != undefined && json.code < 0);

        if(usePlaceholders) {
            $("#noDataBlock").show();
        } else {
            $("#noDataBlock").hide();
        }


        dashGraphObjects.createSvg = function(chartName, chartElem) {
            d3.select("#" + chartName).select("svg").remove();

            return d3.select("#" + chartName).append("svg")
                .attr("width", chartElem.width())
                .attr("height", chartElem.height())
                .append("g")
                .attr("transform", "translate(" + graphMargins.left + "," + graphMargins.top + ")")
                /* //Debug way to see the area
                 .append("rect").attr("width", graphWidth).attr("height", graphHeight)
                 .attr("fill", "white").attr("stroke-width", "1px").attr("stroke", "rgb(127, 0, 0)")*/;
        };

        if(!usePlaceholders) {
            //Convert data to a format that D3JS can digest
            dashPrepareData(json);

            //Update our widgets with fresh values
            dashUpdateWidgets(json);

            //Aggregated versions data has longest period and highest count, so we only base on them
            dashGraphObjects.x = d3.time.scale()
                .domain([dateFrom, dateTo])
                //.domain(d3.extent(json.va.flat, function(d) { return d.date; }))
                .range([0, dashGraphObjects.graphWidth]);

            dashGraphObjects.newXAxis = function() {
                return d3.svg.axis()
                    .scale(dashGraphObjects.x)
                    .tickFormat(dashTimeFormat)
                    .ticks(14);};

            dashGraphObjects.createSvgClip = function(svg, clipName) {
                return svg.append("defs").append("clipPath")
                    .attr("id", clipName)
                    .append("rect")
                    .attr("y", -30) //Give some space for dots
                    .attr("width", dashGraphObjects.graphWidth)
                    .attr("height", dashGraphObjects.graphHeight + 30);
            };

            dashGraphObjects.newYAxis = function(y, format) {
                return d3.svg.axis()
                    .scale(y)
                    .orient("left")
                    .tickFormat(d3.format(format));
            };

            dashGraphObjects.newYAxisCustomFormat = function(y, format) {
                return d3.svg.axis()
                    .scale(y)
                    .orient("left")
                    .tickFormat(format);
            };

            dashGraphObjects.newYTimeAxis = function(y) {
                return d3.svg.axis()
                    .scale(y)
                    .orient("left")
                    .tickFormat(dashYAxisTimeFormat);
            };

            dashGraphObjects.dashColor = json.months[0].v.size > 10 ? d3.scale.category20() : d3.scale.category10();

            dashDrawDAU(json.months[0]);
            dashDrawDAUMAU(json.months[0]);
            dashDrawSessions(json.months[0]);
            dashDrawSessionLength(json.months[0]);
            dashDrawDailyRevenue(json.months[0]);
            dashDrawTransactions(json.months[0]);
        } else {
            dashGraphObjects.dashColor = d3.scale.category10();
            dashGraphObjects.dauSvg = dashGraphObjects.createSvg(dashGraphObjects.chartDauName, dashGraphObjects.chartDauElem);
            dashGraphObjects.dauMauSvg = dashGraphObjects.createSvg(dashGraphObjects.chartDauMauName, dashGraphObjects.chartDauMauElem);
            dashGraphObjects.sessionsSvg = dashGraphObjects.createSvg(dashGraphObjects.chartSessionsName, dashGraphObjects.chartSessionsElem);
            dashGraphObjects.sessionLengthSvg = dashGraphObjects.createSvg(dashGraphObjects.chartSessionLengthName, dashGraphObjects.chartSessionLengthElem);
            dashGraphObjects.revenueSvg = dashGraphObjects.createSvg(dashGraphObjects.chartRevenueName, dashGraphObjects.chartRevenueElem);
            dashGraphObjects.transactionsSvg = dashGraphObjects.createSvg(dashGraphObjects.chartTransactionsName, dashGraphObjects.chartTransactionsElem);
            dashAddPlaceholder(dashGraphObjects.dauSvg);
            dashAddPlaceholder(dashGraphObjects.dauMauSvg);
            dashAddPlaceholder(dashGraphObjects.sessionsSvg);
            dashAddPlaceholder(dashGraphObjects.sessionLengthSvg);
            dashAddPlaceholder(dashGraphObjects.revenueSvg);
            dashAddPlaceholder(dashGraphObjects.transactionsSvg);
        }

        //Request new data shortly
        runUpdateCycle();
    })
}

function dashDrawSessionLength(json) {
    dashGraphObjects.sessionLengthY = d3.scale.linear()
      .domain([0, d3.max(json.v, function(d) { return d3.max(d.flat, function(dd){ return dd.l / dd.s; })})])
      .range([dashGraphObjects.graphHeight, 0]);

    dashGraphObjects.sessionLengthSvg = dashGraphObjects.createSvg(dashGraphObjects.chartSessionLengthName, dashGraphObjects.chartSessionLengthElem);
    dashGraphObjects.sessionLengthSvgClip = dashGraphObjects.createSvgClip(dashGraphObjects.sessionLengthSvg, "sessionlength-clip");
    dashGraphObjects.sessionLengthLine = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y(function(d) { return dashGraphObjects.sessionLengthY(d.l / d.s); });

    dashGraphObjects.sessionLengthArea = d3.svg.area()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y0(dashGraphObjects.graphHeight)
        .y1(function(d) { return dashGraphObjects.sessionLengthY(d.l / d.s); })
        .interpolate("linear");

    dashGraphObjects.sessionLengthColor = dashGraphObjects.dashColor;

    dashAddGrid(dashGraphObjects.sessionLengthSvg, dashGraphObjects.newYTimeAxis(dashGraphObjects.sessionLengthY));
    dashGraphObjects.sessionLengthTooltip = dashAddGraphTooltip();
    dashAddAxises(dashGraphObjects.sessionLengthSvg, dashGraphObjects.newYTimeAxis(dashGraphObjects.sessionLengthY));
    dashAddLegend(json, dashGraphObjects.sessionLengthSvg, dashGraphObjects.sessionLengthColor);
    dashAddArea(dashGraphObjects.sessionLengthSvg, "url(#sessionlength-clip)", dashGraphObjects.sessionLengthArea, json);

    for(var i = 0; i < json.v.length; ++i) {
        dashDrawVersion(json.v[i], (i == 0 ? "va-path" : "v-path"), dashGraphObjects.sessionLengthColor(i), dashGraphObjects.sessionLengthSvg,
            "url(#sessionlength-clip)", dashGraphObjects.sessionLengthLine, function(d) { return dashGraphObjects.sessionLengthY(d.l / d.s); },
            dashGraphObjects.sessionLengthTooltip, function(d) { return d.l / d.s; }, dashTooltipTimeFormat );
    }
}

function dashDrawDailyRevenue(json) {
    dashGraphObjects.revenueY = d3.scale.linear()
      .domain([0, d3.max(json.va.flat, function(d) { return d.a; })])
      .range([dashGraphObjects.graphHeight, 0]);

    dashGraphObjects.revenueSvg = dashGraphObjects.createSvg(dashGraphObjects.chartRevenueName, dashGraphObjects.chartRevenueElem);
    dashGraphObjects.revenueSvgClip = dashGraphObjects.createSvgClip(dashGraphObjects.revenueSvg, "revenue-clip");
    dashGraphObjects.revenueLine = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y(function(d) { return dashGraphObjects.revenueY(d.a); });

    dashGraphObjects.revenueArea = d3.svg.area()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y0(dashGraphObjects.graphHeight)
        .y1(function(d) { return dashGraphObjects.revenueY(d.a); })
        .interpolate("linear");

    dashGraphObjects.revenueColor = dashGraphObjects.dashColor;

    dashAddGrid(dashGraphObjects.revenueSvg, dashGraphObjects.newYAxisCustomFormat(dashGraphObjects.revenueY, dashCurrencyAxisFormat));
    dashGraphObjects.revenueTooltip = dashAddGraphTooltip();
    dashAddAxises(dashGraphObjects.revenueSvg, dashGraphObjects.newYAxisCustomFormat(dashGraphObjects.revenueY, dashCurrencyAxisFormat));
    dashAddLegend(json, dashGraphObjects.revenueSvg, dashGraphObjects.revenueColor);
    dashAddArea(dashGraphObjects.revenueSvg, "url(#revenue-clip)", dashGraphObjects.revenueArea, json);

    for(var i = 0; i < json.v.length; ++i) {
        dashDrawVersion(json.v[i], (i == 0 ? "va-path" : "v-path"), dashGraphObjects.revenueColor(i), dashGraphObjects.revenueSvg,
            "url(#revenue-clip)", dashGraphObjects.revenueLine, function(d) { return dashGraphObjects.revenueY(d.a); },
            dashGraphObjects.revenueTooltip, function(d) { return d.a; }, dashCurrencyFormat );
    }
}

function dashDrawTransactions(json) {
    dashGraphObjects.transactionsY = d3.scale.linear()
      .domain([0, d3.max(json.va.flat, function(d) { return d.p; })])
      .range([dashGraphObjects.graphHeight, 0]);

    dashGraphObjects.transactionsSvg = dashGraphObjects.createSvg(dashGraphObjects.chartTransactionsName, dashGraphObjects.chartTransactionsElem);
    dashGraphObjects.transactionsSvgClip = dashGraphObjects.createSvgClip(dashGraphObjects.transactionsSvg, "transactions-clip");
    dashGraphObjects.transactionsLine = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y(function(d) { return dashGraphObjects.transactionsY(d.p); });

    dashGraphObjects.transactionsArea = d3.svg.area()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y0(dashGraphObjects.graphHeight)
        .y1(function(d) { return dashGraphObjects.transactionsY(d.p); })
        .interpolate("linear");

    dashGraphObjects.transactionsColor = dashGraphObjects.dashColor;

    dashAddGrid(dashGraphObjects.transactionsSvg, dashGraphObjects.newYAxis(dashGraphObjects.transactionsY, "s"));
    dashGraphObjects.transactionsTooltip = dashAddGraphTooltip();
    dashAddAxises(dashGraphObjects.transactionsSvg, dashGraphObjects.newYAxis(dashGraphObjects.transactionsY, "s"));
    dashAddLegend(json, dashGraphObjects.transactionsSvg, dashGraphObjects.transactionsColor);
    dashAddArea(dashGraphObjects.transactionsSvg, "url(#transactions-clip)", dashGraphObjects.transactionsArea, json);

    for(var i = 0; i < json.v.length; ++i) {
        dashDrawVersion(json.v[i], (i == 0 ? "va-path" : "v-path"), dashGraphObjects.transactionsColor(i), dashGraphObjects.transactionsSvg,
            "url(#transactions-clip)", dashGraphObjects.transactionsLine, function(d) { return dashGraphObjects.transactionsY(d.p); },
            dashGraphObjects.transactionsTooltip, function(d) { return d.p; } );
    }
}


function dashDrawSessions(json) {
    dashGraphObjects.sessionsY = d3.scale.linear()
      .domain([0, d3.max(json.va.flat, function(d) { return d.s; })])
      .range([dashGraphObjects.graphHeight, 0]);

    dashGraphObjects.sessionsSvg = dashGraphObjects.createSvg(dashGraphObjects.chartSessionsName, dashGraphObjects.chartSessionsElem);
    dashGraphObjects.sessionsSvgClip = dashGraphObjects.createSvgClip(dashGraphObjects.sessionsSvg, "sessions-clip");
    dashGraphObjects.sessionsLine = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y(function(d) { return dashGraphObjects.sessionsY(d.s); });

    dashGraphObjects.sessionsArea = d3.svg.area()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y0(dashGraphObjects.graphHeight)
        .y1(function(d) { return dashGraphObjects.sessionsY(d.s); })
        .interpolate("linear");

    dashGraphObjects.sessionsColor = dashGraphObjects.dashColor;

    dashAddGrid(dashGraphObjects.sessionsSvg, dashGraphObjects.newYAxis(dashGraphObjects.sessionsY, "s"));
    dashGraphObjects.sessionsTooltip = dashAddGraphTooltip();
    dashAddAxises(dashGraphObjects.sessionsSvg, dashGraphObjects.newYAxis(dashGraphObjects.sessionsY, "s"));
    dashAddLegend(json, dashGraphObjects.sessionsSvg, dashGraphObjects.sessionsColor);
    dashAddArea(dashGraphObjects.sessionsSvg, "url(#sessions-clip)", dashGraphObjects.sessionsArea, json);

    for(var i = 0; i < json.v.length; ++i) {
        dashDrawVersion(json.v[i], (i == 0 ? "va-path" : "v-path"), dashGraphObjects.sessionsColor(i), dashGraphObjects.sessionsSvg,
            "url(#sessions-clip)", dashGraphObjects.sessionsLine, function(d) { return dashGraphObjects.sessionsY(d.s); },
            dashGraphObjects.sessionsTooltip, function(d) { return d.s; } );
    }
}

function dashDrawDAUMAU(json) {
    dashGraphObjects.dauMauY = d3.scale.linear()
      .domain([0, d3.max(json.v, function(d) { return d3.max(d.flat, function(dd){ return dd.c / dd.mo.c; })})])
      .range([dashGraphObjects.graphHeight, 0]);

    dashGraphObjects.dauMauSvg = dashGraphObjects.createSvg(dashGraphObjects.chartDauMauName, dashGraphObjects.chartDauMauElem);
    dashGraphObjects.dauMauSvgClip = dashGraphObjects.createSvgClip(dashGraphObjects.dauMauSvg, "daumau-clip");
    dashGraphObjects.dauMauLine = d3.svg.line()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y(function(d) { return dashGraphObjects.dauMauY(d.c / d.mo.c); })
        .interpolate("linear");
    dashGraphObjects.dauMauArea = d3.svg.area()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y0(dashGraphObjects.graphHeight)
        .y1(function(d) { return dashGraphObjects.dauMauY(d.c / d.mo.c); })
        .interpolate("linear");

    dashGraphObjects.dauMauColor = dashGraphObjects.dashColor;

    dashAddGrid(dashGraphObjects.dauMauSvg, dashGraphObjects.newYAxis(dashGraphObjects.dauMauY));
    dashGraphObjects.dauMauTooltip = dashAddGraphTooltip();
    dashAddAxises(dashGraphObjects.dauMauSvg, dashGraphObjects.newYAxis(dashGraphObjects.dauMauY));
    dashAddLegend(json, dashGraphObjects.dauMauSvg, dashGraphObjects.dauMauColor);
    dashAddArea(dashGraphObjects.dauMauSvg, "url(#daumau-clip)", dashGraphObjects.dauMauArea, json);

    for(var i = 0; i < json.v.length; ++i) {
        dashDrawVersion(json.v[i], (i == 0 ? "va-path" : "v-path"), dashGraphObjects.dauMauColor(i), dashGraphObjects.dauMauSvg, "url(#daumau-clip)",
            dashGraphObjects.dauMauLine, function(d) { return dashGraphObjects.dauMauY(d.c / d.mo.c); }, dashGraphObjects.dauMauTooltip,
            function(d) { return d.c / d.mo.c; }, dashTooltipDauMauFormat );
    }
}

function dashDrawDAU(json) {
    var maxDau = d3.max(json.va.flat, function(d) { return d.c; });
    dashGraphObjects.maxDau = maxDau;

    dashGraphObjects.dauY = d3.scale.linear()
      .domain([0, maxDau])
      .range([dashGraphObjects.graphHeight, 0]);


    dashGraphObjects.dauSvg = dashGraphObjects.createSvg(dashGraphObjects.chartDauName, dashGraphObjects.chartDauElem);
    dashGraphObjects.dauSvgClip = dashGraphObjects.createSvgClip(dashGraphObjects.dauSvg, "dau-clip");
    dashGraphObjects.dauLine = d3.svg.line()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y(function(d) { return dashGraphObjects.dauY(d.c); })
        .interpolate("linear");
    dashGraphObjects.dauArea = d3.svg.area()
        .x(function(d) { return dashGraphObjects.x(d.date); })
        .y0(dashGraphObjects.graphHeight)
        .y1(function(d) { return dashGraphObjects.dauY(d.c); })
        .interpolate("linear");

    dashGraphObjects.dauColor = dashGraphObjects.dashColor;


    dashAddGrid(dashGraphObjects.dauSvg, dashGraphObjects.newYAxis(dashGraphObjects.dauY));
    dashGraphObjects.dauTooltip = dashAddGraphTooltip();
    dashAddAxises(dashGraphObjects.dauSvg, dashGraphObjects.newYAxis(dashGraphObjects.dauY));
    dashAddLegend(json, dashGraphObjects.dauSvg, dashGraphObjects.dauColor);
    dashAddArea(dashGraphObjects.dauSvg, "url(#dau-clip)", dashGraphObjects.dauArea, json);

    for(var i = 0; i < json.v.length; ++i) {
        dashDrawVersion(json.v[i], (i == 0 ? "va-path" : "v-path"), dashGraphObjects.dauColor(i), dashGraphObjects.dauSvg, "url(#dau-clip)",
            dashGraphObjects.dauLine, function(d) { return dashGraphObjects.dauY(d.c); }, dashGraphObjects.dauTooltip, function(d) { return d.c; } );
    }
}


function dashAddPlaceholder(svg) {
    var placeholder = svg.append("g")
        .attr("class", "placeholder")
        .attr("x", 0)
        .attr("y", 0)
        .attr("height", dashGraphObjects.graphHeight)
        .attr("width", dashGraphObjects.graphWidth);

    placeholder.append("rect")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", dashGraphObjects.graphWidth)
        .attr("height", dashGraphObjects.graphHeight)
        .style("fill", "#F0F0F0");

    placeholder.append("text")
                .attr("x", 35)
                .attr("y", 55)
                .attr("height", 30)
                .attr("width", dashGraphObjects.graphWidth)
                .style("fill", dashGraphObjects.dashColor(0))
                .text("Unfortunately, there is no data yet.");

    return placeholder;
}

function dashAddArea(svg, clipName, area, json) {
    return svg.append("path")
        .attr("clip-path", clipName)
        .datum(json.v[0].flat)
        .attr("class", "va-area")
        .attr("d", area);
}

function dashAddGraphTooltip() {
    return d3.select("body").append("div")
        .attr("class", "graph-tooltip")
        .style("opacity", 1e-6);
}

function dashAddAxises(svg, y) {
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + dashGraphObjects.graphHeight + ")")
        .call(dashGraphObjects.newXAxis());

    svg.append("g")
        .attr("class", "y axis")
        .call(y);
}

function dashAddGrid(svg, yAxis) {
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + dashGraphObjects.graphHeight + ")")
        .style("stroke-dasharray", ("1, 3"))
        .call(dashGraphObjects.newXAxis()
            .tickSize(-dashGraphObjects.graphHeight, 0, 0)
            .tickFormat(""));

    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", ("1, 2"))
        .call(yAxis
            .tickSize(-dashGraphObjects.graphWidth, 0, 0)
            .tickFormat(""));
}

function dashAddLegend(json, svg, color) {
    var legend = svg.append("g")
	  .attr("class", "legend")
	  .attr("x", 25)
	  .attr("y", 25)
	  .attr("height", 100)
	  .attr("width", 100)
      .on("mouseover", function(d){
              d3.select(this)
                  .transition()
                  .duration(100)
                  .attr("opacity", 0.1);
              })
      .on("mouseout", function(d){
              d3.select(this)
                  .transition()
                  .duration(100)
                  .attr("opacity", 1.0);
              });

    legend.selectAll('g')
      .data(json.v)
      .enter()
      .append('g')
      .each(function(d, i) {
        var g = d3.select(this);
        g.append("rect")
          .attr("x", 15)
          .attr("y", i * 15)
          .attr("width", 10)
          .attr("height", 10)
          .style("fill", color(i));

        g.append("text")
          .attr("x", 35)
          .attr("y", i * 15 + 8)
          .attr("height",30)
          .attr("width",100)
          .style("fill", color(i))
          .text("v " + d.title);
      });

    return legend;
}

function dashDrawVersion(json, pathStyle, color, svg, clipname, line, yFunc, tooltip, tooltipValue, tooltipFormat) {
    var m_names = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var numberFormat = tooltipFormat == undefined ? d3.format(",") : tooltipFormat;

    var versionLine = svg.append("path")
        .attr("clip-path", clipname)
        .datum(json.flat)
        .attr("class", pathStyle)
        .attr("d", line)
        .attr("stroke", color);

    var versionCircles = svg.selectAll(".circle" + json.title.replace(".", "-"))
        .data(json.flat)
        .enter()
        .append("g");

    versionCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 4)
        .attr("fill", color)
        .attr("fill-opacity", 1.0)
        .attr("cx", function(d) { return dashGraphObjects.x(d.date); })
        .attr("cy", yFunc);

    versionCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 8)
        .attr("fill", color)
        .attr("fill-opacity", 0.0)
        .attr("cx", function(d) { return dashGraphObjects.x(d.date); })
        .attr("cy", yFunc)
        .on("mouseover", function(d) {
            d3.select(this)
                .transition()
                .duration(50)
                .attr("r", 10)
                .attr("fill-opacity", 0.5);

            tooltip.style("border-color", color);
            tooltip.style("color", color);

            tooltip.transition()
                .duration(50)
                .style("opacity", .9);

            tooltip.html("" + m_names[d.date.getMonth()] + " " + d.date.getDate() + "<br><b>"  + numberFormat(tooltipValue(d)) + "</b>")
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
            })
            .on("mouseout", function(d) {
                d3.select(this)
                    .transition()
                    .duration(25)
                    .attr("r", 8)
                    .attr("fill-opacity", 0.0);

                tooltip.transition()
                    .duration(25)
                    .style("opacity", 0);
            });
}

function runUpdateCycle() {
    dashGraphObjects.period = recalcPeriod();
    setTimeout(function() {
        var todayDate = new Date();
        var twoWeeksAgoDate = new Date(); twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 14);
        todayDate.setHours(23, 59, 59);
        twoWeeksAgoDate.setHours(0, 0, 0, 0);

        var dataUrl = "/data/dashboard/" + mobileAppId + "/" + convertDateToUTC(twoWeeksAgoDate).getTime() + "/" + convertDateToUTC(todayDate).getTime();

        dashDrawGraphs(dataUrl, twoWeeksAgoDate, todayDate);
    }, dashGraphObjects.period);
}

function initializeDashGraphs() {
    runUpdateCycle();
}
