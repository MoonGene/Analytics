
const transitionLinkWidthMin = 2;
const transitionLinkWidthMax = 10;
const stateNodeSizeMin = 20;
const stateNodeSizeMax = 60;
const groupSysId = 0;
const groupAppId = 1;
const groupUnknownId = 2;

var flowGraphData = {};
var flowGraphObject = {};

$(function(){
    flowGraphObject.chartFlowName = "firstsession_flow";
    flowGraphObject.chartFlowElem = $("#" + flowGraphObject.chartFlowName);

    var appVersion = $("#firstSessionAppVersion");
    appVersion.select2({
        placeholder: "Select version",
        allowClear: false
    });

    appVersion.on("change", function(e) {
        flowGraphObject.currentAppIndex = parseInt(e.val);
        flowGraphData = flowGraphObject.fullData[flowGraphObject.currentAppIndex];
        updateFlowGraphData();

        flowGraphObject.flowForce
            .nodes(flowGraphData.data.states)
            .links(flowGraphData.data.transitions)
            .start();
    });

    var dataUrl = "/data/behavior/firstsession/" + mobileAppId;

    firstSessionInit(dataUrl, "behaviorAppFlowGraph");
});

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
function flattenJson(obj, depth, includePrototype, into, prefix, unionChar) {
    depth = depth != undefined ? depth : -1;
    into = into != undefined ? into : {};
    prefix = prefix != undefined ? prefix : "";
    unionChar = unionChar != undefined ? unionChar : "_";

    for (var k in obj)
        if (includePrototype || obj.hasOwnProperty(k)) {
            var prop = obj[k];
            if (prop && typeof prop === "object" &&
                !(prop instanceof Date || prop instanceof RegExp) &&
                depth != 0) {
                flattenJson(prop, depth - 1, includePrototype, into, prefix + k + unionChar);
            }
            else {
                into[prefix + k] = prop;
            }
        }

    return into;
}

function appFlowTooltipTimeFormat(d) {
    var hours = (d / 3600).toFixed(0);
    var minutes = ((d % 3600) / 60).toFixed(0);
    var seconds = ((d % 3600) % 60).toFixed(0);

    if(hours > 0) return hours + "h " + minutes + "m " + seconds + "s";
    if(minutes > 0) return minutes + "m " + seconds + "s";
    return seconds + "s";
}


function unwindStateId(id) {
    var stateType = id[0];
    var stateName = id.substr(2);
    return stateType == '0' ? 'sys:' + stateName : 'app:' + stateName;
}

function unwindFlowData(json) {
    var bakedVersions = [];

    for (var k in json.v)
        if (json.v.hasOwnProperty(k)) {
            var prop = json.v[k];
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
    json.flat = {};
    json.flat.transitions = flattenJson(json, 1, undefined, undefined, undefined, "~~");
    //We need to create now a list of states
    json.flat.states = {};
    for (var ti in json.flat.transitions)
    if (json.flat.transitions.hasOwnProperty(ti)) {

        var value = json.flat.transitions[ti];
        valueId = ti.split("~~");
        if(json.flat.states[valueId[1]] != undefined)
            json.flat.states[valueId[1]].h += value;
        else
            json.flat.states[valueId[1]] = { h: value };

        if(json.flat.states[valueId[0]] == undefined)
            json.flat.states[valueId[0]] = { h: value };
    }


    var bakedJson = {};
    var statesArray = [];

    for (var k in json.flat.states)
        if (json.flat.states.hasOwnProperty(k)) {
            var prop = json.flat.states[k];
            if(prop) {
                //Example "0:Exit:~~"
                var stateName = k.substr(2);
                var stateCode = unwindStateId(k);
                var hits = prop.h == undefined ? 0 : prop.h;
                statesArray.push(
                    {
                        "name": stateName,
                        "code": stateCode,
                        "hits": hits
                    });
            }
        }

    statesArray.sort(function(a,b){
        a = a.code;
        b = b.code;
        return a < b ? -1 : a > b ? 1 : 0;
    });

    bakedJson.states = statesArray;

    var transitionsArray = [];

    for (var k in json.flat.transitions)
    if (json.flat.transitions.hasOwnProperty(k)) {
        var hits = json.flat.transitions[k];
        //Example "0:Start:Event~~~1:Main Menu:Event"
        var fromTo = k.split("~~");
        var fromState = unwindStateId(fromTo[0]);
        var toState = unwindStateId(fromTo[1]);

        transitionsArray.push(
            {
                "from": fromState,
                "to": toState,
                "hits": hits
            });

    }

    transitionsArray.sort(function(a,b){
        a = a.from + a.to;
        b = b.from + b.to;
        return a < b ? -1 : a > b ? 1 : 0;
    });


    bakedJson.transitions = transitionsArray;
    return bakedJson;
}

/*
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
*/

function initFlowData(jsonData)
{
    //Prepare our versions, they need to be flattened and then processed
    for (var v in jsonData.v)
    if (jsonData.v.hasOwnProperty(v)) {
        //Flatten this version object
        jsonData.v[v].flat = flattenJson(jsonData.v[v], 1, undefined, undefined, undefined, "~~");
    }

    jsonData = unwindFlowData(jsonData);

    var itemsGroup = $("#firstSessionAppVersionGroup");
    itemsGroup.empty();
    var appVersion = $("#firstSessionAppVersion");

    for(var vv = 0; vv < jsonData.length; vv++) {
        var versionJsonData = jsonData[vv].data;

        //We need to inject source and target indices, they are required by the
        //D3JS library to draw nodes and links. We also need to Inject group value
        //into the nodes, this will represent different colors and grouping by type
        var statesIndices = {};
        var states = versionJsonData.states;
        var transitions = versionJsonData.transitions;
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


        jsonData[vv].graph = {};
        jsonData[vv].graph.statesIndices = statesIndices;
        jsonData[vv].graph.data = versionJsonData;
        jsonData[vv].graph.nodes = {};
        jsonData[vv].graph.nodes.scale = d3.scale.linear()
                    .range([stateNodeSizeMin, stateNodeSizeMax])
                    .domain([d3.min(versionJsonData.states, function(d){ return d.hits; }),
                        d3.max(versionJsonData.states, function(d){ return d.hits; })]);

        jsonData[vv].graph.transitions = {};
        jsonData[vv].graph.transitions.scale = d3.scale.linear()
                    .range([transitionLinkWidthMin, transitionLinkWidthMax])
                    .domain([d3.min(versionJsonData.transitions, function(d){ return d.hits; }),
                        d3.max(versionJsonData.transitions, function(d){ return d.hits; })]);

        jsonData[vv].graph.nodes = {};
        jsonData[vv].graph.nodes.scale = d3.scale.linear()
            .range([stateNodeSizeMin, stateNodeSizeMax])
            .domain([d3.min(versionJsonData.states, function(d){ return d.hits; }),
                d3.max(versionJsonData.states, function(d){ return d.hits; })]);

        jsonData[vv].graph.transitions = {};
        jsonData[vv].graph.transitions.scale = d3.scale.linear()
            .range([transitionLinkWidthMin, transitionLinkWidthMax])
            .domain([d3.min(versionJsonData.transitions, function(d){ return d.hits; }),
                d3.max(versionJsonData.transitions, function(d){ return d.hits; })]);

        itemsGroup.append("<option value='" + vv + "'>" + jsonData[vv].name + "</option>")
    }

    flowGraphObject.currentAppIndex = 0;
    flowGraphData = jsonData[flowGraphObject.currentAppIndex];
    appVersion.select2({
        placeholder: "Select version",
        allowClear: false
    });

    return jsonData;

}

function updateFlowGraphData()
{
    flowGraphObject.links = flowGraphObject.flowSvg.selectAll("line")
        .data(flowGraphData.data.transitions)
        .style("stroke-width", function(d){ return flowGraphData.graph.transitions.scale(d.hits); });

    flowGraphObject.links
        .enter().insert("line", ":first-child")
        .attr("class", "transition")
        .style("stroke-width", function(d) { return flowGraphData.graph.transitions.scale(d.hits); });

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
        .attr("r", function(d) { return flowGraphData.graph.nodes.scale(d.hits) + 5; });

    enterNodes.append("circle")
        .attr("class", function(d) { return d.group == groupSysId ? "state inner-sys" : "state inner-app" })
        .attr("r", function(d) { return flowGraphData.graph.nodes.scale(d.hits); })
        .attr("style", function(d) { return d.group == groupSysId ? "cursor: arrow;" : "cursor: pointer;" })
        .on("mouseover", function(d) {
            if(d.group == groupSysId) return;

            flowGraphObject.flowTooltip.transition()
                .duration(50)
                .style("opacity", .9);

            var col = d.group == groupSysId ? "rgb(48,196,198)" : "rgb(49,189,235)";
            flowGraphObject.flowTooltip.style("border-color", col);
            flowGraphObject.flowTooltip.style("color", col);

            flowGraphObject.flowTooltip
                .html("<b>Hits: <br>"  + d.hits + "</b>")
                .style("left", (d3.event.pageX) + "px")
                .style("top", (d3.event.pageY - 28) + "px");
        })
        .on("mouseout", function(d) {
            if(d.group == groupSysId) return;
            flowGraphObject.flowTooltip.transition()
                .duration(25)
                .style("opacity", 0);
        });


    enterNodes.append("text")
        .attr("dy", ".3em")
        .attr("class", "state-text")
        .text(function(d){
            var splitName = d.name.split(":");
            var stateName = splitName[0] != "~" ? atob(splitName[0]) : ""; if(stateName == "~") stateName = "";
            var stateEvent = splitName[1] != "~" ? atob(splitName[1]) : ""; if(stateEvent == "~") stateEvent = "";
            return stateName + ((stateEvent != "" ? ": " + stateEvent : ""));
        });

    flowGraphObject.nodes
        .exit()
        .remove();

    flowGraphObject.flowForce.start();
}


function appflowAddGraphTooltip() {
    return d3.select("body").append("div")
        .attr("class", "graph-tooltip")
        .style("opacity", 1e-6);
}

/*
function updateFlowGraph(jsonUrl)
{
    d3.json(jsonUrl, function(error, json) {
        json = unwindFlowData(json);
        updateFlowData(flowGraphData, json[0].data);   //All versions only for now
        updateFlowGraphData();
    });
} */

function firstSessionInit(jsonUrl, flowContainer)
{
    flowGraphObject.flowSvg = d3.select("#" + flowContainer).append("svg")
        .attr("width", "100%")
        .attr("height", "100%");
    flowGraphObject.flowForce = d3.layout.force()
        .charge(-500)
        .linkDistance( function(d) {
            return (flowGraphData.graph.nodes.scale(d.source.hits) + flowGraphData.graph.nodes.scale(d.target.hits)) * 2; })
        .size([$("#" + flowContainer).width(),$("#" + flowContainer).height()]);


    d3.json(jsonUrl, function(error, json) {
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
            return;
        } else
            $("#noDataBlock").hide();

        flowGraphObject.fullData = initFlowData(json);
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

