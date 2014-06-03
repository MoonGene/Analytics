
var graphMargins = {
    left: 0,
    right: 0,
    top: 0,
    bottom: 0
};

var geoGraphObjects = {};
var geoGraphType = "mau";

function geoRemoveNonDayObjValues(obj, depth) {
    var result = {};
    depth = depth != undefined ? depth : -1;

    for (var k in obj)
        if (obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" && !(prop instanceof Date || prop instanceof RegExp) && depth != 0 && k != "geo") {
                //Uncomment if you want to have a path like 2013.9.cls values
                result/*[k] */= geoRemoveNonDayObjValues(prop, depth - 1);
            }
            else {
                if(prop && (typeof prop !== "object" || k == "geo")) {
                    result[k] = prop
                    delete obj[k]
                }
            }
        }

    return result
}

function getCountryValue(d) {
    switch(geoGraphType) {
        case "mau": return d.c;
        case "asl": return d.l / d.s;
        case "spu": return d.s / d.c;
        case "revenue": {
            if(d.a === undefined) return 0;
            return d.a;
        }
        case "arpu": {
            if(d.a === undefined) return 0;
            return d.a / d.c;
        }
        case "arppu": {
            if(d.pu == undefined) d.pu = 0;
            if(d.a == undefined) d.a = 0;
            return d.a == 0 ? 0 : d.a / d.pu;
        }
    }

    return 0;
}

function geoDurationFormat(d) {
    var hours = (d / 3600).toFixed(0);
    var minutes = ((d % 3600) / 60).toFixed(0);
    var seconds = ((d % 3600) % 60).toFixed(0);

    if(hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
    if(minutes > 0) return minutes + "m " + seconds + "s";
    return seconds + "s";
}

function geoCurrencyShortFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    var mauFormat = d3.format("s");
    if(d > 10000) return "$" + mauFormat(d);
    if(d > 100) return "$" + currencyFormat(d.toFixed(0));
    return "$" + d.toFixed(2);
}

function geoCurrencyFullFormat(d) {
    d = d / 100;
    var currencyFormat = d3.format(",");
    return "$" + currencyFormat(d.toFixed(2));
}


function formatCountryValue(val, useType) {
    if(useType == undefined) useType = geoGraphType;

    var pureFormat = d3.format(",");
    var mauFormat = d3.format("s");
    var spuHelper = d3.format("s");
    var spuFormat = function(d) { return d % 1 > 0 ? d.toFixed(2) : spuHelper(val); };

    switch(useType) {
        case "mau": return mauFormat(val);
        case "asl": return geoDurationFormat(val);
        case "spu": return spuFormat(val);
        case "pure": return pureFormat(val);
        case "duration": return geoDurationFormat(val);
        case "revenue": return geoCurrencyShortFormat(val);
        case "arpu":
        case "arppu": return geoCurrencyFullFormat(val);
    }

    return val;
}

function updateDataScale() {
    geoGraphObjects.dbDataScale = d3.scale.linear()
      .domain([0, d3.max(geoGraphObjects.dbData.geoArray, function(d) { return getCountryValue(d); })])
      .range([0, 99]);

    geoDrawMapLegend();
}

var aa = 0;

function fillCountriesTable() {
    var table = $("#countriesTable");
    $("#countriesTableMain").dataTable().fnDestroy();
    table.empty();

    for(var i = 0; i < geoGraphObjects.dbData.geoArray.length; ++i) {
        var val = geoGraphObjects.dbData.geoArray[i];
        if(val.pu == undefined) val.pu = 0;
        if(val.a == undefined) val.a = 0;
        val.arpu = val.a / val.c;
        val.arppu = val.a == 0 ? 0 : val.a / val.pu;

        var countryName = val.id;

        //TODO Optimize, make this prebaked
        for(var c = 0; c < geoGraphObjects.geoWorldJson.objects.geo_countries.geometries.length; ++c)
            if(geoGraphObjects.geoWorldJson.objects.geo_countries.geometries[c].id == val.id)
                countryName = geoGraphObjects.geoWorldJson.objects.geo_countries.geometries[c].properties.name;

        var countryElement = '<tr class="' + (i % 2 ? 'even' : 'odd') + '">';
            if(val.id != "unknown")
                countryElement += '<td>' + '<img src="' + commonPath + 'images/flags/24x24/' + val.id.toLowerCase() + '.png">&nbsp;' + countryName + '</td>';
            else
                countryElement += '<td>Unknown</td>';
            countryElement += '<td>' + formatCountryValue(val.c, "pure") + '</td>';
            countryElement += '<td>' + formatCountryValue(val.s, "pure") + '</td>';
            countryElement += '<td>' + val.l + ' (' + formatCountryValue(val.l, "duration") + ')</td>';
            countryElement += '<td>' + formatCountryValue((val.l / val.s), "spu") + ' (' + formatCountryValue((val.l / val.s), "asl") + ')</td>';
            countryElement += '<td>' + formatCountryValue((val.s / val.c), "spu") + '</td>';
            countryElement += '<td>' + formatCountryValue(val.a, "revenue") + '</td>';
            countryElement += '<td>' + formatCountryValue(val.arpu, "arpu") + ' / ' + formatCountryValue(val.arppu, "arppu") + '</td>';

        countryElement += '</tr>';

        table.append(countryElement);
    }

    if(geoGraphObjects.dbData.geoArray.length == 0) {
        $("#noDataBlock").show();
    } else {
        $("#noDataBlock").hide();
    }

    var dataTable = $('#countriesTableMain').dataTable({
        "sPaginationType": "bootstrap",
        "iDisplayLength": 25,
        "sDom": "<'row-fluid'<'span5'T><'span3'l><'span4'f>r>t<'row-fluid'<'span6'i><'span6'p>>",
        "oLanguage": {
            "sLengthMenu": "_MENU_ per page"
        },
        "aoColumns": [
            { "sWidth": "11%" },
            { "sWidth": "11%" },
            { "sWidth": "8%" },
            { "sWidth": "20%" },
            { "sWidth": "20%" },
            { "sWidth": "10%" },
            { "sWidth": "12%"},
            { "sWidth": "10%"}
        ],
        "oTableTools": {
            "sSwfPath": commonPath + "scripts/plugins/tables/DataTables/extras/TableTools/media/swf/copy_csv_xls_pdf.swf",
            "aButtons": [ "print" ]
        }
    });


    dataTable.fnSort( [ [1,'desc'] ]);


}

function zoomed() {
    geoGraphObjects.geoProjection.translate(d3.event.translate).scale(d3.event.scale);
    geoGraphObjects.mapZoom.selectAll("path").attr("d", geoGraphObjects.geoPath);
}

function drawGeo() {
    geoGraphObjects.mapName = "geochart";
    geoGraphObjects.mapElem = $("#" + geoGraphObjects.mapName);

    geoGraphObjects.graphWidth = geoGraphObjects.mapElem.width() - graphMargins.left - graphMargins.right;
    geoGraphObjects.graphHeight = geoGraphObjects.mapElem.height() - graphMargins.top - graphMargins.bottom;

    //Generate map gradient
    geoGraphObjects.mauColorsTreshholds = [];
    geoGraphObjects.mauColors = [];
    var rDiff = 255 - 52;
    var gDiff = 255 - 109;
    var bDiff = 255 - 157;
    var grades = 10;
    var treshDiff = 100 / grades;
    for(var c = grades; c >= 0; c--) {
        geoGraphObjects.mauColors.push("rgb(" +
            (52 + rDiff / (grades + 1) * c).toFixed(0) + "," +
            (109 + gDiff / (grades + 1) * c).toFixed(0) + "," +
            (157 + bDiff / (grades + 1) * c).toFixed(0) + ")");

        geoGraphObjects.mauColorsTreshholds.push((100 - treshDiff * c).toFixed(0));
    }
    geoGraphObjects.mauColor = d3.scale.threshold()
        .domain(geoGraphObjects.mauColorsTreshholds)
        .range(geoGraphObjects.mauColors);

    d3.json(commonPath + "scripts/moongene/graph/geo_world.json", function(error, json) {
        if(json == undefined) return;
        geoGraphObjects.geoWorldJson = json;


        geoGraphObjects.createSvg = function(chartName, chartElem) {
            return d3.select("#" + chartName).append("svg")
                  .attr("width", chartElem.width())
                  .attr("height", chartElem.height())
                .append("g")
                  .attr("transform", "translate(" + graphMargins.left + "," + graphMargins.top + ")")
                /* //Debug way to see the area
                .append("rect").attr("width", graphWidth).attr("height", graphHeight)
                .attr("fill", "white").attr("stroke-width", "1px").attr("stroke", "rgb(127, 0, 0)")*/;
        };

        geoGraphObjects.createSvgClip = function(svg, clipName, chartElem) {
            return svg.append("svg:clipPath")
                .attr("id", clipName)
                .append("svg:rect")
                .attr("id", "clip-rect")
                .attr("x", "0")
                .attr("y", "0")
                .attr("width", chartElem.width())
                .attr("height", chartElem.height());
        }

        geoGraphObjects.geoProjection = d3.geo.mercator()
            .scale((geoGraphObjects.graphWidth + 1) / 2.35 / Math.PI)
            .translate([geoGraphObjects.graphWidth / 2, geoGraphObjects.graphHeight / 1.7]);
        geoGraphObjects.geoPath = d3.geo.path()
            .projection(geoGraphObjects.geoProjection)
            .pointRadius(2);

        geoGraphObjects.geoZoom = d3.behavior.zoom()
            .translate(geoGraphObjects.geoProjection.translate())
            .scale(geoGraphObjects.geoProjection.scale())
            .scaleExtent([geoGraphObjects.graphWidth / 2.5 / Math.PI, 2 * geoGraphObjects.graphHeight])
            .on("zoom", zoomed);


        geoGraphObjects.mapSvg = geoGraphObjects.createSvg(geoGraphObjects.mapName, geoGraphObjects.mapElem);
        geoGraphObjects.mapSvgClip = geoGraphObjects.createSvgClip(geoGraphObjects.mapSvg, "mapClip", geoGraphObjects.mapElem);
        geoGraphObjects.mapZoom = geoGraphObjects.mapSvg.append("g")
                                    .attr("clip-path", "url(#mapClip)")
                                    .call(geoGraphObjects.geoZoom)
                                    .on("mousewheel.zoom", null)
                                    .on("DOMMouseScroll.zoom", null) // disables older versions of Firefox
                                    .on("wheel.zoom", null); // disables newer versions of Firefox

        geoGraphObjects.mapZoom.append("rect")
            .attr("class", "background")
            .attr("width", geoGraphObjects.graphWidth)
            .attr("height", geoGraphObjects.graphHeight)
            .attr("fill", "white");

        geoGraphObjects.mapTooltip = d3.select("body").append("div")
                                                      .attr("class", "graph-tooltip")
                                                      .style("opacity", 1e-6);

        geoDrawMap();

        //Make a call now to fetch data regarding MAU, Sessions, etc.
        geoUpdateData(new Date());
    });
}

function geoUpdateData(date) {
    var dateMS = convertDateToUTC(date).getTime();
    var dataUrl = "/data/geo/" + mobileAppId + "/" + dateMS;
    d3.json(dataUrl, function(error, json) {
        if(json == undefined) return;

        geoGraphObjects.dbData = geoRemoveNonDayObjValues(json.va, 2);

        //Convert to array so we can iterate through with index
        var geoArray = [];
        for(var g in geoGraphObjects.dbData.geo)
        if (geoGraphObjects.dbData.geo.hasOwnProperty(g) ) {
            geoGraphObjects.dbData.geo[g].id = g;
            geoArray.push(geoGraphObjects.dbData.geo[g]);
        }

        geoGraphObjects.dbData.geoArray = geoArray;

        fillCountriesTable();
        updateDataScale();

        /* //TODO Finish legend
        geoGraphObjects.mapLegend = geoGraphObjects.mapSvg.append("g")
            .attr("class", "key")
            .attr("transform", "translate(40," + (geoGraphObjects.graphHeight - 40) + ")");

        geoGraphObjects.mapLegendX = d3.scale.linear()
            .domain(geoGraphObjects.dbDataScale.domain())
            .range([0, 250]);

        geoGraphObjects.mapLegendXAxis = d3.svg.axis()
            .scale(geoGraphObjects.mapLegendX)
            .orient("bottom")
            .tickSize(13)
            .tickValues(geoGraphObjects.mauColor.domain());

        geoGraphObjects.mapLegend.selectAll("rect")
            .data(geoGraphObjects.mauColor.range().map(function(d, i) {
              return {
                x0: i ? geoGraphObjects.mapLegendX(geoGraphObjects.mauColor.domain()[i - 1]) : geoGraphObjects.mapLegendX.range()[0],
                x1: i < geoGraphObjects.mauColor.domain().length ? geoGraphObjects.mapLegendX(geoGraphObjects.mauColor.domain()[i]) : geoGraphObjects.mapLegendX.range()[1],
                z: d
              };
            }))
          .enter().append("rect")
            .attr("height", 8)
            .attr("x", function(d) { return d.x0; })
            .attr("width", function(d) { return d.x1 - d.x0; })
            .style("fill", function(d) { return d.z; });

        geoGraphObjects.mapLegend.call(geoGraphObjects.mapLegendXAxis).append("text")
            .attr("class", "caption")
            .attr("y", -6)
            .text("MAU per Country");
        */

        //This will redraw map
        geoDrawMap();
    })

}

function geoDrawMapLegend() {

}

function geoDrawMap() {
    var json = geoGraphObjects.geoWorldJson;

    var countriesJson = topojson.feature(json, json.objects.geo_countries).features;
    var countries = geoGraphObjects.mapZoom.selectAll(".country")
                    .data(countriesJson);

    countries.enter().append("path");

    countries.attr("d", geoGraphObjects.geoPath)
            .attr("class", "country")
            .attr("fill", function(d) {
                var countryID = d.id;
                var countryMau = 0;
                if(geoGraphObjects.dbData != undefined && geoGraphObjects.dbData.geo != undefined && geoGraphObjects.dbData.geo[countryID] != undefined)
                    countryMau = geoGraphObjects.dbDataScale(getCountryValue(geoGraphObjects.dbData.geo[countryID]));

                return countryMau == 0 ? "#fff" : geoGraphObjects.mauColor(countryMau);
            })
            .on("mouseover", function(d) {
                if(geoGraphObjects.dbData == undefined || geoGraphObjects.dbData.geo == undefined || geoGraphObjects.dbData.geo[d.id] == undefined) return;

                d3.select(this)
                    .transition()
                    .duration(50)
                    .style("stroke-width", 1.5);

                geoGraphObjects.mapTooltip.style("border-color", geoGraphObjects.mauColor(99));
                geoGraphObjects.mapTooltip.style("color", geoGraphObjects.mauColor(99));

                geoGraphObjects.mapTooltip.transition()
                    .duration(50)
                    .style("opacity", .9);

                geoGraphObjects.mapTooltip.html("" + d.properties.name + "<br><b>"  + formatCountryValue(getCountryValue(geoGraphObjects.dbData.geo[d.id])) + "</b>")
                    .style("left", (d3.event.pageX + 28) + "px")
                    .style("top", (d3.event.pageY - 28) + "px");
                })
                .on("mouseout", function(d) {
                    d3.select(this)
                        .transition()
                        .duration(25)
                        .style("stroke-width", 0.5);

                    geoGraphObjects.mapTooltip.transition()
                        .duration(25)
                        .style("opacity", 0);
                });

    /*
    geoGraphObjects.mauSvg.append("path")
          .datum(topojson.mesh(json, json.objects.geo_countries, function(a, b) { return a !== b; }))
          .attr("class", "boundary")
          .attr("d", path);
    */

    /*
    geoGraphObjects.mauSvg.append("path")
        .datum(topojson.feature(json, json.objects.geo_places))
        .attr("d", path)
        .attr("class", "place");
    */

    /*
    geoGraphObjects.mauSvg.selectAll(".subunit-label")
        .data(topojson.feature(json, json.objects.geo_countries).features)
      .enter().append("text")
        .attr("class", function(d) { return "country-label " + d.id; })
        .attr("transform", function(d) { return "translate(" + path.centroid(d) + ")"; })
        .attr("dy", ".35em")
        .text(function(d) { return d.properties.name; });
    */
}

function initGeoControls() {
    var curDate = new Date();
    //Allow to select years from 2013 and forward to the current year
    var yearRange = "-" + (curDate.getFullYear() - 2013) + "~0";

    $("#geoMonthPicker").monthpicker(
        {
            elements: [
                {tpl:"year",opt:{

                    range: yearRange
                }},
                {tpl: "month", opt:{
                    value: curDate.getMonth() + 1
                }}
            ],
            onChanged: function(data, $e)
            {
                var newDate = new Date();
                newDate.setYear(data.year);
                newDate.setMonth(data.month - 1);
                geoUpdateData(newDate);
            }
        });

    $( "#geoChartType" ).change(function() {
      var newVal = $( "#geoChartType").val();
      if(newVal != geoGraphType) {
          geoGraphType = newVal;
          updateDataScale();
          geoDrawMap();
      }
    });
}

$(function(){
    initGeoControls();
    drawGeo();
});