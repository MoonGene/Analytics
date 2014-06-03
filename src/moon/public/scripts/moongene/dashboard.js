
function daysInMonth(month,year) {
    return new Date(year, month, 0).getDate();
}

var cachedData = {};


$(function(){
    //Modal dialogs
    $("#modal-newapp-create").click(function() {
        //TODO Show proper loading button state until we get results
        /*
            $("#modal-newapp-footer").html("<i></i>Creating an app...")
                                     .attr('class', 'glyphicons pen')
                                     .css("color", "");
          */
            $.post($("#modal-newapp-create").data("create-url"), $("#modal-newapp-form").serialize(), function(data) {
                if(data.code == "0")
                    window.location.replace(data.redirect);
                else {
                    //TODO Show error message here
                /*
                    $("#modal-signup-footer").html("<i></i>" + data.message)
                                             .css("color", "#e5412d")
                                             .attr('class', 'glyphicons warning_sign');*/
                }
            });
        });

    $(".collapse-toggle").click(function() {
        if ($("#segment-block").hasClass('in') == false) {
            $("#segment-block").removeClass("widget-visible");
            $("#segment-block").addClass("widget-hidden");
        }
        else {
            $("#segment-block").removeClass("widget-hidden");
            $("#segment-block").addClass("widget-visible");
        }
    });

    $(".plan-upgrade").click(function() {
        $('#modal-payment-plan').html($(this).data("plan"));
        $('#modal-payment-plan-hidden').val($(this).data("plan"));
        $('#modal-payment-price').html("$" + $(this).data("price-pretty"));
        $('#modal-payment-events').html($(this).data("events-pretty"));

        var currentDate = new Date();
        var dayOfMonth = currentDate.getDate() - 1; //We count current day as not passed
        var monthLength = daysInMonth(currentDate.getYear(), currentDate.getMonth());
        var daysRemaining = monthLength - dayOfMonth - 1;
        var percentPassed = dayOfMonth / monthLength;
        var newPlanPrice = $(this).data("price");
        var paidPerDay = $('#modal-payment-plan-hidden').data("paid-per-day");
        var remainderCredit = paidPerDay * daysRemaining;
        var amountToBePaid = ((newPlanPrice - newPlanPrice * percentPassed - remainderCredit) / 100).toFixed(0);

        $('#modal-payment-initialamount').html("$" + amountToBePaid);
        $('#modal-payment-initialperiod').html((currentDate.getMonth() + 1) + "/" + (dayOfMonth + 1) + " - " +
            (currentDate.getMonth() + 1) + "/" + monthLength);
        $('#modal-payment').modal();
    });

    $(".invoice-pay").click(function() {
        $('#modal-payment').modal();
    });

    //Payments popup
    $("#inputmask-cc-number").inputmask("mask", {"mask": "9999 9999 9999 9999", placeholder: "*"});
    $("#inputmask-cc-expdate").inputmask("mask",{"mask": "99/99", "placeholder": "mm/yy" });
    $("#inputmask-cc-cvc").inputmask("mask", {"mask": "999", placeholder: "*"});

    $("#usePreviousCard").change(function() {
        var ccElem = $("#inputmask-cc-number");
        var expElem = $("#inputmask-cc-expdate");
        var cvcElem = $("#inputmask-cc-cvc");
        $(ccElem).prop("disabled",!$(ccElem).prop("disabled"));
        $(expElem).prop("disabled",!$(expElem).prop("disabled"));
        $(cvcElem).prop("disabled",!$(cvcElem).prop("disabled"));
    });

    $('body').on('click.clearForm', '[data-dismiss=modal]', function (){
        var $modal = $(this).parents().find('.modal');
        $modal.find('form')[0].reset();
    });

    $("#modal-payment-pay").click(function() {
        var $button = $(this),
            url =  $button.data("payment-url"),
            data = $("#modal-payment-form").serialize();

        $button.button('loading');
        $button.prop('disabled', true);

        $.ajax({
           type: 'POST',
           url: url,
           data: data,
           success: function(response){
               if(response.code == "0"){
                   notyfy({text: 'You invoice has been paid successfully!', type: 'success',
                       layout: 'center', modal: true, buttons: [{
                           addClass: 'btn btn-primary',
                           text: 'Ok',
                           onClick: function(notyfy) {
                               notyfy.close();
                               window.location.replace(response.redirect);
                           }
                       }]
                   });
               }
               else {
                   notyfy({text: 'Error: ' + response, type: 'error',// TODO: update error message
                       layout: 'center', modal: true, buttons: [{
                           addClass: 'btn btn-primary',
                           text: 'Ok',
                           onClick: function(notyfy) {
                               notyfy.close();
                               window.location.replace(response.redirect);
                           }
                       }]
                   });
               }
           },
           complete: function(){
               $button.prop('disabled', false);
               $button.button('reset');
               $button.trigger('click.dismiss.modal');
           }
        });
    });

    $("#navbar-messages").click(function() {
        $('#modal-messages').modal();

        if(cachedData.messages == undefined)
        $.get($("#navbar-messages").data("messages-url"), function( data ) {
          cachedData.messages = data;

          var readNotifications = [];
          cachedData.messages.inbox.all = cachedData.messages.inbox.all.sort(function(a,b){
            a = new Date(cachedData.messages[a].blocks[0].when);
            b = new Date(cachedData.messages[b].blocks[0].when);
            return a > b ? -1 : a < b ? 1 : 0;
          });

          var $infoTab = $("#filterUsersTabList"),
              $filterMessagesTab = $('#filterMessagesTab'),
              $messageList = $filterMessagesTab.find('ul').first();

          if(!cachedData.messageTemplate){
              cachedData.messageTemplate = $filterMessagesTab.find('.template').first().html();
          }

          var messageTemplate = doT.template(cachedData.messageTemplate);
            $messageList.empty();

          for(var i = 0; i < cachedData.messages.inbox.all.length; ++i) {
                var msg = cachedData.messages[cachedData.messages.inbox.all[i]];
                if(msg.system) {
                    var isUnread = cachedData.messages.inbox.unread.indexOf(msg._id) > -1;
                    if(isUnread) readNotifications.push(msg._id);
                    //Add to notifications tab
                    var action = msg.action;
                    var when = new Date(msg.blocks[0].when);
                    var topic = msg.topic;
                    var notif = "<li" + (isUnread ? " class='highlight'>" : ">");
                        notif += "<span class='date'>" + (when.getMonth() + 1) + "/" + when.getDate() + "</span>";
                        notif += "<span class='glyphicons activity-icon circle_info'><i></i></span>";
                        notif += "<a href='" + action + "'>";
                        notif += "<span class='ellipsis'>" + topic + "</span>";
                        notif += "</a>";
                        notif += "<div class='clearfix'></div>";
                        notif += "</li>";

                    $infoTab.append(notif);
                } else {
                    $messageList.append(messageTemplate(msg));
                }
            }

            $filterMessagesTab.find('li').click(function(){
                var $this = $(this);
                $this.toggleClass('highlight');
                $this.next('.chat').toggle();
            });

            $filterMessagesTab.find('.chat-controls button').click(function(){
                var $sendButton = $(this),
                    $form = $sendButton.parents('form').first(),
                    $messageInput = $form.find('input'),
                    formData = $form.serialize();

                $sendButton.prop('disabled', true);
                $messageInput.prop('disabled', true);

                $.ajax({
                    type: "POST",
                    url: $form.attr('action'),
                    //contentType: 'application/json',
                    data: formData,
                    dataType: 'json',
                    success: function(result){
                          $messageInput.val('').prop('disabled', false);
                          alert('Message sent. Error message: ' + result.message);
                    },
                    error: function(result){
                        alert('Error sending message: ' + result.message);
                        $messageInput.prop('disabled', false);
                    }
                });
            });

            $filterMessagesTab.find('.chat-controls input').bind('keyup change', function(){
                var $messageInput = $(this),
                    $sendButton = $messageInput.parents('form').find('button');

                $sendButton.prop('disabled', ($.trim($messageInput.val()).length < 1));
            });

          //Mark notifications as read now
          if(readNotifications.length > 0)
          $.post(
              $("#navbar-messages").data("messages-read-url"),
              { "ids": readNotifications },
              function(data) {
                //alert(data);
                });
        });
    });
});