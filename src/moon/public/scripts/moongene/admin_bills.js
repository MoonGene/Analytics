
var billsData = {};

function generateBill(id) {
    var dataUrl = "/data/admin/finance/bills/createinvoice/" + id + "/" + billsData.year + "/" + billsData.month;
    d3.json(dataUrl, function(error, json) {
        var a = 5;
    })
}

function payBill(id) {
    var dataUrl = "/data/admin/finance/bills/pay/" + id + "/" + billsData.year + "/" + billsData.month;
    d3.json(dataUrl, function(error, json){
        var b = 5;
    })
}

function preBakeBillData(data) {
    var flatArray = [];
    for(var d in data)
    if (data.hasOwnProperty(d) ){
        data[d].portal = {};
        data[d].portal.plan = data[d].payments.plan;
        data[d].portal.billExists = false;
        if(data[d].payments.transactions != undefined)
        for(var i = data[d].payments.transactions.length - 1; i >= 0; --i) {
            var trans = data[d].payments.transactions[i];
            if(trans.type == 0) { //Invoice
                var forDate = new Date(trans.for_date);
                if(forDate.getFullYear() == billsData.year && forDate.getMonth() + 1 == billsData.month)
                {
                    data[d].portal.billExists = true;
                    data[d].portal.billPaid = trans.paid;
                    data[d].portal.billAmount = trans.amount;
                    break;
                }
            }
        }
        flatArray.push(data[d]);
    }
    data.flat = flatArray; //Convert from objects list to array
}

function fillBillsTable(year, month, reset) {
    reset = reset != undefined ? reset : true;
    //month is zero based
    var dataUrl = "/data/admin/finance/bills/" + year + "/" + month;
    d3.json(dataUrl, function(error, json) {
        if(json == undefined) return;
        billsData.data = json;
        billsData.year = year;
        billsData.month = month;
        preBakeBillData(json);

        if(billsData.tableInitialized == undefined || billsData.tableInitialized == false) {
            var dataTable = $('#billsTableMain').dataTable({
                "sPaginationType": "bootstrap",
                "iDisplayLength": 25,
                "sDom": "<'row-fluid'<'span5'T><'span3'l><'span4'f>r>t<'row-fluid'<'span6'i><'span6'p>>",
                "oLanguage": {
                    "sLengthMenu": "_MENU_ per page"
                },
                "oTableTools": {
                    "sSwfPath": commonPath + "scripts/plugins/tables/DataTables/extras/TableTools/media/swf/copy_csv_xls_pdf.swf"
                }
            });

            dataTable.fnSort( [ [0, 'desc'] ]);
            billsData.tableInitialized = true;
        }

        var table = $("#billsTableMain").dataTable();
        if(reset)
            table.fnClearTable();

        for(var i = 0; i < billsData.data.flat.length; ++i) {
            var val = billsData.data.flat[i];
            var id = val["_id"];
            var name = val["first_name"] + " " + val["last_name"] + "<br>" + val["email"];
            var details = val.payments.last4 != undefined ? ("**** **** **** " + val.payments.last4) : "No Card";
            var bill = "";
            if(!val.portal.billExists)
                bill = "<input type='button' class='btn btn-primary' value='Create Invoice' onclick=\"javascript: generateBill('" + id + "');\">";
            else {
                bill = "$ " + val.portal.billAmount / 100.0;
                if(!val.portal.billPaid) {
                    bill += " <input type='button' class='btn btn-primary' value='Pay bill' onclick=\"javascript: payBill('" + id + "');\">";
                }
            }

            var status = val.portal.billExists && val.portal.billPaid ? "PAID" : "";

            table.fnAddData([
                id,
                name,
                val.payments.plan,
                details,
                bill,
                status
            ]);
        }
    });
}


function initBillsControls() {
    var curDate = new Date();
    //Allow to select years from 2013 and forward to the current year
    var yearRange = "-" + (curDate.getFullYear() - 2013) + "~0";
    $("#billsMonthPicker").monthpicker(
        {
            elements: [
                {tpl:"year",opt:{

                    range: yearRange
                }},
                {tpl: "month", opt:{
                    value: curDate.getMonth() + 1
                }}
            ],
            onChanged: function(data, $e) { fillBillsTable(data.year, data.month); }
        });

    fillBillsTable(curDate.getFullYear(), curDate.getMonth() + 1);
}

initBillsControls();