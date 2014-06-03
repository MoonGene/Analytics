
const transitionLinkWidthMin = 2;
const transitionLinkWidthMax = 10;
const stateNodeSizeMin = 20;
const stateNodeSizeMax = 60;
const groupSysId = 0;
const groupAppId = 1;
const groupUnknownId = 2;

var flowGraphData = {};
var flowGraphObject = {};

var timelineMargins = {
    left: 50,
    right: 50,
    top: 50,
    bottom: 50,

    lineHeight: 50,
    minBarWidth: 2,
    maxBarWidth: 100
};

function appFlowTooltipTimeFormat(d) {
    var hours = (d / 3600).toFixed(0);
    var minutes = ((d % 3600) / 60).toFixed(0);
    var seconds = ((d % 3600) % 60).toFixed(0);

    if(hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
    if(minutes > 0) return minutes + "m " + seconds + "s";
    return seconds + "s";
}

function formatTimelineTime(d) {
    var hours = (d / 3600).toFixed(0);
    var minutes = ((d % 3600) / 60).toFixed(0);
    var seconds = ((d % 3600) % 60).toFixed(0);

    var zero = d3.format("02d");
    return zero(hours) + ":" + zero(minutes) + ":" + zero(seconds);
}

function unwindStateId(id) {
    var stateType = id[0];
    var stateName = id.substr(2);
    return stateType == '0' ? 'sys:' + stateName : 'app:' + stateName;
}

function unwindFlowData(json) {
    var bakedVersions = [];
    bakedVersions.push({
        "data": unwindFlowDataVersion(json.vfa),
        "name": "All Versions"
    });


    for (var k in json.vf)
    if (json.vf.hasOwnProperty(k)) {
        var prop = json.vf[k];
        if(prop) {
            var kDecoded = atob(k);
            bakedVersions.push({
                "data": unwindFlowDataVersion(prop),
                "name": kDecoded
            })
        }
    }

    return bakedVersions;
}

function unwindFlowDataVersion(json) {
    //We need to convert from our format to something that is eatable by D3.js

    var bakedJson = {};
    var statesArray = [];
    bakedJson.timelines = json.timelines;

    for (var k in json.states)
    if (json.states.hasOwnProperty(k)) {
        var prop = json.states[k];
        if(prop) {
            //Example "0:Exit"
            var stateName = k.substr(2);
            var stateCode = unwindStateId(k);
            var hits = prop.h == undefined ? 0 : prop.h;
            var time = prop.t == undefined ? 0 : prop.t;
            statesArray.push(
                {
                    "name": stateName,
                    "code": stateCode,
                    "hits": hits,
                    "time": time
                });
        }
    }

    var transitionsArray = [];

    for (var k in json.transitions)
    if (json.transitions.hasOwnProperty(k)) {
        var prop = json.transitions[k];
        if(prop) {
            //Example "0:Start~~1:Main Menu"
            var fromTo = k.split("~~");
            var fromState = unwindStateId(fromTo[0]);
            var toState = unwindStateId(fromTo[1]);
            var hits = prop.h == undefined ? 0 : prop.h;

            transitionsArray.push(
                {
                    "from": fromState,
                    "to": toState,
                    "hits": hits,
                    "fromName": fromTo[0].substr(2),
                    "toName": fromTo[1].substr(2)
                });
        }
    }

    //Make sure that all states from transitions were in the states list, for
    //example start usually has zero hits, so we need to predefine it for the user
    for(var ti = 0; ti < transitionsArray.length; ++ti) {
        var fromFound = false, toFound = false;
        for(var si = 0; si < statesArray.length; ++si) {
            if(statesArray[si].code == transitionsArray[ti].from) {
                fromFound = true;
                if(fromFound && toFound) break;
            }
            if(statesArray[si].code == transitionsArray[ti].to) {
                toFound = true;
                if(fromFound && toFound) break;
            }
        }

        if(!fromFound) {
            statesArray.push(
                {
                    "name": transitionsArray[ti].fromName,
                    "code": transitionsArray[ti].from,
                    "hits": 1,
                    "time": 1
                });
        }
        if(!toFound) {
            statesArray.push(
                {
                    "name": transitionsArray[ti].toName,
                    "code": transitionsArray[ti].to,
                    "hits": 1,
                    "time": 1
                });
        }
    }

    statesArray.sort(function(a,b){
        a = a.code;
        b = b.code;
        return a < b ? -1 : a > b ? 1 : 0;
    });

    transitionsArray.sort(function(a,b){
            a = a.from + a.to;
            b = b.from + b.to;
            return a < b ? -1 : a > b ? 1 : 0;
        });

    bakedJson.states = statesArray;
    bakedJson.transitions = transitionsArray;
    return bakedJson;
}

function updateFlowData(graph, jsonData)
{
    graph.original = jsonData;
    var newStates = jsonData.states;
    var newTransitions = jsonData.transitions;
    //Add new transitions
    for(var s = 0; s < newStates.length; s++)
    {
        if(!(newStates[s].code in graph.statesIndices))
        {
            graph.statesIndices[newStates[s].code] = graph.data.states.length;
            if(newStates[s].code.indexOf("sys:") == 0) newStates[s].group = groupSysId; else
            if(newStates[s].code.indexOf("app:") == 0) newStates[s].group = groupAppId; else
                states[s].group = groupUnknownId;
            graph.data.states.push(newStates[s]);
        }
    }

    for(var l = 0; l < newTransitions.length; l++)
    {
        newTransitions[l].source = graph.statesIndices[newTransitions[l].from];
        newTransitions[l].target = graph.statesIndices[newTransitions[l].to];
        newTransitions[l].id = newTransitions[l].source + "-" + newTransitions[l].target;
        //Check whether this transition exists in the main array of transitions
        var found = false;
        for(var t = 0; t < graph.data.transitions.length; t++)
        if(graph.data.transitions[t].id == newTransitions[l].id)
        {
            found = true;
            break;
        }

        if(!found)
            graph.data.transitions.push(newTransitions[l]);
    }

    graph.nodes.scale = d3.scale.linear()
        .range([stateNodeSizeMin, stateNodeSizeMax])
        .domain([d3.min(graph.data.states, function(d){ return d.time; }),
            d3.max(graph.data.states, function(d){ return d.time; })]);

    graph.transitions.scale = d3.scale.linear()
        .range([transitionLinkWidthMin, transitionLinkWidthMax])
        .domain([d3.min(graph.data.transitions, function(d){ return d.hits; }),
            d3.max(graph.data.transitions, function(d){ return d.hits; })]);
}

function initFlowData(graph, jsonData)
{
    jsonData = unwindFlowData(jsonData)[0].data; //All versions only for now
    graph.original = jsonData;

    //We need to inject source and target indices, they are required by the
    //D3JS library to draw nodes and links. We also need to Inject group value
    //into the nodes, this will represent different colors and grouping by type
    var statesIndices = {};
    var states = jsonData.states;
    var transitions = jsonData.transitions;
    for(var s = 0; s < states.length; s++)
    {
        statesIndices[states[s].code] = s;
        if(states[s].code.indexOf("sys:") == 0) states[s].group = groupSysId; else
        if(states[s].code.indexOf("app:") == 0) states[s].group = groupAppId; else
            states[s].group = groupUnknownId;
    }

    for(var l = 0; l < transitions.length; l++)
    {
        transitions[l].source = statesIndices[transitions[l].from];
        transitions[l].target = statesIndices[transitions[l].to];
        transitions[l].id = transitions[l].source + "-" + transitions[l].target;
    }
    graph.statesIndices = statesIndices;
    graph.data = jsonData;
    graph.nodes = {};
    graph.nodes.scale = d3.scale.linear()
        .range([stateNodeSizeMin, stateNodeSizeMax])
        .domain([d3.min(jsonData.states, function(d){ return d.time; }),
                 d3.max(jsonData.states, function(d){ return d.time; })]);

    graph.transitions = {};
    graph.transitions.scale = d3.scale.linear()
        .range([transitionLinkWidthMin, transitionLinkWidthMax])
        .domain([d3.min(jsonData.transitions, function(d){ return d.hits; }),
                 d3.max(jsonData.transitions, function(d){ return d.hits; })]);

}

function updateFlowGraphData()
{
    flowGraphObject.links = flowGraphObject.flowSvg.selectAll("line")
        .data(flowGraphData.data.transitions)
        .style("stroke-width", function(d){ return flowGraphData.transitions.scale(d.hits); });

    flowGraphObject.links
        .enter().insert("line", ":first-child")
        .attr("class", "transition")
        .style("stroke-width", function(d) { return flowGraphData.transitions.scale(d.hits); });

    flowGraphObject.links
        .exit()
        .remove();

    flowGraphObject.nodes = flowGraphObject.flowSvg.selectAll("g")
        .data(flowGraphData.data.states);

    var enterNodes = flowGraphObject.nodes
        .enter()
        .append("g")
        .call(flowGraphObject.flowForce.drag);

    enterNodes
        .append("circle")
        .attr("class", function(d) { return d.group == groupSysId ? "state outer-sys" : "state outer-app" })
        .attr("r", function(d) { return flowGraphData.nodes.scale(d.time) + 5; });

    enterNodes.append("circle")
        .attr("class", function(d) { return d.group == groupSysId ? "state inner-sys" : "state inner-app" })
        .attr("r", function(d) { return flowGraphData.nodes.scale(d.time); })
        .attr("style", function(d) { return d.group == groupSysId ? "cursor: arrow;" : "cursor: pointer;" })
        .on("mouseover", function(d) {
            if(d.group == groupSysId) return;

            flowGraphObject.flowTooltip.transition()
                .duration(50)
                .style("opacity", .9);

            var col = d.group == groupSysId ? "rgb(48,196,198)" : "rgb(49,189,235)"
            flowGraphObject.flowTooltip.style("border-color", col);
            flowGraphObject.flowTooltip.style("color", col);

            var avgTime = d.hits == 0 ? 0 : d.time / d.hits;

            flowGraphObject.flowTooltip
                .html("<b>Average time: " + appFlowTooltipTimeFormat(avgTime) + "<br>Hits: "  + d.hits + "</b>")
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
            })
        .on("mouseout", function(d) {
            if(d.group == groupSysId) return;
            flowGraphObject.flowTooltip.transition()
                    .duration(25)
                    .style("opacity", 0);
            })
        .on("click", function(d) {
            if(d.group == groupSysId) return;
            var currentClass = $(this).attr("class");
            if(currentClass != "state inner-select") {
                $(this).attr("class", function(d) { return "state inner-select"; });
                //Update our list of timelines
                var stateId = d.group + ":" + d.name;
                var timelines = flowGraphData.original.timelines[stateId];
                //TODO Make a check in case there are no timelines for this state
                appflowUpdateTimelines(stateId, timelines);
            } else {
                $(this).attr("class", function(d) { return d.group == groupSysId ? "state inner-sys" : "state inner-app"; });
                appflowUpdateTimelines();
            }
        });


    enterNodes.append("text")
        .attr("dy", ".3em")
        .attr("class", "state-text")
        .text(function(d){
            return atob(d.name)
        });

    flowGraphObject.nodes
        .exit()
        .remove();

    flowGraphObject.flowForce.start();
}

function appflowUpdateTimelines(state, timelines) {
    //Update our timelines selector
    var itemsGroup = $("#stateTimelineGroup");
    itemsGroup.empty();
    var stateTimeline = $("#stateTimeline");

    if(state != undefined && timelines != undefined) {
        for (var l in timelines)
        if (timelines.hasOwnProperty(l)) {
            itemsGroup.append("<option value='" + state + "~" + l + "'>" + atob(l) + "</option>")
        }

        stateTimeline.select2({
            placeholder: "Select timeline",
            allowClear: false
        });

        // Because of allowClear = false we always automatically select
        // the first option, so let's trigger update manually
        appFlowTimelineChange(stateTimeline.val());
    } else {
        stateTimeline.select2({
            placeholder: "Select timeline",
            allowClear: false
        });

        appFlowTimelineChange();
    }
}

function appflowAddGraphTooltip() {
    return d3.select("body").append("div")
        .attr("class", "graph-tooltip")
        .style("opacity", 1e-6);
}

function updateFlowGraph(jsonUrl)
{
    d3.json(jsonUrl, function(error, json) {
        //Show placeholder if needed
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
        } else {
            json = unwindFlowData(json);
            updateFlowData(flowGraphData, json[0].data);   //All versions only for now
            $("#noDataBlock").hide();
        }

        updateFlowGraphData();
    });
}

function createFlowGraph(jsonUrl, flowContainer, timelineContainer)
{
    flowGraphObject.flowSvg = d3.select("#" + flowContainer).append("svg")
                            .attr("width", "100%")
                            .attr("height", "100%");
    flowGraphObject.flowForce = d3.layout.force()
                            .charge(-500)
                            .linkDistance( function(d) {
                                return (flowGraphData.nodes.scale(d.source.time) + flowGraphData.nodes.scale(d.target.time)) * 2; })
                            .size([$("#" + flowContainer).width(),$("#" + flowContainer).height()]);

    flowGraphObject.timelineElem = $("#" + timelineContainer);

    flowGraphObject.timelineSvgRoot = d3.select("#" + timelineContainer).append("svg")
                            .attr("width", "100%")
                            .attr("height", "100%");

    flowGraphObject.timelineWidth = flowGraphObject.timelineElem.width() - timelineMargins.left - timelineMargins.right;

    d3.json(jsonUrl, function(error, json) {
        //Show placeholder if needed
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
        } else
            $("#noDataBlock").hide();

        initFlowData(flowGraphData, json);

        updateFlowGraphData();

        flowGraphObject.flowTooltip = appflowAddGraphTooltip();
        flowGraphObject.flowForce
            .nodes(flowGraphData.data.states)
            .links(flowGraphData.data.transitions)
            .start();

        flowGraphObject.flowForce.on("tick", function() {
            flowGraphObject.links.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });

            flowGraphObject.nodes.attr("transform", function(d) {
                return "translate(" + d.x + "," + d.y + ")"; } ) ;
            });
    });
}

function initFlowControls() {
    var curDate = new Date();
    //Allow to select years from 2013 and forward to the current year
    var yearRange = "-" + (curDate.getFullYear() - 2013) + "~0";
    $("#appflowMonthPicker").monthpicker(
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
                updateFlowGraph(flowGraphObject.genDataUrl(newDate));
            }
        });

    var stateTimeline = $("#stateTimeline");
    stateTimeline.select2({
        placeholder: "Select timeline",
        allowClear: false
    });

    stateTimeline.on("change", function(e) {
        appFlowTimelineChange(e.val);
    });

    createFlowGraph(flowGraphObject.genDataUrl(new Date()), "behaviorAppFlowGraph", "behaviorAppFlowTimelineGraph");
}

function eventBlockMouseOver(d, i) {
    $(this).attr("stroke-width", 2);

    flowGraphObject.timelineTip
          .style("display", null)
          .attr("transform", "translate(" + d.xOffset + "," + flowGraphObject.timelineY(flowGraphObject.timeRangesCount - d.parentIndex - 1) + ")");

    flowGraphObject.timelineTipName
          .text(atob(d.name) + (d.type == 0 ? "(Economy)" : "") + ": " + d.eventsAmount + " events.");
}

function eventBlockMouseOut() {
    $(this).attr("stroke-width", 0);
    flowGraphObject.timelineTip.style("display", "none");
}

function appFlowTimelineChange(timeline) {
    if(flowGraphObject.timelineSvg != undefined) flowGraphObject.timelineSvg.remove();
    flowGraphObject.timelineSvg =
        flowGraphObject.timelineSvgRoot
                          .append("g")
                            .attr("transform", "translate(" + timelineMargins.left + "," + timelineMargins.top + ")");

    if(timeline == undefined || timeline == null) return;

    var idSplit = timeline.split("~");
    var stateId = idSplit[0];
    var timelineId = idSplit[1];

    var timelineData = (flowGraphData.original.timelines[stateId])[timelineId];

    // Bake this timeline, create array instead of objects, also
    // Calculate the maximum number of events per line & also max number of events per line
    if(timelineData.timePoints == undefined) {
        var maxEventsPerTimeRange = 0;
        var maxEventsPerTimeRangeTypes = 0;
        var maxEventTypesPerTimeRange = 0;

        var timelineDataPoints = [];
        for (var d in timelineData)
        if (timelineData.hasOwnProperty(d)) {
            var dataPoint = timelineData[d];
            dataPoint.id = parseInt(d, 10);
            dataPoint.index = timelineDataPoints.length;

            var timeRangeEvents = 0;
            var timeRangeEventTypes = 0;
            var timeRangeArray = [];
            if(dataPoint.e != undefined) {
                for(var ev in dataPoint.e)
                if(dataPoint.e.hasOwnProperty(ev)){
                    dataPoint.e[ev].index = timeRangeArray.length;
                    dataPoint.e[ev].name = ev;
                    dataPoint.e[ev].parentIndex = dataPoint.index;
                    dataPoint.e[ev].countOffset = timeRangeEvents;
                    dataPoint.e[ev].eventsAmount = dataPoint.e[ev].h;
                    dataPoint.e[ev].type = 0;

                    timeRangeEventTypes += 1;
                    timeRangeEvents += dataPoint.e[ev].h;

                    timeRangeArray.push(dataPoint.e[ev]);
                }
            }

            if(dataPoint.v != undefined) {
                var calcFunc = function(obj) {
                    if(obj == undefined) return 0;

                    var total = 0;
                    for(var it in obj)
                    if(obj.hasOwnProperty(it))
                        total += obj[it];

                    return total;
                };

                for(var uv in dataPoint.v)
                if(dataPoint.v.hasOwnProperty(uv)){
                    dataPoint.v[uv].index = timeRangeArray.length;
                    dataPoint.v[uv].name = uv;
                    dataPoint.v[uv].parentIndex = dataPoint.index;
                    dataPoint.v[uv].countOffset = timeRangeEvents;
                    dataPoint.v[uv].type = 1;

                    timeRangeEventTypes += 1;
                    var eventsAmount = 0;

                    eventsAmount += calcFunc(dataPoint.v[uv].d1);
                    eventsAmount += calcFunc(dataPoint.v[uv].d2);
                    eventsAmount += calcFunc(dataPoint.v[uv]["~"]);
                    timeRangeEvents  += eventsAmount;
                    dataPoint.v[uv].eventsAmount = eventsAmount;

                    timeRangeArray.push(dataPoint.v[uv]);
                }
            }

            if(maxEventsPerTimeRange < timeRangeEvents) {
                maxEventsPerTimeRange = timeRangeEvents;
                maxEventsPerTimeRangeTypes = timeRangeEventTypes;
            }

            if(maxEventTypesPerTimeRange < timeRangeEventTypes) maxEventTypesPerTimeRange = timeRangeEventTypes;

            dataPoint.events = timeRangeArray;
            timelineDataPoints.push(dataPoint);
        }

        timelineDataPoints.sort(function(a,b){
                    a = a.id;
                    b = b.id;
                    return a < b ? -1 : a > b ? 1 : 0;
                  });

        flowGraphObject.maxEventsPerTimeRange = maxEventsPerTimeRange;
        flowGraphObject.maxEventTypesPerTimeRange = maxEventTypesPerTimeRange;
        flowGraphObject.eventsPerPixel = maxEventsPerTimeRange / (flowGraphObject.timelineWidth - maxEventsPerTimeRangeTypes * timelineMargins.minBarWidth);

        //Calculate pixel offsets for all event blocks
        for(var tpi = 0; tpi < timelineDataPoints.length; ++tpi) {
            var xOffset = 0;
            var dataLine = timelineDataPoints[tpi].events;
            for(var tdi = 0; tdi < dataLine.length; ++tdi){

                //Calculate event block bar width
                var barWidth = dataLine[tdi].eventsAmount / flowGraphObject.eventsPerPixel;
                if(barWidth < timelineMargins.minBarWidth) barWidth = timelineMargins.minBarWidth;
                //if(barWidth > timelineMargins.maxBarWidth) barWidth = timelineMargins.maxBarWidth;
                barWidth = Math.floor(barWidth);

                dataLine[tdi].xWidth = barWidth;
                dataLine[tdi].xOffset = xOffset;
                xOffset += barWidth + 1;
            }

        }

        timelineData.timePoints = timelineDataPoints;

    }

    var timeRangesCount = timelineData.timePoints.length;
    flowGraphObject.timeRangesCount = timeRangesCount;
    var timelineGraph = $("#behaviorAppFlowTimelineGraph");
    timelineGraph.height(timelineMargins.top + timelineMargins.bottom + timeRangesCount * timelineMargins.lineHeight);

    flowGraphObject.timelineY = d3.scale.ordinal()
        .domain(d3.range(0, timeRangesCount))
        .rangeRoundBands([timeRangesCount * timelineMargins.lineHeight, 0], .5, .5);

    var timelineColors = flowGraphObject.maxEventTypesPerTimeRange > 10 ? d3.scale.category20() : d3.scale.category10();

    flowGraphObject.timelineTip = flowGraphObject.timelineSvg.append("g")
          .attr("class", "g-tip")
          .style("display", "none");

    flowGraphObject.timelineTipText = flowGraphObject.timelineTip.append("text").attr("y", -4);
    flowGraphObject.timelineTipName = flowGraphObject.timelineTipText.append("tspan").attr("class", "g-tip-name");

    var timeRange = flowGraphObject.timelineSvg.append("g")
          .attr("class", "g-timerange")
        .selectAll("g")
          .data(timelineData.timePoints)
        .enter().append("g")
          .attr("transform", function(d) { return "translate(0," + flowGraphObject.timelineY(timeRangesCount - d.index - 1) + ")"; });

    timeRange.append("text")
      .attr("class", "g-timerange-title")
      .attr("x", -36)
      .attr("y", flowGraphObject.timelineY.rangeBand() / 2)
      .attr("dy", ".35em")
      .text(function(d)
        {
            return formatTimelineTime(d.id);
        });

    var eventBlock = timeRange.append("g")
            .attr("class", "g-timerange-eventblock")
        .selectAll("g")
            .data(function(d){ return d.events; })
        .enter().append("g")
            .attr("transform", function(d, i) { return "translate(" + (16 + d.xOffset) + ",0)"; });

    eventBlock.append("rect")
        .attr("height", flowGraphObject.timelineY.rangeBand())
        .attr("width", function(d) { return d.xWidth; })
        .attr("fill", function(d) { return timelineColors(d.index); } )
        .attr("stroke", "rgb(0,0,0)")
        .attr("stroke-width", 0)
        .attr("shape-rendering", "crispEdges")
        .on("mouseover", eventBlockMouseOver)
        .on("mouseout", eventBlockMouseOut);
            /*
      var round = year.append("g")
          .attr("class", "g-round")
        .selectAll("line")
          .data(function(d) {
            return d3.nest()
                .key(function(d) { return d.round; })
                .entries(d.values);
          })
        .enter().append("line")
          .attr("x1", function(d) { return x(d.values[0].pick); })
          .attr("x2", function(d) { return x(d.values[d.values.length - 1].pick + 1) - 1; })
          .attr("y1", y.rangeBand() + 2)
          .attr("y2", y.rangeBand() + 2);

      d3.selectAll(".g-player-annotation")
          .datum(function() { return this.getAttribute("data-player"); })
          .on("mouseover", function(n) { pick.filter(function(d) { return d.name === n; }).each(mouseover); })
          .on("mouseout", mouseout);

      // Display non-overlapping labels, with priority to the lowest rank.
      function relabel() {
        pick.filter(".g-selected").select("text").forEach(function(group) {
          var labels = [],
              i = -1,
              n = group.length,
              x0, x1,
              node;

          group.sort(function(a, b) { return a.__data__.rank - b.__data__.rank; });

          while (++i < n) {
            node = group[i];
            x0 = x(node.__data__.pick);
            x1 = x0 + node.getComputedTextLength();
            if (labels.some(function(l) { return l[0] < x1 && l[1] > x0; })) {
              d3.select(node).style("display", "none");
              continue;
            }
            labels.push([x0, x1]);
          }
        });
      }




    */



}

$(function(){
    flowGraphObject.appFlowDataUrl = $("#appflowMonthPicker").data("appflow-url");
    flowGraphObject.genDataUrl = function(d) { return flowGraphObject.appFlowDataUrl + mobileAppId + "/" + convertDateToUTC(d).getTime()};
    initFlowControls();
});