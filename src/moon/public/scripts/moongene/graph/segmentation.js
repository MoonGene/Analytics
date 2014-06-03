
var graphMargins = {
    left: 42,
    right: 10,
    top: 5,
    bottom: 50
};

function segmWidgetMauDauFormat(d) {
    if(d > 1000000) return (d / 1000000).toFixed(1) + "M";
    if(d > 100000) return (d / 1000).toFixed(0) + "k";
    if(d > 10000) return (d / 1000).toFixed(1) + "k";
    if(d > 1000) return (d / 1000).toFixed(2) + "k";
    return d;
}

function segmWidgetSessionLengthFormat(d) {
    if(d > 3600) return (d / 3600).toFixed(1) + "h";
    if(d > 60) return (d / 60).toFixed(1) + "m";
    return d + "s";
}

function segmTooltipDauMauFormat(d) {
    return d.toFixed(3);
}

function segmTooltipTimeFormat(d) {
    var hours = (d / 3600).toFixed(0);
    var minutes = ((d % 3600) / 60).toFixed(0);
    var seconds = ((d % 3600) % 60).toFixed(0);

    if(hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
    if(minutes > 0) return minutes + "m " + seconds + "s";
    return seconds + "s";
}

function segmYAxisTimeFormat(d) {
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

function segmCurrencyFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    return "$" + currencyFormat(d.toFixed(2));
}

function segmCurrencyAxisFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    if(d > 10000) return "$" + dashWidgetMauDauFormat(d);
    if(d > 100) return "$" + currencyFormat(d.toFixed(0));
    return "$" + d.toFixed(d < 10 && d != 0 ? 2 : 0);
}

function segmTimeFormatDetailed(d) {
    var formatFull = d3.time.format("%b %-d");
    return formatFull(d);
}

function segmTimeFormat(d) {
    var formatFull = d3.time.format("%b %-d");
    var formatShort = d3.time.format("%-d");

    var date = new Date(d);
    if(date.getDate() == 1 || date.getDate() == 10 || date.getDate() == 20)
        return formatFull(d);
    else
        return formatShort(d);
}

var segmentDataObject = {

};

var segmentData =
{
    appId: mobileAppId,
    dateFromMs: 0,
    dateToMs: 0,
    countries: [],
    resolution: [],
    vendor: [],
    model: [],
    carrier: [],
    platform: [],
    platformV: []
};

function processSegmentData(json) {
    var converted = {};
    var parseDate = d3.time.format("%Y-%m-%d").parse;

    var flatArray = [];
    for (var k in json)
    if (json.hasOwnProperty(k)) {
        var prop = json[k];
        if(prop) {
            //Example: 2013-10-4-usr
            var idParts = k.split("-");
            var date = idParts[0] + "-" + idParts[1] + "-" + idParts[2];
            if(converted[date] == undefined) {
                converted[date] = {};
                flatArray.push(converted[date]);
            }
            converted[date].date = parseDate(date);
            converted[date][idParts[3]] = prop;
        }
    }

    json.cooked = converted;
    json.flat = flatArray;
    json.flat.sort(function(a,b){
            a = a.date;
            b = b.date;
            return a < b ? -1 : a > b ? 1 : 0;
        });

    //Calculate widget values
    var totalSessionsTime = 0;
    var totalDauNum = 0;
    var totalSessionsNum = 0;
    var totalPaymentAmount = 0;
    var totalPayingUsers = 0;
    for(var i = 0; i < json.flat.length; ++i) {
        totalSessionsTime += json.flat[i].len;
        totalDauNum += json.flat[i].ses / json.flat[i].avg;
        totalSessionsNum += json.flat[i].ses;
        totalPaymentAmount += json.flat[i].amt;
        totalPayingUsers += json.flat[i].pu;
    }
    segmentDataObject.averageDau = (totalDauNum / json.flat.length).toFixed(0);
    segmentDataObject.averageSessionLength = totalSessionsTime / totalSessionsNum;
    segmentDataObject.averageARPU = (totalPaymentAmount / totalSessionsNum).toFixed(2);
    segmentDataObject.averageARPPU = (totalPaymentAmount / totalPayingUsers).toFixed(2);
}

function segmentUpdateWidgets(erase) {
    var eraseData = erase != undefined ? erase : false;
    if(eraseData) {
        $("#SegmentWidgetDau").text("0");
        $("#SegmentWidgetSessionLength").text("0");
        $("#SegmentWidgetARPU").text("$0.0");
        $("#SegmentWidgetARPPU").text("$0.0");
    } else {
        $("#SegmentWidgetDau").text(segmWidgetMauDauFormat(segmentDataObject.averageDau));
        $("#SegmentWidgetSessionLength").text(segmWidgetSessionLengthFormat(segmentDataObject.averageSessionLength));
        $("#SegmentWidgetARPU").text(segmCurrencyFormat(segmentDataObject.averageARPU));
        $("#SegmentWidgetARPPU").text(segmCurrencyFormat(segmentDataObject.averageARPPU));
    }
}

function updateSegmentGraphs() {
    //Aggregated versions data has longest period and highest count, so we only base on them
    segmentDataObject.x = d3.time.scale()
        .domain([segmentDataObject.dateFrom, segmentDataObject.dateTo])
        //.domain(d3.extent(json.va.flat, function(d) { return d.date; }))
        .range([0, segmentDataObject.graphWidth]);

    var xTicks = 14;
    var daysInRange = (segmentDataObject.dateTo - segmentDataObject.dateFrom) / (1000 * 60 * 60 * 24);
    if(daysInRange < 14) xTicks = Math.ceil(daysInRange);

    segmentDataObject.newXAxis = function() {
        return d3.svg.axis()
                .scale(segmentDataObject.x)
                .tickFormat(daysInRange < 12 ? segmTimeFormatDetailed : segmTimeFormat)
                .ticks(xTicks);};

    segmentDataObject.createSvg = function(chartName, chartElem) {
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

    segmentDataObject.createSvgClip = function(svg, clipName) {
        return svg.append("defs").append("clipPath")
            .attr("id", clipName)
            .append("rect")
                .attr("y", -30) //Give some space for dots
                .attr("width", segmentDataObject.graphWidth)
                .attr("height", segmentDataObject.graphHeight + 30);
    };

    segmentDataObject.newYAxis = function(y, format) {
            return d3.svg.axis()
                   .scale(y)
                   .orient("left")
                   .tickFormat(d3.format(format));
    };

    segmentDataObject.newYAxisCustomFormat = function(y, format) {
            return d3.svg.axis()
                   .scale(y)
                   .orient("left")
                   .tickFormat(format);
    };

    segmentDataObject.newYTimeAxis = function(y) {
            return d3.svg.axis()
                   .scale(y)
                   .orient("left")
                   .tickFormat(segmYAxisTimeFormat);
    };

    segmentDataObject.segmentColor = d3.scale.category10();

    segmentDrawDAU(segmentDataObject.data.flat);
    segmentDrawRevenue(segmentDataObject.data.flat);
    segmentDrawSessions(segmentDataObject.data.flat);
    segmentDrawSessionLength(segmentDataObject.data.flat);

}

function segmentDrawRevenue(json) {
    var maxRevenue = d3.max(json, function(d) { return d.amt; });
    segmentDataObject.maxRevenue = maxRevenue;

    segmentDataObject.revenueY = d3.scale.linear()
      .domain([0, maxRevenue])
      .range([segmentDataObject.graphHeight, 0]);

    segmentDataObject.revenueSvg = segmentDataObject.createSvg(segmentDataObject.chartRevenueName, segmentDataObject.chartRevenueElem);
    segmentDataObject.revenueSvgClip = segmentDataObject.createSvgClip(segmentDataObject.revenueSvg, "revenue-clip");
    segmentDataObject.revenueLine = d3.svg.line()
        .x(function(d) { return segmentDataObject.x(d.date); })
        .y(function(d) { return segmentDataObject.revenueY(d.amt); })
        .interpolate("linear");

    segmentDataObject.revenueColor = segmentDataObject.segmentColor;

    segmAddGrid(segmentDataObject.revenueSvg, segmentDataObject.newYAxisCustomFormat(segmentDataObject.revenueY, segmCurrencyAxisFormat));
    segmentDataObject.revenueTooltip = segmAddGraphTooltip();
    segmAddAxises(segmentDataObject.revenueSvg, segmentDataObject.newYAxisCustomFormat(segmentDataObject.revenueY, segmCurrencyAxisFormat));
    segmDrawData(json, "v-path", segmentDataObject.revenueColor(0), segmentDataObject.revenueSvg, "url(#revenue-clip)", segmentDataObject.revenueLine,
        function(d) {
            return segmentDataObject.revenueY(d.amt);
        },
        segmentDataObject.revenueTooltip,
        function(d) {
            return d.amt;
        }, segmCurrencyFormat );
}

function segmentDrawDAU(json) {
    var maxDau = d3.max(json, function(d) { return d.ses / d.avg; });
    segmentDataObject.maxDau = maxDau;

    segmentDataObject.dauY = d3.scale.linear()
      .domain([0, maxDau])
      .range([segmentDataObject.graphHeight, 0]);

    segmentDataObject.dauSvg = segmentDataObject.createSvg(segmentDataObject.chartDauName, segmentDataObject.chartDauElem);
    segmentDataObject.dauSvgClip = segmentDataObject.createSvgClip(segmentDataObject.dauSvg, "dau-clip");
    segmentDataObject.dauLine = d3.svg.line()
        .x(function(d) { return segmentDataObject.x(d.date); })
        .y(function(d) { return segmentDataObject.dauY(d.ses / d.avg); })
        .interpolate("linear");

    segmentDataObject.dauColor = segmentDataObject.segmentColor;

    segmAddGrid(segmentDataObject.dauSvg, segmentDataObject.newYAxis(segmentDataObject.dauY));
    segmentDataObject.dauTooltip = segmAddGraphTooltip();
    segmAddAxises(segmentDataObject.dauSvg, segmentDataObject.newYAxis(segmentDataObject.dauY));
    segmDrawData(json, "v-path", segmentDataObject.dauColor(0), segmentDataObject.dauSvg, "url(#dau-clip)", segmentDataObject.dauLine,
        function(d) {
            return segmentDataObject.dauY((d.ses / d.avg).toFixed(0));
        },
        segmentDataObject.dauTooltip,
        function(d) {
            return (d.ses / d.avg).toFixed(0);
        } );
}

function segmentDrawSessions(json) {
    segmentDataObject.sessionsY = d3.scale.linear()
      .domain([0, d3.max(json, function(d) { return d.ses; })])
      .range([segmentDataObject.graphHeight, 0]);

    segmentDataObject.sessionsSvg = segmentDataObject.createSvg(segmentDataObject.chartSessionsName, segmentDataObject.chartSessionsElem);
    segmentDataObject.sessionsSvgClip = segmentDataObject.createSvgClip(segmentDataObject.sessionsSvg, "sessions-clip");
    segmentDataObject.sessionsLine = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return segmentDataObject.x(d.date); })
        .y(function(d) { return segmentDataObject.sessionsY(d.ses); });

    segmentDataObject.sessionsColor = segmentDataObject.segmentColor;

    segmAddGrid(segmentDataObject.sessionsSvg, segmentDataObject.newYAxis(segmentDataObject.sessionsY, "s"));
    segmentDataObject.sessionsTooltip = segmAddGraphTooltip();
    segmAddAxises(segmentDataObject.sessionsSvg, segmentDataObject.newYAxis(segmentDataObject.sessionsY, "s"));

    segmDrawData(json, "v-path", segmentDataObject.sessionsColor(0), segmentDataObject.sessionsSvg, "url(#sessions-clip)", segmentDataObject.sessionsLine,
        function(d) {return segmentDataObject.sessionsY(d.ses);}, segmentDataObject.sessionsTooltip, function(d) {return d.ses;});
}

function segmentDrawSessionLength(json) {
    segmentDataObject.sessionLengthY = d3.scale.linear()
      .domain([0, d3.max(json, function(d) { return d.len / d.ses; })])
      .range([segmentDataObject.graphHeight, 0]);

    segmentDataObject.sessionLengthSvg = segmentDataObject.createSvg(segmentDataObject.chartSessionLengthName, segmentDataObject.chartSessionLengthElem);
    segmentDataObject.sessionLengthSvgClip = segmentDataObject.createSvgClip(segmentDataObject.sessionLengthSvg, "sessionlength-clip");
    segmentDataObject.sessionLengthLine = d3.svg.line()
        .interpolate("linear")
        .x(function(d) { return segmentDataObject.x(d.date); })
        .y(function(d) { return segmentDataObject.sessionLengthY(d.len / d.ses); });

    segmentDataObject.sessionLengthColor = segmentDataObject.segmentColor;

    segmAddGrid(segmentDataObject.sessionLengthSvg, segmentDataObject.newYTimeAxis(segmentDataObject.sessionLengthY));
    segmentDataObject.sessionLengthTooltip = segmAddGraphTooltip();
    segmAddAxises(segmentDataObject.sessionLengthSvg, segmentDataObject.newYTimeAxis(segmentDataObject.sessionLengthY));

    segmDrawData(json, "v-path", segmentDataObject.sessionLengthColor(0), segmentDataObject.sessionLengthSvg, "url(#sessionlength-clip)",
        segmentDataObject.sessionLengthLine, function(d) { return segmentDataObject.sessionLengthY(d.len / d.ses ); },
        segmentDataObject.sessionLengthTooltip, function(d) {return d.len / d.ses;}, segmTooltipTimeFormat);
}

function segmDrawData(json, pathStyle, color, svg, clipname, line, yFunc, tooltip, tooltipValue, tooltipFormat) {
    var m_names = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var numberFormat = tooltipFormat == undefined ? d3.format(",") : tooltipFormat;

    var dataLine = svg.append("path")
        .attr("clip-path", clipname)
        .datum(json)
        .attr("class", pathStyle)
        .attr("d", line)
        .attr("stroke", color);

    var dataCircles = svg.selectAll(".circle")
        .data(json)
        .enter()
        .append("g");

    dataCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 4)
        .attr("fill", color)
        .attr("fill-opacity", 1.0)
        .attr("cx", function(d) { return segmentDataObject.x(d.date); })
        .attr("cy", yFunc);

    dataCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 8)
        .attr("fill", color)
        .attr("fill-opacity", 0.0)
        .attr("cx", function(d) { return segmentDataObject.x(d.date); })
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

function segmAddGraphTooltip() {
    return d3.select("body").append("div")
        .attr("class", "graph-tooltip")
        .style("opacity", 1e-6);
}

function segmAddAxises(svg, y) {
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + segmentDataObject.graphHeight + ")")
        .call(segmentDataObject.newXAxis());

    svg.append("g")
        .attr("class", "y axis")
        .call(y);
}

function segmAddGrid(svg, yAxis) {
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + segmentDataObject.graphHeight + ")")
        .style("stroke-dasharray", ("1, 3"))
        .call(segmentDataObject.newXAxis()
            .tickSize(-segmentDataObject.graphHeight, 0, 0)
            .tickFormat(""));

    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", ("1, 2"))
        .call(yAxis
            .tickSize(-segmentDataObject.graphWidth, 0, 0)
            .tickFormat(""));
}

function requestSegmentData(){
    $.ajax({
        type: 'POST',
        url: segmentDataObject.segmentDataUrl,
        data: JSON.stringify(segmentData),
        success: function(data)
            {
                segmentDataObject.data = data;
                segmentDataObject.dateFrom = new Date(segmentData.dateFromMs);
                segmentDataObject.dateTo = new Date(segmentData.dateToMs);

                processSegmentData(segmentDataObject.data);
                if(data.code != undefined && data.code == -1) {
                    $("#noDataBlock").show();
                    segmentUpdateWidgets(true);
                } else {
                    $("#noDataBlock").hide();
                    segmentUpdateWidgets();
                }
                updateSegmentGraphs();
            },
        contentType: "application/json",
        dataType: 'json'
    });
}

$(function(){
    segmentDataObject.segmentDataUrl = $("#widget-query-filter").data("data-url");
    segmentDataObject.chartDauName = "segmentchart_dau";
    segmentDataObject.chartDauElem = $("#" + segmentDataObject.chartDauName);
    segmentDataObject.chartRevenueName = "segmentchart_revenue";
    segmentDataObject.chartRevenueElem = $("#" + segmentDataObject.chartRevenueName);
    segmentDataObject.chartSessionsName = "segmentchart_sessions";
    segmentDataObject.chartSessionsElem = $("#" + segmentDataObject.chartSessionsName);
    segmentDataObject.chartSessionLengthName = "segmentchart_sessionlength";
    segmentDataObject.chartSessionLengthElem = $("#" + segmentDataObject.chartSessionLengthName);

    segmentDataObject.graphWidth = segmentDataObject.chartDauElem.width() - graphMargins.left - graphMargins.right;
    segmentDataObject.graphHeight = segmentDataObject.chartDauElem.height() - graphMargins.top - graphMargins.bottom;

    getSegmentUsedValues();
    initSegmentsPanel();
    initTimeRangePanel();

    //requestSegmentData(); //This will be shoot from timerange and filter controls
});
