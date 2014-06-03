/**
 * Created with IntelliJ IDEA.
 * User: Alexander
 * Date: 13/11/13
 * Time: 22:01
 * To change this template use File | Settings | File Templates.
 */

var ecoBalGraphObjects = {};

var graphMargins = {
    left: 42,
    right: 10,
    top: 5,
    bottom: 50
};

function ecoBalTimeFormat(d) {
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

function ecoBalRemoveNonDayObjValues(obj, depth) {
    var result = {};
    depth = depth != undefined ? depth : -1;

    for (var k in obj)
        if (obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" && !(prop instanceof Date || prop instanceof RegExp) && depth != 0 && k != "geo") {
                //Uncomment if you want to have a path like 2013.9.c l s p a pu values
                result/*[k] */= ecoBalRemoveNonDayObjValues(prop, depth - 1);
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

function ecoBalEnsureValuesPresence(val) {
    if(val.c == undefined) val.c = 0;
    if(val.l == undefined) val.l = 0;
    if(val.s == undefined) val.s = 0;
    if(val.a == undefined) val.a = 0;
    if(val.p == undefined) val.p = 0;
    if(val.pu == undefined) val.pu = 0;
}

function ecoBalancePrepareData(json) {
    var parseDate = d3.time.format("%Y_%m_%d").parse;

    //Flat the aggregated data va
    //Rip out c, l and s values, those are monthly and we will display them in widgets
    var monthCLS = ecoBalRemoveNonDayObjValues(json.va, 2);
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
        ecoBalEnsureValuesPresence(json.va.flat[dd]);

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
        var versionMonthlyCLS = ecoBalRemoveNonDayObjValues(json.v[v], 2);
        json.v[v].flat = flattenJson(json.v[v], 2);

        var flatArray = [];
        for(var d in json.v[v].flat)
        if (json.v[v].flat.hasOwnProperty(d) ){
            json.v[v].flat[d].date = parseDate(d);
            json.v[v].flat[d].mo = versionMonthlyCLS;
            ecoBalEnsureValuesPresence(json.v[v].flat[d]);

            flatArray.push(json.v[v].flat[d]);
        }

        json.v[v].flat = flatArray;
        json.v[v].title = atob(v); //decode title
        versionsArray.push(json.v[v])
    }
    json.v = versionsArray;
}


function initializeEconomyBalanceGraphs() {
    var todayDate = new Date();
    var dataUrl = "/data/eco/balance/" + mobileAppId + "/" + convertDateToUTC(todayDate).getTime();
    ecoBalanceInitGraphs(dataUrl, todayDate);
}

function ecoBalDrawGraphs(items) {
    if(items.length == 0) return;

    ecoBalGraphObjects.selectedItems = items;
    var maxEcoBalValue =  d3.max(ecoBalGraphObjects.dataJson.va.flat, function(d) {
        return d3.max(d.e, function(dd) { return items.indexOf(dd.id) <= -1 ? 0 : (dd.val / dd.hits); });
                    });

    ecoBalGraphObjects.ecoBalY = d3.scale.linear()
        .domain([0, maxEcoBalValue])
        .range([ecoBalGraphObjects.graphHeight, 0]);


    ecoBalGraphObjects.ecoBalSvg = ecoBalGraphObjects.createSvg(ecoBalGraphObjects.chartItemsBalanceName, ecoBalGraphObjects.chartItemsBalanceElem);
    ecoBalGraphObjects.ecoBalSvgClip = ecoBalGraphObjects.createSvgClip(ecoBalGraphObjects.ecoBalSvg, "ecobal-clip",
        ecoBalGraphObjects.graphWidth, ecoBalGraphObjects.graphHeight);

    var xTicks = ecoBalGraphObjects.dataJson.va.flat.length;
    ecoBalAddGrid(ecoBalGraphObjects.ecoBalSvg, ecoBalGraphObjects.newTimeXAxis().ticks(xTicks), ecoBalGraphObjects.newYAxis(ecoBalGraphObjects.ecoBalY),
        ecoBalGraphObjects.graphWidth, ecoBalGraphObjects.graphHeight);
    ecoBalGraphObjects.ecoBalTooltip = ecoBalAddGraphTooltip(true);
    ecoBalAddAxises(ecoBalGraphObjects.ecoBalSvg, ecoBalGraphObjects.newTimeXAxis().ticks(xTicks), ecoBalGraphObjects.newYAxis(ecoBalGraphObjects.ecoBalY),
        ecoBalGraphObjects.graphHeight);
    ecoBalAddLegend(items, ecoBalGraphObjects.ecoBalSvg, ecoBalGraphObjects.ecoBalColor);

    for(var i = 0; i < items.length; ++i) {
        var lineYFunc = function(d) {
            return ecoBalGraphObjects.ecoBalY(d.eobj[items[i]] / d.eobj.c[items[i]]);
        };

        var lineFunc = d3.svg.line()
                .x(function(d) {
                return ecoBalGraphObjects.timeX(d.date); })
                .y(lineYFunc)
                .interpolate("linear");

        ecoBalDrawItems(ecoBalGraphObjects.dataJson.va.flat, "v-path", ecoBalGraphObjects.ecoBalColor(i), ecoBalGraphObjects.ecoBalSvg, "url(#ecobal-clip)",
            lineFunc, lineYFunc, ecoBalGraphObjects.ecoBalTooltip, function(d, id) { return d.eobj[id] / d.eobj.c[id]; } );
    }

    //Now also update the progression \ accumulation graph
    var ecoProgressItems = ecoBalGraphObjects.dataJson.va.flat[0].mo.flatEcoItems;

    var maxEcoProgValue =  d3.max(ecoProgressItems, function(d) {
        return items.indexOf(d.id) <= -1 ? 0 : d3.max(d.elem, function(dd) { return dd.y; });
                    });

    var maxEcoProgXValue =  d3.max(ecoProgressItems, function(d) {
        return items.indexOf(d.id) <= -1 ? 0 : d3.max(d.elem, function(dd) { return dd.x; });
                    });

    ecoBalGraphObjects.ecoProgressY = d3.scale.linear()
      .domain([0, maxEcoProgValue])
      .range([ecoBalGraphObjects.graphHeight, 0]);

    ecoBalGraphObjects.ecoProgressX = d3.scale.linear()
      .domain([0, maxEcoProgXValue])
      .range([0, ecoBalGraphObjects.graphWidth]);

    ecoBalGraphObjects.ecoBalProgSvg = ecoBalGraphObjects.createSvg(ecoBalGraphObjects.chartBalanceProgressionName, ecoBalGraphObjects.chartBalanceProgressionElem);
    ecoBalGraphObjects.ecoBalProgSvgClip = ecoBalGraphObjects.createSvgClip(ecoBalGraphObjects.ecoBalProgSvg, "ecobalpr-clip",
        ecoBalGraphObjects.graphWidth, ecoBalGraphObjects.graphHeight);

    var xTicks = maxEcoProgXValue; if(xTicks > 50) xTicks = 50;
    ecoBalAddGrid(
        ecoBalGraphObjects.ecoBalProgSvg,
        ecoBalGraphObjects.newXAxis(ecoBalGraphObjects.ecoProgressX).ticks(xTicks),
        ecoBalGraphObjects.newYAxis(ecoBalGraphObjects.ecoProgressY),
        ecoBalGraphObjects.graphWidth, ecoBalGraphObjects.graphHeight);

    ecoBalGraphObjects.ecoBalProgTooltip = ecoBalAddGraphTooltip();
    ecoBalAddAxises(
        ecoBalGraphObjects.ecoBalProgSvg,
        ecoBalGraphObjects.newXAxis(ecoBalGraphObjects.ecoProgressX).ticks(xTicks),
        ecoBalGraphObjects.newYAxis(ecoBalGraphObjects.ecoProgressY),
        ecoBalGraphObjects.graphHeight);
    ecoBalAddLegend(items, ecoBalGraphObjects.ecoBalProgSvg, ecoBalGraphObjects.ecoBalColor);

    for(var j = 0; j < items.length; ++j) {
        var lineProgYFunc = function(d) { return ecoBalGraphObjects.ecoProgressY(d.y); };

        var lineProgFunc = d3.svg.line()
                .x(function(d) {
                return ecoBalGraphObjects.ecoProgressX(d.x); })
                .y(lineProgYFunc)
                .interpolate("linear");

        ecoBalDrawItems(ecoBalGraphObjects.dataJson.va.flat[0].mo.e[items[j]], "v-path", ecoBalGraphObjects.ecoBalColor(j), ecoBalGraphObjects.ecoBalProgSvg, "url(#ecobalpr-clip)",
            lineProgFunc, lineProgYFunc, ecoBalGraphObjects.ecoBalProgTooltip,
            function(d) { return d.y; }, undefined, function(d) { return ecoBalGraphObjects.ecoProgressX(d.x); } );
    }
}

function ecoBalDrawItems(json, pathStyle, color, svg, clipname, line, yFunc, tooltip, tooltipValue, tooltipFormat, xFunc) {
    var m_names = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var numberFormat = tooltipFormat == undefined ? d3.format(",") : tooltipFormat;
    var xFunction = xFunc == undefined ? (function(d) { return ecoBalGraphObjects.timeX(d.date); }) : xFunc;

    var itemsLine = svg.append("path")
        .attr("clip-path", clipname)
        .datum(json)
        .attr("class", pathStyle)
        .attr("d", line)
        .attr("stroke", color);

    var title = json.title == undefined ? "PROG" : json.title;
    var versionCircles = svg.selectAll(".circle" + title.replace(".", "-"))
        .data(json)
        .enter()
        .append("g");

    versionCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 4)
        .attr("fill", color)
        .attr("fill-opacity", 1.0)
        .attr("cx", xFunction)
        .attr("cy", yFunc);

    versionCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 8)
        .attr("fill", color)
        .attr("fill-opacity", 0.0)
        .attr("cx", xFunction)
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

            if(d.date == undefined) {
                tooltip.html("Timeline: " + d.x + "<br><b>"  + numberFormat(tooltipValue(d).toFixed(2)) + " per player</b>")
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
            } else {
                var str = "<b>" + m_names[d.date.getMonth()] + " " + d.date.getDate() + "<br></b><div style='text-align: left;'>";
                for(var ii = 0; ii < d.e.length; ii++)
                if(ecoBalGraphObjects.selectedItems.indexOf(d.e[ii].id) > -1) {
                    str += atob(d.e[ii].id) + ": <b>" + numberFormat(tooltipValue(d, d.e[ii].id).toFixed(2)) + "</b> per player";
                    if(ii != d.e.length - 1) str += "<br>";
                }
                str += "</div>";

                tooltip.html(str)
                    .style("left", (d3.event.pageX) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");

            }


        }).on("mouseout", function(d) {
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

function ecoBalAddLegend(json, svg, color) {
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
      .data(json)
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
          .text(atob(d)); //Decode the title
      });

    return legend;
}

function ecoBalAddGraphTooltip(wide) {
    className = wide == undefined ? "graph-tooltip" : "graph-tooltipwide";
    return d3.select("body").append("div")
        .attr("class", className)
        .style("opacity", 1e-6);
}

function ecoBalAddAxises(svg, x, y, height) {
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + height + ")")
        .call(x);

    svg.append("g")
        .attr("class", "y axis")
        .call(y);
}

function ecoBalAddGrid(svg, xAxis, yAxis, width, height) {
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + height + ")")
        .style("stroke-dasharray", ("1, 3"))
        .call(xAxis
            .tickSize(-height, 0, 0)
            .tickFormat(""));

    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", ("1, 2"))
        .call(yAxis
            .tickSize(-width, 0, 0)
            .tickFormat(""));
}

$(function(){
    var trackedItems = $("#trackedItems")
    trackedItems.select2({
        placeholder: "Select items"
    });

    trackedItems.on("change", function(e) { ecoBalDrawGraphs(e.val); });
    initializeEconomyBalanceGraphs();
});


function ecoBalanceInitGraphs(dataUrl, todayDate) {
    ecoBalGraphObjects.chartItemsBalanceName = "ecoitemsbalancechart";
    ecoBalGraphObjects.chartItemsBalanceElem = $("#" + ecoBalGraphObjects.chartItemsBalanceName);

    ecoBalGraphObjects.chartBalanceProgressionName = "ecobalanceprogressionchart";
    ecoBalGraphObjects.chartBalanceProgressionElem = $("#" + ecoBalGraphObjects.chartBalanceProgressionName);

    ecoBalGraphObjects.graphWidth = ecoBalGraphObjects.chartItemsBalanceElem.width() - graphMargins.left - graphMargins.right;
    ecoBalGraphObjects.graphHeight = ecoBalGraphObjects.chartItemsBalanceElem.height() - graphMargins.top - graphMargins.bottom;

    d3.json(dataUrl, function(error, json) {
        //Show placeholder if needed
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
            return;
        } else
            $("#noDataBlock").hide();

        //Convert data to a format that D3JS can digest
        ecoBalancePrepareData(json);
        ecoBalGraphObjects.dataJson = json;

        //Update our items selector
        var itemsGroup = $("#trackedItemsGroup");
        for(var i = 0; i < json.va.flat[0].mo.flatEcoItems.length; ++i) {
            var ecoEl = json.va.flat[0].mo.flatEcoItems[i];
            itemsGroup.append("<option value='" + ecoEl.id + "'>" + ecoEl.text + "</option>")
        }

        $("#trackedItems").select2({
            placeholder: "Select items"
        });

        //Aggregated versions data has longest period and highest count, so we only base on them
        ecoBalGraphObjects.timeX = d3.time.scale()
            .domain([json.va.flat[0].date, json.va.flat[json.va.flat.length - 1].date])
            //.domain(d3.extent(json.va.flat, function(d) { return d.date; }))
            .range([0, ecoBalGraphObjects.graphWidth]);

        ecoBalGraphObjects.newXAxis = function(x, format) {
            return d3.svg.axis()
                   .scale(x)
                   .tickFormat(d3.format(format));
        };

        ecoBalGraphObjects.newTimeXAxis = function() {
            return d3.svg.axis()
                    .scale(ecoBalGraphObjects.timeX)
                    .tickFormat(ecoBalTimeFormat);
        };

        ecoBalGraphObjects.newYAxis = function(y, format) {
                return d3.svg.axis()
                       .scale(y)
                       .orient("left")
                       .tickFormat(d3.format(format));
        };

        ecoBalGraphObjects.newYAxisCustomFormat = function(y, format) {
                return d3.svg.axis()
                       .scale(y)
                       .orient("left")
                       .tickFormat(format);
        };

        ecoBalGraphObjects.createSvg = function(chartName, chartElem) {
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

        ecoBalGraphObjects.createSvgClip = function(svg, clipName, width, height) {
            return svg.append("defs").append("clipPath")
                .attr("id", clipName)
                .append("rect")
                .attr("y", -30) //Give some space for dots
                .attr("width", width)
                .attr("height", height + 30);
        };

        ecoBalGraphObjects.ecoBalColor = json.v.size > 10 ? d3.scale.category20() : d3.scale.category10();
        //Now let's wait for user to select items to track
    })
}