
var graphMargins = {
    left: 10,
    right: 10,
    top: 10,
    bottom: 10
};

var formatNumber = d3.format("s"),
    format = function(d) { return "Samples: " + formatNumber(d); },
    color = d3.scale.category20();

var triggerGraphObjects = {};

$(function(){
    triggerGraphObjects.chartFlowName = "purchasetrigger_flow";
    triggerGraphObjects.chartFlowElem = $("#" + triggerGraphObjects.chartFlowName);

    triggerGraphObjects.graphWidth = triggerGraphObjects.chartFlowElem.width() - graphMargins.left - graphMargins.right;
    triggerGraphObjects.graphHeight = triggerGraphObjects.chartFlowElem.height() - graphMargins.top - graphMargins.bottom;


    triggerGraphObjects.chartFlowSvg = d3.select("#" + triggerGraphObjects.chartFlowName).append("svg")
        .attr("width", triggerGraphObjects.chartFlowElem.width())
        .attr("height", triggerGraphObjects.chartFlowElem.height())
      .append("g")
        .attr("transform", "translate(" + graphMargins.left + "," + graphMargins.top + ")");

    triggerGraphObjects.chartFlowSankey = d3.sankey()
        .nodeWidth(15)
        .nodePadding(10)
        .size([triggerGraphObjects.graphWidth,
            triggerGraphObjects.graphHeight]);

    triggerGraphObjects.chartFlowSankeyPath = triggerGraphObjects.chartFlowSankey.link();

    var todayDate = new Date();
    var dataUrl = "/data/eco/trigger/" + mobileAppId + "/" + convertDateToUTC(todayDate).getTime();
    ecoProfileInitPurchaseTrigger(dataUrl, todayDate);
});

function ecoProfileTriggerGetNodeIndex(name, jsonArray) {
    for(var i = 0; i < jsonArray.length; ++i)
    if(jsonArray[i].name == name) return i;

    return -1;
}

function ecoProfileTriggerPrettyName(name) {
    var nameParts = name.split(":");
    if(nameParts[1] == "") return atob(nameParts[2]);
    return atob(nameParts[1]) + ": " + atob(nameParts[2]);
}

function ecoProfileTriggerPrepareData(json) {
    json.baked = {};

    var nodesNames = [];
    var namesSet = {};
    for (var k in json.ecoprof.pt)
    if (json.ecoprof.pt.hasOwnProperty(k)) {
        var prop = json.ecoprof.pt[k];
        var flowSplit = k.split("~~");
        namesSet[flowSplit[0]] = true;
        namesSet[flowSplit[1]] = true;
    }

    for (var ns in namesSet)
    if (namesSet.hasOwnProperty(ns)) {
        nodesNames.push({"name": ns});
    }

    json.baked.nodes = nodesNames;

    //Now when we have names in an array, we can create links array
    var links = [];
    for (var l in json.ecoprof.pt)
    if (json.ecoprof.pt.hasOwnProperty(l)) {
        var value = json.ecoprof.pt[l];
        var flowSplit = l.split("~~");
        var source = ecoProfileTriggerGetNodeIndex(flowSplit[0], nodesNames);
        var target = ecoProfileTriggerGetNodeIndex(flowSplit[1], nodesNames);
        if(source == -1 || target == -1) continue;

        links.push({"source": source, "target": target, "value": value});
    }

    json.baked.links = links;
}

function ecoProfileInitPurchaseTrigger(dataUrl, todayDate) {
    d3.json(dataUrl, function(error, json) {
        //Show placeholder if needed
        if(json == undefined || (json.code != undefined && json.code < 0)) {
            $("#noDataBlock").show();
            return;
        } else
            $("#noDataBlock").hide();

        ecoProfileTriggerPrepareData(json);

        triggerGraphObjects.chartFlowSankey
              .nodes(json.baked.nodes)
              .links(json.baked.links)
              .layout(32);

        var link = triggerGraphObjects.chartFlowSvg.append("g").selectAll(".link")
          .data(json.baked.links)
          .enter().append("path")
            .attr("class", "link")
            .attr("d", triggerGraphObjects.chartFlowSankeyPath)
            .style("stroke-width", function(d) { return Math.max(1, d.dy); })
            .sort(function(a, b) { return b.dy - a.dy; });

        link.append("title")
          .text(function(d) { return ecoProfileTriggerPrettyName(d.source.name) + " → " + ecoProfileTriggerPrettyName(d.target.name) + "\n" + format(d.value); });

        var node = triggerGraphObjects.chartFlowSvg.append("g").selectAll(".node")
          .data(json.baked.nodes)
          .enter().append("g")
            .attr("class", "node")
            .attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; })
          .call(d3.behavior.drag()
            .origin(function(d) { return d; })
            .on("dragstart", function() { this.parentNode.appendChild(this); })
            .on("drag", dragmove));

        node.append("rect")
            .attr("height", function(d) { return d.dy; })
            .attr("width", triggerGraphObjects.chartFlowSankey.nodeWidth())
            .style("fill", function(d) { return d.color = color(ecoProfileTriggerPrettyName(d.name)); })
            .style("stroke", function(d) { return d3.rgb(d.color).darker(2); })
          .append("title")
            .text(function(d) { return ecoProfileTriggerPrettyName(d.name) + "\n" + format(d.value); });

          node.append("text")
              .attr("x", -6)
              .attr("y", function(d) { return d.dy / 2; })
              .attr("dy", ".35em")
              .attr("text-anchor", "end")
              .attr("transform", null)
              .text(function(d) { return ecoProfileTriggerPrettyName(d.name); })
            .filter(function(d) { return d.x < triggerGraphObjects.graphWidth / 2; })
              .attr("x", 6 + triggerGraphObjects.chartFlowSankey.nodeWidth())
              .attr("text-anchor", "start");

          function dragmove(d) {
            d3.select(this).attr("transform", "translate(" + d.x + "," + (d.y = Math.max(0, Math.min(triggerGraphObjects.graphHeight - d.dy, d3.event.y))) + ")");
            triggerGraphObjects.chartFlowSankey.relayout();
            link.attr("d", triggerGraphObjects.chartFlowSankeyPath);
          }
    });
}




