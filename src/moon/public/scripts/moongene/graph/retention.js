
var graphMargins = {
    left: 42,
    right: 10,
    top: 5,
    bottom: 50
};

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

function formatRetentionValue(val, useType) {
    if(useType == undefined) useType = "table-num";

    var valFormat = d3.format(",");
    var dateFormat = d3.time.format("%b %e");
    var percentFormat = d3.format("%");

    switch(useType) {
        case "table-num": return valFormat(val);
        case "table-percent": return percentFormat(val);
        case "table-date": return dateFormat(val);
    }

    return val;
}

function retTimeFormatDetailed(d) {
    var formatFull = d3.time.format("%b %-d");
    return formatFull(d);
}

function retTimeFormat(d) {
    var formatFull = d3.time.format("%b %-d");
    var formatShort = d3.time.format("%-d");

    var date = new Date(d);
    if(date.getDate() == 1 || date.getDate() == 10 || date.getDate() == 20)
        return formatFull(d);
    else
        return formatShort(d);
}

function requestSegmentData() {
    requestRetentionData();
}

function requestRetentionData(){
    $.ajax({
        type: 'POST',
        url: segmentDataObject.retentionDataUrl,
        data: JSON.stringify(segmentData),
        success: function(data)
            {
                segmentDataObject.data = data;
                segmentDataObject.dateFrom = new Date(segmentData.dateFromLocalMs);
                segmentDataObject.dateTo = new Date(segmentData.dateToLocalMs);

                if(data.code != undefined && data.code == -1) {
                    $("#noDataBlock").show();
                } else {
                    $("#noDataBlock").hide();
                }

                processRetentionData(segmentDataObject.data);
                updateRetentionGraphs();
                fillRetentionTable();
            },
        contentType: "application/json",
        dataType: 'json'
    });
}

function updateRetentionGraphs() {
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
                .tickFormat(daysInRange < 14 ? retTimeFormatDetailed : retTimeFormat)
                .ticks(daysInRange);};

    segmentDataObject.createSvg = function(chartName, chartElem) {
        d3.select("#" + chartName).select("svg").remove();

        return d3.select("#" + chartName).append("svg")
              .attr("width", chartElem.width())
              .attr("height", chartElem.height())
            .append("g")
              .attr("transform", "translate(" + graphMargins.left + "," + graphMargins.top + ")");
    };

    segmentDataObject.createSvgClip = function(svg, clipName) {
        return svg.append("defs").append("clipPath")
            .attr("id", clipName)
            .append("rect")
                .attr("y", -30) //Give some space for dots
                .attr("width", segmentDataObject.graphWidth)
                .attr("height", segmentDataObject.graphHeight + 30);
    };

    segmentDataObject.newYAxis = function(y) {
            return d3.svg.axis()
                   .scale(y)
                   .orient("left")
                   .tickFormat(d3.format(".0%"));
    };

    segmentDataObject.retentionColor = d3.scale.category10();

    retentionDrawChart(segmentDataObject.data.flat);
}

function retentionDrawChart(json) {
    segmentDataObject.retY = d3.scale.linear()
      .domain([0, 1]) //percentage
      .range([segmentDataObject.graphHeight, 0]);


    segmentDataObject.retSvg = segmentDataObject.createSvg(segmentDataObject.chartRetName, segmentDataObject.chartRetElem);
    segmentDataObject.retSvgClip = segmentDataObject.createSvgClip(segmentDataObject.retSvg, "ret-clip");
    segmentDataObject.retLine = d3.svg.line()
        .x(function(d) { return segmentDataObject.x(d.date); })
        .y(function(d) {
            switch(segmentDataObject.curRetLineDay) {
                case "d0": return segmentDataObject.retY(d.d0_percent);
                case "d1": return segmentDataObject.retY(d.d1_percent);
                case "d3": return segmentDataObject.retY(d.d3_percent);
                case "d6": return segmentDataObject.retY(d.d6_percent);
                case "d13": return segmentDataObject.retY(d.d13_percent);
                case "d27": return segmentDataObject.retY(d.d27_percent);
            }
            return 0;
        })
        .interpolate("linear");

    segmentDataObject.retColor = segmentDataObject.retentionColor;


    retAddGrid(segmentDataObject.retSvg, segmentDataObject.newYAxis(segmentDataObject.retY));
    segmentDataObject.retTooltip = retAddGraphTooltip();
    retAddAxises(segmentDataObject.retSvg, segmentDataObject.newYAxis(segmentDataObject.retY));
    retAddLegend(segmentDataObject.retSvg, segmentDataObject.retColor);

    //TODO Redo with a cycle
    /*
    segmentDataObject.curRetLineDay = "d0";
    retDrawDay(json, "v-path", segmentDataObject.retColor(0), segmentDataObject.retSvg, "url(#ret-clip)",
        segmentDataObject.retLine, function(d) { return segmentDataObject.retY(d.d0_percent); },
        segmentDataObject.retTooltip, function(d) { return d.d0_percent; } );
    */
    segmentDataObject.curRetLineDay = "d1";
    retDrawDay(json, "v-path", segmentDataObject.retColor(0), segmentDataObject.retSvg, "url(#ret-clip)",
        segmentDataObject.retLine, function(d) { return segmentDataObject.retY(d.d1_percent); },
        segmentDataObject.retTooltip, function(d) { return d.d1_percent; } );

    segmentDataObject.curRetLineDay = "d3";
    retDrawDay(json, "v-path", segmentDataObject.retColor(1), segmentDataObject.retSvg, "url(#ret-clip)",
        segmentDataObject.retLine, function(d) { return segmentDataObject.retY(d.d3_percent); },
        segmentDataObject.retTooltip, function(d) { return d.d3_percent; } );

    segmentDataObject.curRetLineDay = "d6";
    retDrawDay(json, "v-path", segmentDataObject.retColor(2), segmentDataObject.retSvg, "url(#ret-clip)",
        segmentDataObject.retLine, function(d) { return segmentDataObject.retY(d.d6_percent); },
        segmentDataObject.retTooltip, function(d) { return d.d6_percent; } );

    segmentDataObject.curRetLineDay = "d13";
    retDrawDay(json, "v-path", segmentDataObject.retColor(3), segmentDataObject.retSvg, "url(#ret-clip)",
        segmentDataObject.retLine, function(d) { return segmentDataObject.retY(d.d13_percent); },
        segmentDataObject.retTooltip, function(d) { return d.d13_percent; } );

    segmentDataObject.curRetLineDay = "d27";
    retDrawDay(json, "v-path", segmentDataObject.retColor(4), segmentDataObject.retSvg, "url(#ret-clip)",
        segmentDataObject.retLine, function(d) { return segmentDataObject.retY(d.d27_percent); },
        segmentDataObject.retTooltip, function(d) { return d.d27_percent; } );

}

function retDrawDay(json, pathStyle, color, svg, clipname, line, yFunc, tooltip, tooltipValue, tooltipFormat) {
    var m_names = new Array("Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec");
    var numberFormat = tooltipFormat == undefined ? d3.format(".0%") : tooltipFormat;

    var retentionLine = svg.append("path")
        .attr("clip-path", clipname)
        .datum(json)
        .attr("class", pathStyle)
        .attr("d", line)
        .attr("stroke", color);

    var retentionCircles = svg.selectAll(".circle")
        .data(json)
        .enter()
        .append("g");

    retentionCircles.append("circle")
        .attr("clip-path", clipname)
        .attr("r", 4)
        .attr("fill", color)
        .attr("fill-opacity", 1.0)
        .attr("cx", function(d) { return segmentDataObject.x(d.date); })
        .attr("cy", yFunc);

    retentionCircles.append("circle")
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

function retAddGrid(svg, yAxis) {
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

function retAddGraphTooltip() {
    return d3.select("body").append("div")
        .attr("class", "graph-tooltip")
        .style("opacity", 1e-6);
}

function retAddAxises(svg, y) {
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + segmentDataObject.graphHeight + ")")
        .call(segmentDataObject.newXAxis());

    svg.append("g")
        .attr("class", "y axis")
        .call(y);
}

function retAddLegend(svg, color) {
    var legendEntries = ["Day 2", "Day 4", "Day 7", "Day 14", "Day 28"];

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
      .data(legendEntries)
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
          .text(d);
      });

    return legend;
}

function processRetentionData(json) {
    var converted = {};
    var parseDate = d3.time.format("%Y-%m-%d").parse;

    var flatArray = [];
    for (var k in json)
    if (json.hasOwnProperty(k)) {
        var prop = json[k];
        if(prop) {
            //Example: 2013-10-4-d0
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

    //Calculate values
    var averages = [0, 0, 0, 0, 0, 0];
    for(var i = 0; i < json.flat.length; ++i) {
        var d0Val = json.flat[i].d0 == undefined ? 0 : json.flat[i].d0;
        var d1Val = json.flat[i].d1 == undefined ? 0 : json.flat[i].d1;
        var d3Val = json.flat[i].d3 == undefined ? 0 : json.flat[i].d3;
        var d6Val = json.flat[i].d6 == undefined ? 0 : json.flat[i].d6;
        var d13Val = json.flat[i].d13 == undefined ? 0 : json.flat[i].d13;
        var d27Val = json.flat[i].d27 == undefined ? 0 : json.flat[i].d27;

        averages[0] += d0Val;
        averages[1] += d1Val;
        averages[2] += d3Val;
        averages[3] += d6Val;
        averages[4] += d13Val;
        averages[5] += d27Val;

        json.flat[i].d0_percent = 1.0;
        json.flat[i].d1_percent = d0Val == 0 ? 0 : d1Val / d0Val;
        json.flat[i].d3_percent = d0Val == 0 ? 0 : d3Val / d0Val;
        json.flat[i].d6_percent = d0Val == 0 ? 0 : d6Val / d0Val;
        json.flat[i].d13_percent = d0Val == 0 ? 0 : d13Val / d0Val;
        json.flat[i].d27_percent = d0Val == 0 ? 0 : d27Val / d0Val;
        json.flat[i].d0 = d0Val;
        json.flat[i].d1 = d1Val;
        json.flat[i].d3 = d3Val;
        json.flat[i].d6 = d6Val;
        json.flat[i].d13 = d13Val;
        json.flat[i].d27 = d27Val;
    }
    segmentDataObject.percentD0  = 1.0;
    segmentDataObject.totalD0 = averages[0];
    segmentDataObject.percentD1  = averages[1] / averages[0];
    segmentDataObject.totalD1 = averages[1];
    segmentDataObject.percentD3  = averages[2] / averages[0];
    segmentDataObject.totalD3 = averages[2];
    segmentDataObject.percentD6  = averages[3] / averages[0];
    segmentDataObject.totalD6 = averages[3];
    segmentDataObject.percentD13 = averages[4] / averages[0];
    segmentDataObject.totalD13 = averages[4];
    segmentDataObject.percentD27 = averages[5] / averages[0];
    segmentDataObject.totalD27 = averages[5];
}

function tableCellStyleColor(percent) {
    if(percent > 0.2) return "color: #FCFCFC";
    return "";
}

function fillRetentionTable() {
    var table = $("#retentionTable");
    $("#retentionTableMain").dataTable().fnDestroy();
    table.empty();

    for(var i = 0; i < segmentDataObject.data.flat.length + 1; ++i) {
        var val = {}

        var retentionElement = '<tr class="' + (i % 2 ? 'event' : 'odd') + '">';
        if(i == segmentDataObject.data.flat.length) {
            val.d0_percent = segmentDataObject.percentD0;
            val.d0 = segmentDataObject.totalD0;
            val.d1_percent = segmentDataObject.percentD1;
            val.d1 = segmentDataObject.totalD1;
            val.d3_percent = segmentDataObject.percentD3;
            val.d3 = segmentDataObject.totalD3;
            val.d6_percent = segmentDataObject.percentD6;
            val.d6 = segmentDataObject.totalD6;
            val.d13_percent = segmentDataObject.percentD13;
            val.d13 = segmentDataObject.totalD13;
            val.d27_percent = segmentDataObject.percentD27;
            val.d27 = segmentDataObject.totalD27;

            retentionElement += '<td>Total Average</td>';
        } else {
            val = segmentDataObject.data.flat[i];
            retentionElement += '<td>' + formatRetentionValue(val.date, "table-date") + '</td>';
        }

            retentionElement += '<td>' +
                formatRetentionValue(val.d0_percent, "table-percent") + '<br>' +
                formatRetentionValue(val.d0, "table-num") + '</td>';
            retentionElement += '<td style="background-color:' +
                segmentDataObject.tableColor(val.d1_percent * 100) + '; border-left: 0px; border-top: 0px; ' + tableCellStyleColor(val.d1_percent) + '">' +
                formatRetentionValue(val.d1_percent, "table-percent") + '<br>' +
                formatRetentionValue(val.d1, "table-num") + '</td>';
            retentionElement += '<td style="background-color:' +
                segmentDataObject.tableColor(val.d3_percent * 100) + '; border-left: 0px; border-top: 0px; ' + tableCellStyleColor(val.d3_percent) + '">' +
                formatRetentionValue(val.d3_percent, "table-percent") + '<br>' +
                formatRetentionValue(val.d3, "table-num") + '</td>';
            retentionElement += '<td style="background-color:' +
                segmentDataObject.tableColor(val.d6_percent * 100) + '; border-left: 0px; border-top: 0px; ' + tableCellStyleColor(val.d6_percent) + '">' +
                formatRetentionValue(val.d6_percent, "table-percent") + '<br>' +
                formatRetentionValue(val.d6, "table-num") + '</td>';
            retentionElement += '<td style="background-color:' +
                segmentDataObject.tableColor(val.d13_percent * 100) + '; border-left: 0px; border-top: 0px; ' + tableCellStyleColor(val.d13_percent) + '">' +
                formatRetentionValue(val.d13_percent, "table-percent") + '<br>' +
                formatRetentionValue(val.d13, "table-num") + '</td>';
            retentionElement += '<td style="background-color:' +
                segmentDataObject.tableColor(val.d27_percent * 100) + '; border-left: 0px; border-top: 0px;' + tableCellStyleColor(val.d27_percent) + '">' +
                formatRetentionValue(val.d27_percent, "table-percent") + '<br>' +
                formatRetentionValue(val.d27, "table-num") + '</td>';
        retentionElement += '</tr>';

        table.append(retentionElement);
    }

    var dataTable = $('#retentionTableMain').dataTable({
    	"sPaginationType": "bootstrap",
        "iDisplayLength": 25,
        "sDom": "<'row-fluid'<'span5'T>r>t<'row-fluid'>",
    	"oLanguage": {
    		"sLengthMenu": "_MENU_ per page"
    	},
        "bSort": false,
    	"oTableTools": {
    		"sSwfPath": commonPath + "scripts/plugins/tables/DataTables/extras/TableTools/media/swf/copy_csv_xls_pdf.swf"
    	}
    });
}

$(function(){
    segmentDataObject.segmentDataUrl = $("#widget-query-filter").data("data-url");
    segmentDataObject.retentionDataUrl = $("#widget-query-filter").data("data-retention-url");

    segmentDataObject.chartRetName = "retentionchart_ret";
    segmentDataObject.chartRetElem = $("#" + segmentDataObject.chartRetName);

    segmentDataObject.graphWidth = segmentDataObject.chartRetElem.width() - graphMargins.left - graphMargins.right;
    segmentDataObject.graphHeight = segmentDataObject.chartRetElem.height() - graphMargins.top - graphMargins.bottom;

    segmentDataObject.tableColorsTreshholds = [];
    segmentDataObject.tableColors = [];
    var rDiff = 255 - 52;
    var gDiff = 255 - 109;
    var bDiff = 255 - 157;
    var grades = 10;
    var treshDiff = 100 / grades;
    for(var c = grades; c >= 0; c--) {
        segmentDataObject.tableColors.push("rgb(" +
            (52 + rDiff / (grades + 1) * c).toFixed(0) + "," +
            (109 + gDiff / (grades + 1) * c).toFixed(0) + "," +
            (157 + bDiff / (grades + 1) * c).toFixed(0) + ")");

        segmentDataObject.tableColorsTreshholds.push((101 - treshDiff * c).toFixed(0));
    }
    segmentDataObject.tableColor = d3.scale.threshold()
        .domain(segmentDataObject.tableColorsTreshholds)
        .range(segmentDataObject.tableColors);

    getSegmentUsedValues();
    initSegmentsPanel();
    initTimeRangePanel();

    //requestRetentionData(); We do this from panels
});
