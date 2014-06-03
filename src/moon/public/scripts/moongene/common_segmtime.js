function segmentPlatformByID(id) {
    switch(id) {
        case "1":
        case 1:   return "Android";

        case "2":
        case 2:   return "iOS";
    }
    return "Unknown";
}

function requestSegmentDeletion(name) {
    $.get( segmentDataObject.segmentDataUrl + "/delete/" + name, function( data ) {
        if(data.code != 0) {
            notyfy({
                text: "Can't delete segment '" + name + "'. " + data.msg,
                type: 'error'
            });

        } else {
            notyfy({
                text: "Segment '" + name + "' has been deleted.",
                type: 'success'
            });

        }
    });
}

function requestSegmentSave(forSave){
    $.ajax({
        type: 'POST',
        url: segmentDataObject.segmentDataUrl + "/save",
        data: JSON.stringify(forSave),
        success: function(data)
            {
                if(data.code != 0) {
                    notyfy(
                    {
                        text: "Can't save segment '" + forSave.name + "'. " + data.msg,
                        type: 'error'
                    });
                } else {
                    notyfy(
                    {
                        text: "Segment '" + forSave.name + "' is saved.",
                        type: 'success'
                    });
                }
            },
        contentType: "application/json",
        dataType: 'json'
    });
}

function isSegmentTimeRangeComplete() {
    if(segmentData == undefined) return false;
    if(segmentData.dateFromMs == undefined || segmentData.dateFromMs == 0) return false;
    if(segmentData.dateToMs == undefined  || segmentData.dateToMs == 0) return false;
    return true;
}

function isSegmentFilterComplete() {
    if(segmentData == undefined) return false;
    if(segmentData.countries != undefined && segmentData.countries.length > 0) return true;
    if(segmentData.resolution != undefined && segmentData.resolution.length > 0) return true;
    if(segmentData.vendor != undefined && segmentData.vendor.length > 0) return true;
    if(segmentData.model != undefined && segmentData.model.length > 0) return true;
    if(segmentData.carrier != undefined && segmentData.carrier.length > 0) return true;
    if(segmentData.platform != undefined && segmentData.platform.length > 0) return true;
    if(segmentData.platformV != undefined && segmentData.platformV.length > 0) return true;

    return false;
}

function applySegment() {
    //var segmentData = {}; //This object is in another javascript
    if(!safeSegmentBuild(segmentData)) {
        var notyfiy = notyfy({
            text: 'Segment is empty. Please select at least one filter.',
            type: 'danger'
        });
        return;
    }


    segmentData.countries = segmentData.countries == undefined ? [] : segmentData.countries;
    segmentData.resolution = segmentData.resolution == undefined ? [] : segmentData.resolution;
    segmentData.vendor = segmentData.vendor == undefined ? [] : segmentData.vendor;
    segmentData.model = segmentData.model == undefined ? [] : segmentData.model;
    segmentData.carrier = segmentData.carrier == undefined ? [] : segmentData.carrier;
    segmentData.platform = segmentData.platform == undefined ? [] : segmentData.platform;
    segmentData.platformV = segmentData.platformV == undefined ? [] : segmentData.platformV;
    $("#segment-current-title").html(segmentData.name);

    if(!isSegmentFilterComplete() || !isSegmentTimeRangeComplete()) {
        notyfy({
            text: 'Both segment filter and time range has to be filled.',
            type: 'danger'
        });
        return;
    }

    requestSegmentData();
}

function loadSegment(name) {
    //Let's find this segment
    var segmentInfo = null;
    for(var i = 0; i < savedSegments.length; ++i)
        if(savedSegments[i].name == name) {
            segmentInfo = savedSegments[i];
            break;
        }

    if(segmentInfo == null) {
        //Everything is bad, notify the user it's not OK.

        notyfy({
            text: 'Segment "' + name + '" is not found.',
            type: 'danger'
        });
        return;
    }

    //Clean everything first
    newSegment();

    $("#segment-current-title").html(name);
    $("#segment-current-dropdown").val(name);
    $("#segment-current-save").html("Save as '" + name + "'");
    $("#segment-current-delete").html("Delete '" + name + "'");


    for (var k in segmentInfo)
    if (segmentInfo.hasOwnProperty(k)) {
        var filterValues = segmentInfo[k];
        switch(k) {
            case "countries": { addSegmentFilter("country"); $("#segment-filter-country").select2("val", filterValues); break; }
            case "cities": { addSegmentFilter("city"); $("#segment-filter-city").select2("val", filterValues); break; }
            case "platform": { addSegmentFilter("platform"); $("#segment-filter-platform").select2("val", filterValues); break; }
            case "platformV": { addSegmentFilter("osversion"); $("#segment-filter-osversion").select2("val", filterValues); break; }
            case "language": { addSegmentFilter("language"); $("#segment-filter-language").select2("val", filterValues); break; }
            case "vendor": { addSegmentFilter("vendor"); $("#segment-filter-vendor").select2("val", filterValues); break; }
            case "model": { addSegmentFilter("model"); $("#segment-filter-model").select2("val", filterValues); break; }
            case "carrier": { addSegmentFilter("carrier"); $("#segment-filter-carrier").select2("val", filterValues); break; }
            case "connection": { addSegmentFilter("connection"); $("#segment-filter-connection").select2("val", filterValues); break; }
            case "appversion": { addSegmentFilter("appversion"); $("#segment-filter-appversion").select2("val", filterValues); break; }
            case "usertype": { addSegmentFilter("usertype"); $("#segment-filter-usertype").select2("val", filterValues); break; }
            case "trafficsource": { addSegmentFilter("trafficsource"); $("#segment-filter-trafficsource").select2("val", filterValues); break; }
            case "resolution": { addSegmentFilter("resolution"); $("#segment-filter-resolution").select2("val", filterValues); break; }
        }
    }
}

function newSegment() {
    $("#filtersBlock").empty();
    $("#segment-current-dropdown").val("");
    $("#segment-current-save").html("Save as 'Untitled'");
    $("#segment-current-delete").html("Delete 'Untitled'");
    $("#segment-current-title").html("");
}

function deleteSegment() {
    var nameToDel = $("#segment-current-dropdown").val();

    for(var i = 0; i < savedSegments.length; ++i)
        if(savedSegments[i].name == nameToDel) {
            savedSegments.splice(i, 1);
            $("#segm-load-entry-" + nameToDel).remove();
            break;
        }

    newSegment();
    requestSegmentDeletion(nameToDel);
}

function safeSegmentFilterAddition(addTo, withName, fromElementName, convertToInt) {
    if(convertToInt == undefined) convertToInt = false;

    var segmFilter = $("#" + fromElementName);
    if(segmFilter.length != 0) {
        var segmValuesList = segmFilter.select2("val");
        if(convertToInt)
            for(var i = 0; i < segmValuesList.length; ++i)
                segmValuesList[i] = parseInt(segmValuesList[i]);
        addTo[withName] = segmValuesList;
    }
}

function safeSegmentBuild(forSave) {
    forSave.name = $("#segment-current-dropdown").val();
    safeSegmentFilterAddition(forSave, "countries", "segment-filter-country");
    safeSegmentFilterAddition(forSave, "cities", "segment-filter-city", true);
    safeSegmentFilterAddition(forSave, "platform", "segment-filter-platform", true);
    safeSegmentFilterAddition(forSave, "platformV", "segment-filter-osversion");
    safeSegmentFilterAddition(forSave, "language", "segment-filter-language");
    safeSegmentFilterAddition(forSave, "vendor", "segment-filter-vendor");
    safeSegmentFilterAddition(forSave, "model", "segment-filter-model");
    safeSegmentFilterAddition(forSave, "carrier", "segment-filter-carrier");
    safeSegmentFilterAddition(forSave, "connection", "segment-filter-connection");
    safeSegmentFilterAddition(forSave, "appversion", "segment-filter-appversion");
    safeSegmentFilterAddition(forSave, "usertype", "segment-filter-usertype");
    safeSegmentFilterAddition(forSave, "trafficsource", "segment-filter-trafficsource");
    safeSegmentFilterAddition(forSave, "resolution", "segment-filter-resolution");

    //Ensure we got at least one filter
    for (var k in forSave)
    if (forSave.hasOwnProperty(k) && (k != "name" && k != "appId" && k != "dateFromMs" && k != "dateToMs" ) && forSave[k].length > 0)
        return true;

    return false;
}

function saveSegment() {
    var forSave = {};
    if(!safeSegmentBuild(forSave)) {
        notyfy({
            text: 'Segment "' + forSave.name + '" is empty. Please add at least one filter.',
            type: 'error'
        });

        window.alert('Segment "' + forSave.name + '" is empty. Please select at least one filter.');
        return;
    }

    var saved = false;
    for(var i = 0; i < savedSegments.length; ++i)
        if(savedSegments[i].name == forSave.name) {
            savedSegments[i] = forSave;
            saved = true;
        }
    if(!saved) {
        savedSegments.push(forSave);

        //Also add one more menu now in loading
        var newLoadSegment = "<li><a href=\"javascript: loadSegment('" + forSave.name + "');\" id='segm-load-entry-" + forSave.name + "'>" + forSave.name + "</a></li>";
        $("#segment-load-list").append(newLoadSegment);
    }


    $("#segment-current-title").html(forSave.name);
    requestSegmentSave(forSave);
}

function getSegmentUsedValues() {
    //Get our segmentation form values
    $.get( segmentDataObject.segmentDataUrl + "/values/" + mobileAppId, function( data ) {
        segmentDataObject.usedValues = data;
        //Make country searchable by ID
        segmentDataObject.usedValues.countryById = {};
        segmentDataObject.usedValues.citiesObj = {};
        if(segmentDataObject.usedValues.device.country != undefined)
        for(var i = 0; i < segmentDataObject.usedValues.device.country.length; ++i) {
            var val = segmentDataObject.usedValues.device.country[i];
            segmentDataObject.usedValues.countryById[val.c] = val.n;
        }

        //Transform cities to a better structure
        if(segmentDataObject.usedValues.device.city != undefined)
        for(var j = 0; j < segmentDataObject.usedValues.device.city.length; ++j) {
            var val = segmentDataObject.usedValues.device.city[j];
            if(segmentDataObject.usedValues.citiesObj[val.p] == undefined)
                segmentDataObject.usedValues.citiesObj[val.p] = [];
            segmentDataObject.usedValues.citiesObj[val.p].push(val);
        }

    });
}

function addSegmentFilter(filterName) {
    if(segmentDataObject.usedValues == undefined) return; //Not loaded yet

    var filtersBlock = $("#filtersBlock");
    var filterBlockID = "segment-filter-" + filterName;
    if($("#" + filterBlockID).length != 0) return;

    var filterTitle = "Untitled";
    var filterGroups = "";

    switch(filterName) {
        case "country": {
            filterTitle = "Country";
            filterGroups += '<optgroup label="Countries">';
                if(segmentDataObject.usedValues.device.country != undefined)
                for(var i = 0; i < segmentDataObject.usedValues.device.country.length; ++i) {
                    var country = segmentDataObject.usedValues.device.country[i];
                    filterGroups += '<option value="' + country.c + '">' + country.n + '</option>';
                }
            filterGroups += '</optgroup>';
            break;
        }
        case "city": {
            filterTitle = "City";
            for (var k in segmentDataObject.usedValues.citiesObj)
            if (segmentDataObject.usedValues.citiesObj.hasOwnProperty(k)) {
                var citiesArr = segmentDataObject.usedValues.citiesObj[k];
                var countryName = segmentDataObject.usedValues.countryById[k];
                filterGroups += '<optgroup label="' + countryName + '">';

                for(var i = 0; i < citiesArr.length; ++i)
                    filterGroups += '<option value="' + citiesArr[i].c + '">' + citiesArr[i].p + ': ' + citiesArr[i].n + '</option>';

                filterGroups += '</optgroup>';
            }

            break;
        }

        case "platform": {
            filterTitle = "Platform";
            filterGroups += '<optgroup label="Platforms">';
                for(var i = 0; i < segmentDataObject.usedValues.device.platform.length; ++i) {
                    var valNum = segmentDataObject.usedValues.device.platform[i];
                    filterGroups += '<option value="' + valNum + '">' + segmentPlatformByID(valNum) + '</option>';
                }
            filterGroups += '</optgroup>';
            break;
        }

        case "osversion": {
            filterTitle = "OS Version";

            for (var k in segmentDataObject.usedValues.device.platform_v)
            if (segmentDataObject.usedValues.device.platform_v.hasOwnProperty(k)) {
                var versionsArr = segmentDataObject.usedValues.device.platform_v[k];
                var platformName = segmentPlatformByID(k);
                filterGroups += '<optgroup label="' + platformName + '">';

                for(var i = 0; i < versionsArr.length; ++i)
                    filterGroups += '<option value="' + k + '~' + versionsArr[i] + '">' + platformName + ' ' + versionsArr[i] + '</option>';

                filterGroups += '</optgroup>';
            }
            break;
        }

        case "vendor": {
            filterTitle = "Vendor";
            filterGroups += '<optgroup label="Vendors">';
                if(segmentDataObject.usedValues.device.vendor != undefined)
                for(var i = 0; i < segmentDataObject.usedValues.device.vendor.length; ++i) {
                    var val = segmentDataObject.usedValues.device.vendor[i];
                    filterGroups += '<option value="' + val + '">' + val + '</option>';
                }
            filterGroups += '</optgroup>';
            break;
        }

        case "model": {
            filterTitle = "Model";

            for (var k in segmentDataObject.usedValues.device.vendor_models)
            if (segmentDataObject.usedValues.device.vendor_models.hasOwnProperty(k)) {
                var modelsArr = segmentDataObject.usedValues.device.vendor_models[k];
                filterGroups += '<optgroup label="' + k + '">';

                for(var i = 0; i < modelsArr.length; ++i)
                    filterGroups += '<option value="' + modelsArr[i] + '">' + modelsArr[i] + '</option>';

                filterGroups += '</optgroup>';
            }
            break;
        }
        case "resolution": {
            filterTitle = "Screen";
            filterGroups += '<optgroup label="Resolutions">';
                if(segmentDataObject.usedValues.device.screen != undefined)
                for(var i = 0; i < segmentDataObject.usedValues.device.screen.length; ++i) {
                    var val = segmentDataObject.usedValues.device.screen[i];
                    filterGroups += '<option value="' + val + '">' + val + '</option>';
                }
            filterGroups += '</optgroup>';
            break;
        }

        case 'carrier': {
            filterTitle = "Carrier";
            filterGroups += '<optgroup label="Carriers">';
                if(segmentDataObject.usedValues.device.carrier != undefined)
                for(var i = 0; i < segmentDataObject.usedValues.device.carrier.length; ++i) {
                    var carrier = segmentDataObject.usedValues.device.carrier[i];
                    filterGroups += '<option value="' + carrier + '">' + carrier + '</option>';
                }
            filterGroups += '</optgroup>';
            break;
        }
        case 'connection': {
            break;
        }

        case "appversion": {
            filterTitle = "App Version";
            filterGroups += '<optgroup label="Versions">';
                if(segmentDataObject.usedValues.user.version != undefined)
                for(var i = 0; i < segmentDataObject.usedValues.user.version.length; ++i) {
                    var version = segmentDataObject.usedValues.user.version[i];
                    var versionDecoded = atob(version);
                    filterGroups += '<option value="' + version + '">' + versionDecoded + '</option>';
                }
            filterGroups += '</optgroup>';
            break;
        }

        case "usertype": {
            filterTitle = "User Type";
            filterGroups += '<optgroup label="Types">';
                filterGroups += '<option value="paying">Paying</option>';
                filterGroups += '<option value="non-paying">Non-Paying</option>';
            filterGroups += '</optgroup>';
            break;
        }
    }

    var flt = '<div class="row-fluid">';
        //flt +=     '<div class="span1">';
        //flt +=        '<p>' + filterTitle + ':</p>';
        //flt +=     '</div>';
        flt +=     '<div class="span12">';
        flt +=        '<h5>' + filterTitle + '</h5>';
        flt +=      '<select multiple="multiple" style="width: 100%;" id="' + filterBlockID + '">';
        flt +=          filterGroups;
        flt +=      '</select>';
        flt +=      '<div class="separator bottom"></div>';
        flt +=     '</div>';
        flt +='</div>';

    filtersBlock.append(flt);
    $('#' + filterBlockID ).select2();
}

function initSegmentsPanel() {
    if(!savedSegments) return;

    // Segments panel initialization
    $("#segment-current-dropdown").change(
        function() {
            var txt = $("#segment-current-dropdown").val();
            if(txt == "") txt = "Untitled";
            $("#segment-current-save").html("Save as '" + txt + "'");
            $("#segment-current-delete").html("Delete '" + txt + "'");
        }
    );


    savedSegments.splice(savedSegments.length - 1, 1); //Remove the last element always

    var div = document.createElement('div');
    for(var i = 0; i < savedSegments.length; ++i) {
        //Decode name in case it has special symbols
        div.innerHTML = savedSegments[i].name;
        savedSegments[i].name = div.firstChild.nodeValue;

        var loadEntry = "<li><a href=\"javascript: loadSegment('" + savedSegments[i].name + "');\" id='segm-load-entry-" + savedSegments[i].name + "'>" + savedSegments[i].name + "</a></li>";
        $("#segment-load-list").append(loadEntry);
    }

    $("#segment-apply").click(applySegment);
}

function applyTimeRange(eventInfo, noRequest) {
    noRequest = noRequest == undefined ? false : noRequest;

    var range = $('#timerange-calendars').DatePickerGetDate(false);
    segmentData.dateFromMs = convertDateToUTC(range[0]).getTime();
    segmentData.dateToMs = convertDateToUTC(range[1]).getTime();
    segmentData.dateFromLocalMs = range[0].getTime();
    segmentData.dateToLocalMs = range[1].getTime();

    $("#timerange-current-title").html($("#timerange-currentsel-text").html());
    if(noRequest) return;

    if(!isSegmentFilterComplete() || !isSegmentTimeRangeComplete()) {
        /*
        var notyfy = notyfy(
        {
            text: 'Both segment filter and time range has to be filled.',
            type: 'danger'
        });
        */
        window.alert('Both segment filter and time range has to be filled.');
        return;
    }

    requestSegmentData();
}

function timeRangeChanged(range) {
    $('#timerange-preset-picker').val('custom'); //we should use bootstrap stuff here
    var firstDay = range[0], lastDay = range[1];

    var daysCount = 1 + Math.floor((convertDateToUTC(lastDay).getTime() - convertDateToUTC(firstDay).getTime())/(1000*60*60*24));
    $("#timerange-currentsel-text").html(firstDay.getMonthName(false) + " " + firstDay.getDate() + " - " +
        lastDay.getMonthName(false) + " " + lastDay.getDate() + " (" + daysCount + (daysCount == 1 ? " day)" : " days)"));
}

function timeRangePreset(val, name) {
    if(val == "custom") {
        $('#timerange-calendars').DatePickerClear();
        $("#timerange-currentsel-text").html("Select dates range...");
    } else {
        var curDay = new Date(), lastDay = new Date();
        var rollBackDays = 3;
        switch(val) {
            case "3d": rollBackDays = 3; break;
            case "7d": rollBackDays = 7; break;
            case "14d": rollBackDays = 14; break;
            case "28d": rollBackDays = 28; break;
        }
        var daysArray = [];
        while(rollBackDays > 0) {
            daysArray.push(curDay.getFullYear() + "-" + (curDay.getMonth() + 1) + "-" + curDay.getDate());
            curDay.setDate(curDay.getDate() - 1);
            rollBackDays -= 1;
        }
        curDay.setDate(curDay.getDate() + 1); //Increase to the first day of the range
        daysArray = daysArray.reverse();

        var daysCount = daysArray.length;
        $('#timerange-calendars').DatePickerSetDate(daysArray, true);
        $("#timerange-currentsel-text").html(curDay.getMonthName(false) + " " + curDay.getDate() + " - " +
            lastDay.getMonthName(false) + " " + lastDay.getDate() + " (" + daysCount + (daysCount == 1 ? " day)" : " days)"));
    }
}

function initTimeRangePanel() {
    if(!savedSegments) return;

    $('#timerange-calendars').DatePicker({
    	flat: true,
    	date: 'today',
    	calendars: 2,
    	mode: 'range',
        onChange: function(formatted) { timeRangeChanged($('#timerange-calendars').DatePickerGetDate(false)); }
    });
    timeRangePreset("3d", "Past 3 days");
    applyTimeRange("init", true);

    $('#timerange-preset-picker').change(function() {
        timeRangePreset($(this).val(), $(this).text())
    });

    $("#timerange-apply").click(applyTimeRange);
}
