//TODO Add chart
//http://jsfiddle.net/NYEaX/5/

var graphMargins = {
    left: 42,
    right: 10,
    top: 5,
    bottom: 50
};

function convertDateToUTC(date) { return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours(), date.getUTCMinutes(), date.getUTCSeconds()); }

function adminHealthTimeFormat(d) {
    var monthFormat = d3.time.format("%b %-d");
    var dayFormat = d3.time.format("%a %-d");
    var hourFormat = d3.time.format("%H:%M");

    var date = new Date(d);
    if(date.getHours() == 0) {
        if(date.getDate() == 1 || date.getDate() == 10 || date.getDate() == 20)
            return monthFormat(d);
        else
            return dayFormat(d);
    } else
        return hourFormat(d);
}

function resUsageTimeFormat(d) {
    var formatFull = d3.time.format("%b %-d");
    var formatShort = d3.time.format("%-d");

    var date = new Date(d);
    if(date.getDate() == 1 || date.getDate() == 10 || date.getDate() == 20)
        return formatFull(d);
    else
        return formatShort(d);
}

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

function resUsagePrepareDay(json) {
    var parseDate = d3.time.format("%Y_%m_%d_%H_%M").parse;

    json.data.flat = flattenJson(json.data, 4);

    var flatArray = [];
    for(var dd in json.data.flat)
    if (json.data.flat.hasOwnProperty(dd) ){
        json.data.flat[dd].date = parseDate(dd);
        //Also update total disk read and writes for all systems attached
        json.data.flat[dd].diskReadTotal = 0;
        json.data.flat[dd].diskWriteTotal = 0;
        for(var l = 0; l < json.data.flat[dd].f.length; ++l) {
            json.data.flat[dd].diskReadTotal += json.data.flat[dd].f[l].r;
            json.data.flat[dd].diskWriteTotal += json.data.flat[dd].f[l].w;
        }

        flatArray.push(json.data.flat[dd]);
    }
    json.data.flat = flatArray; //Convert from objects list to array
}

function resUsagePrepareData(json) {

    var docsArray = [];
    for (var m in json)
    if (json.hasOwnProperty(m) ){
        resUsagePrepareDay(json[m]);
        docsArray.push(json[m]);
    }

    json.machines = docsArray;
    for(var j = 0; j < json.machines.length; ++j) {
        var machinePurpose = json.machines[j].p;
        var machineHostIP = json.machines[j].n.hostIP;
        var machineHostName = json.machines[j].n.hostName;

        //Now loop through all other machines and joing their timing into this machine timing
        for(var jj = j + 1; jj < json.machines.length; ++jj) {
            if(json.machines[jj].n.hostName != "READYFORDELETE" &&
               json.machines[jj].p == machinePurpose &&
               json.machines[jj].n.hostIP == machineHostIP &&
               json.machines[jj].n.hostName == machineHostName) {

                //This is the same machine, probably another day stats. We need to add this to the main array
                json.machines[j].data.flat = json.machines[j].data.flat.concat(json.machines[jj].data.flat);

                //Now erase this machine ID so that we know this machine has been processed already
                json.machines[jj].n.hostName = "READYFORDELETE";
            }
        }
    }

    for(var d = json.machines.length - 1; d >= 0; --d)
    if(json.machines[d].n.hostName == "READYFORDELETE")
        json.machines.splice(d, 1);

    for(var st = json.machines.length - 1; st >= 0; --st)
        json.machines[st].data.flat.sort(function(a,b){
                a = new Date(a.date);
                b = new Date(b.date);
                return a < b ? -1 : a > b ? 1 : 0;
            });
}

var adminGraphObjects = {};

function adminDrawGraphs(dataUrl, dateFrom, dateTo) {
    adminGraphObjects.chartNodesLoadName = "adminchart_health_nodesload";
    adminGraphObjects.chartNodesLoadElem = $("#" + adminGraphObjects.chartNodesLoadName);
    adminGraphObjects.chartNodesDBLoadName = "adminchart_health_nodesdbload";
    adminGraphObjects.chartNodesDBLoadElem = $("#" + adminGraphObjects.chartNodesDBLoadName);
    adminGraphObjects.chartNodesDBErrorsName = "adminchart_health_nodesdberrors";
    adminGraphObjects.chartNodesDBErrorsElem = $("#" + adminGraphObjects.chartNodesDBErrorsName);
    adminGraphObjects.chartCpuName = "adminchart_health_cpu";
    adminGraphObjects.chartCpuElem = $("#" + adminGraphObjects.chartCpuName);
    adminGraphObjects.chartMemName = "adminchart_health_mem";
    adminGraphObjects.chartMemElem = $("#" + adminGraphObjects.chartMemName);
    adminGraphObjects.chartNetInName = "adminchart_health_netin";
    adminGraphObjects.chartNetInElem = $("#" + adminGraphObjects.chartNetInName);
    adminGraphObjects.chartNetOutName = "adminchart_health_netout";
    adminGraphObjects.chartNetOutElem = $("#" + adminGraphObjects.chartNetOutName);
    adminGraphObjects.chartDiskReadName = "adminchart_health_diskread";
    adminGraphObjects.chartDiskReadElem = $("#" + adminGraphObjects.chartDiskReadName);
    adminGraphObjects.chartDiskWriteName = "adminchart_health_diskwrite";
    adminGraphObjects.chartDiskWriteElem = $("#" + adminGraphObjects.chartDiskWriteName);

    adminGraphObjects.graphWidth = adminGraphObjects.chartCpuElem.width() - graphMargins.left - graphMargins.right;
    adminGraphObjects.graphHeight = adminGraphObjects.chartCpuElem.height() - graphMargins.top - graphMargins.bottom;

    d3.json(dataUrl, function(error, json) {
        if(json == undefined) return;

        //Convert data to a format that D3JS can digest
        resUsagePrepareData(json);

        adminGraphObjects.x = d3.time.scale()
            .domain([dateFrom, dateTo])
            //.domain(d3.extent(json.va.flat, function(d) { return d.date; }))
            .range([0, adminGraphObjects.graphWidth]);

        adminGraphObjects.newXAxis = function() {
            return d3.svg.axis()
                    .scale(adminGraphObjects.x)
                    .tickFormat(adminHealthTimeFormat)
                    .ticks(12);
        };

        adminGraphObjects.createSvg = function(name, elem) {
            return d3.select("#" + name).append("svg")
                .attr("width", elem.width())
                .attr("height", elem.height())
                .append("g")
                .attr("transform", "translate(" + graphMargins.left + "," + graphMargins.top + ")")
                /* //Debug way to see the area
                 .append("rect").attr("width", graphWidth).attr("height", graphHeight)
                 .attr("fill", "white").attr("stroke-width", "1px").attr("stroke", "rgb(127, 0, 0)")*/;
        };

        adminGraphObjects.createSvgClip = function(svg, name) {
            return svg.append("defs").append("clipPath")
                .attr("id", name)
                .append("rect")
                .attr("y", -20) //Give some space for dots
                .attr("width", adminGraphObjects.graphWidth)
                .attr("height", adminGraphObjects.graphHeight + 20);
        };

        adminGraphObjects.newYAxis = function(y, format) {
            return d3.svg.axis()
                   .scale(y)
                   .orient("left")
                   .tickFormat(d3.format(format));
        };


        adminGraphObjects.color = json.machines.size > 10 ? d3.scale.category20() : d3.scale.category10();

        adminDrawNodesLoad(json.machines);
        adminDrawNodesDBLoad(json.machines);
        adminDrawNodesDBErrors(json.machines);
        adminDrawCPU(json.machines);
        adminDrawMem(json.machines);
        adminDrawNetIn(json.machines);
        adminDrawNetOut(json.machines);
        adminDrawDiskRead(json.machines);
        adminDrawDiskWrite(json.machines);

    })
}

function adminDrawDiskWrite(machines) {
    adminGraphObjects.diskWriteY = d3.scale.linear()
      .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return dd.diskWriteTotal; })} )])
      .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.diskWriteSvg = adminGraphObjects.createSvg(adminGraphObjects.chartDiskWriteName, adminGraphObjects.chartDiskWriteElem);
    adminGraphObjects.diskWriteSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.diskWriteSvg, "diskwrite-clip");
    adminGraphObjects.diskWriteColor = adminGraphObjects.color;
    adminGraphObjects.diskWriteLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.diskReadY(d.diskWriteTotal); })
        .interpolate("linear");

    adminAddGrid(adminGraphObjects.diskWriteSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.diskWriteY, "s"));
    adminAddAxises(adminGraphObjects.diskWriteSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.diskWriteY, "s"));
    adminAddLegend(adminGraphObjects.diskWriteSvg, machines, adminGraphObjects.diskWriteColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.diskWriteColor(i), adminGraphObjects.diskWriteSvg,
            "url(#diskwrite-clip)", adminGraphObjects.diskWriteLine);
    }
}

function adminDrawDiskRead(machines) {
    adminGraphObjects.diskReadY = d3.scale.linear()
      .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return dd.diskReadTotal; })} )])
      .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.diskReadSvg = adminGraphObjects.createSvg(adminGraphObjects.chartDiskReadName, adminGraphObjects.chartDiskReadElem);
    adminGraphObjects.diskReadSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.diskReadSvg, "diskread-clip");
    adminGraphObjects.diskReadColor = adminGraphObjects.color;
    adminGraphObjects.diskReadLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.diskReadY(d.diskReadTotal); })
        .interpolate("linear");

    adminAddGrid(adminGraphObjects.diskReadSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.diskReadY, "s"));
    adminAddAxises(adminGraphObjects.diskReadSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.diskReadY, "s"));
    adminAddLegend(adminGraphObjects.diskReadSvg, machines, adminGraphObjects.diskReadColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.diskReadColor(i), adminGraphObjects.diskReadSvg,
            "url(#diskread-clip)", adminGraphObjects.diskReadLine);
    }
}

function adminDrawNetOut(machines) {
    adminGraphObjects.netOutY = d3.scale.linear()
      .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return dd.n.o; }); })])
      .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.netOutSvg = adminGraphObjects.createSvg(adminGraphObjects.chartNetOutName, adminGraphObjects.chartNetOutElem);
    adminGraphObjects.netOutSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.netOutSvg, "netout-clip");
    adminGraphObjects.netOutColor = adminGraphObjects.color;
    adminGraphObjects.netOutLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.netOutY(d.n.o); })
        .interpolate("linear");

    adminAddGrid(adminGraphObjects.netOutSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.netOutY, "s"));
    adminAddAxises(adminGraphObjects.netOutSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.netOutY, "s"));
    adminAddLegend(adminGraphObjects.netOutSvg, machines, adminGraphObjects.netOutColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.netOutColor(i), adminGraphObjects.netOutSvg,
            "url(#netout-clip)", adminGraphObjects.netOutLine);
    }
}

function adminDrawNetIn(machines) {
    adminGraphObjects.netInY = d3.scale.linear()
      .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return dd.n.i; }); })])
      .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.netInSvg = adminGraphObjects.createSvg(adminGraphObjects.chartNetInName, adminGraphObjects.chartNetInElem);
    adminGraphObjects.netInSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.netInSvg, "netin-clip");
    adminGraphObjects.netInColor = adminGraphObjects.color;
    adminGraphObjects.netInLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.netInY(d.n.i); })
        .interpolate("linear");

    adminAddGrid(adminGraphObjects.netInSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.netInY, "s"));
    adminAddAxises(adminGraphObjects.netInSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.netInY, "s"));
    adminAddLegend(adminGraphObjects.netInSvg, machines, adminGraphObjects.netInColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.netInColor(i), adminGraphObjects.netInSvg,
            "url(#netin-clip)", adminGraphObjects.netInLine);
    }
}

function adminDrawNodesLoad(machines) {
    adminGraphObjects.loadY = d3.scale.linear()
        .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return d3.max([dd.li, dd.lo, dd.lc]); }); })])
        .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.loadSvg = adminGraphObjects.createSvg(adminGraphObjects.chartNodesLoadName, adminGraphObjects.chartNodesLoadElem);
    adminGraphObjects.loadSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.loadSvg, "load-clip");
    adminGraphObjects.loadColor = adminGraphObjects.color;
    adminGraphObjects.loadLineIn = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.loadY(d.li); })
        .interpolate("linear");

    adminGraphObjects.loadLineOut = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.loadY(d.lo); })
        .interpolate("linear");

    adminGraphObjects.loadLineCur = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.loadY(d.lc); })
        .interpolate("linear");

    //Let's draw grid lines
    adminAddGrid(adminGraphObjects.loadSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.loadY, "s"));
    adminAddAxises(adminGraphObjects.loadSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.loadY, "s"));
    adminAddLegend(adminGraphObjects.loadSvg, machines, adminGraphObjects.loadColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.loadColor(i), adminGraphObjects.loadSvg,
            "url(#load-clip)", adminGraphObjects.loadLineIn);
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.loadColor(i), adminGraphObjects.loadSvg,
            "url(#load-clip)", adminGraphObjects.loadLineOut);
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.loadColor(i), adminGraphObjects.loadSvg,
            "url(#load-clip)", adminGraphObjects.loadLineCur);
    }
}

function adminDrawNodesDBLoad(machines) {
    adminGraphObjects.dbLoadY = d3.scale.linear()
        .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return d3.max([dd.ldbo, dd.ldbc]); }); })])
        .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.dbLoadSvg = adminGraphObjects.createSvg(adminGraphObjects.chartNodesDBLoadName, adminGraphObjects.chartNodesDBLoadElem);
    adminGraphObjects.dbLoadSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.dbLoadSvg, "dbload-clip");
    adminGraphObjects.dbLoadColor = adminGraphObjects.color;
    adminGraphObjects.dbLoadLineOut = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.dbLoadY(d.ldbo); })
        .interpolate("linear");

    adminGraphObjects.dbLoadLineCur = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.dbLoadY(d.ldbc); })
        .interpolate("linear");

    //Let's draw grid lines
    adminAddGrid(adminGraphObjects.dbLoadSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.dbLoadY, "s"));
    adminAddAxises(adminGraphObjects.dbLoadSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.dbLoadY, "s"));
    adminAddLegend(adminGraphObjects.dbLoadSvg, machines, adminGraphObjects.dbLoadColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.dbLoadColor(i), adminGraphObjects.dbLoadSvg,
            "url(#dbload-clip)", adminGraphObjects.dbLoadLineOut);
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.dbLoadColor(i), adminGraphObjects.dbLoadSvg,
            "url(#dbload-clip)", adminGraphObjects.dbLoadLineCur);
    }
}

function adminDrawNodesDBErrors(machines) {
    adminGraphObjects.dbErrY = d3.scale.linear()
        .domain([0, d3.max(machines, function(d) { return d3.max(d.data.flat, function(dd) { return dd.ldbe; }); })])
        .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.dbErrSvg = adminGraphObjects.createSvg(adminGraphObjects.chartNodesDBErrorsName, adminGraphObjects.chartNodesDBErrorsElem);
    adminGraphObjects.dbErrSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.dbErrSvg, "dberr-clip");
    adminGraphObjects.dbErrColor = adminGraphObjects.color;
    adminGraphObjects.dbErrLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.dbErrY(d.ldbe); })
        .interpolate("linear");

    //Let's draw grid lines
    adminAddGrid(adminGraphObjects.dbErrSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.dbErrY, "s"));
    adminAddAxises(adminGraphObjects.dbErrSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.dbErrY, "s"));
    adminAddLegend(adminGraphObjects.dbErrSvg, machines, adminGraphObjects.dbErrColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.dbErrColor(i), adminGraphObjects.dbErrSvg,
            "url(#dberr-clip)", adminGraphObjects.dbErrLine);
    }
}

function adminDrawMem(machines) {
    adminGraphObjects.memY = d3.scale.linear()
      .domain([0, 1.0])
      .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.memSvg = adminGraphObjects.createSvg(adminGraphObjects.chartMemName, adminGraphObjects.chartMemElem);
    adminGraphObjects.memSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.memSvg, "mem-clip");
    adminGraphObjects.memColor = adminGraphObjects.color;
    adminGraphObjects.memLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.memY(d.m.u / d.m.t); })
        .interpolate("linear");

    //Let's draw grid lines
    adminAddGrid(adminGraphObjects.memSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.memY, "%")); //or p for rounded percentage
    adminAddAxises(adminGraphObjects.memSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.memY, "%"));
    adminAddLegend(adminGraphObjects.memSvg, machines, adminGraphObjects.memColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.memColor(i), adminGraphObjects.memSvg,
            "url(#mem-clip)", adminGraphObjects.memLine);
    }
}

function adminDrawCPU(machines) {
    adminGraphObjects.cpuY = d3.scale.linear()
      .domain([0, 1.0])
      .range([adminGraphObjects.graphHeight, 0]);

    adminGraphObjects.cpuSvg = adminGraphObjects.createSvg(adminGraphObjects.chartCpuName, adminGraphObjects.chartCpuElem);
    adminGraphObjects.cpuSvgClip = adminGraphObjects.createSvgClip(adminGraphObjects.cpuSvg, "cpu-clip");
    adminGraphObjects.cpuColor = adminGraphObjects.color;
    adminGraphObjects.cpuLine = d3.svg.line()
        .x(function(d) { return adminGraphObjects.x(d.date); })
        .y(function(d) { return adminGraphObjects.cpuY(d.c.l); })
        .interpolate("linear");

    adminAddGrid(adminGraphObjects.cpuSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.cpuY, "%"));
    adminAddAxises(adminGraphObjects.cpuSvg, adminGraphObjects.newXAxis(), adminGraphObjects.newYAxis(adminGraphObjects.cpuY, "%"));
    adminAddLegend(adminGraphObjects.cpuSvg, machines, adminGraphObjects.cpuColor);

    for(var i = 0; i < machines.length; ++i) {
        adminDrawMachine(machines[i], "v-path", adminGraphObjects.cpuColor(i), adminGraphObjects.cpuSvg,
            "url(#cpu-clip)", adminGraphObjects.cpuLine);
    }
}

function adminAddAxises(svg, xAxis, yAxis) {
    svg.append("g")
        .attr("class", "x axis")
        .attr("transform", "translate(0," + adminGraphObjects.graphHeight + ")")
        .call(xAxis);

    svg.append("g")
        .attr("class", "y axis")
        .call(yAxis);
}

function adminAddGrid(svg, xAxis, yAxis) {
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", "translate(0," + adminGraphObjects.graphHeight + ")")
        .style("stroke-dasharray", ("1, 3"))
        .call(xAxis
            .tickSize(-adminGraphObjects.graphHeight, 0, 0)
            .tickFormat(""));

    svg.append("g")
        .attr("class", "grid")
        .style("stroke-dasharray", ("1, 2"))
        .call(yAxis
            .tickSize(-adminGraphObjects.graphWidth, 0, 0)
            .tickFormat(""));
}

function adminAddLegend(svg, machines, color) {
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
      .data(machines)
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
          .text(d.p + ": " + d.n.hostName + "(" + d.n.hostIP + ")");
      });

}

function adminDrawMachine(json, pathStyle, color, svg, clipName, line) {
    var machineLine = svg.append("path")
        .attr("clip-path", clipName)
        .datum(json.data.flat)
        .attr("class", pathStyle)
        .attr("d", line)
        .attr("stroke", color);
}

function initializeAdminHealthGraphs() {
    var todayDate = new Date();
    var twoWeeksAgoDate = new Date(); twoWeeksAgoDate.setDate(twoWeeksAgoDate.getDate() - 1);
    todayDate.setHours(23, 59, 59);
    twoWeeksAgoDate.setHours(0, 0, 0, 0);

    var dataUrl = "/data/admin/health/" + twoWeeksAgoDate.getTime() + "/" + convertDateToUTC(todayDate).getTime();

    adminDrawGraphs(dataUrl, twoWeeksAgoDate, todayDate);
}

initializeAdminHealthGraphs();
