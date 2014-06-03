
$(function()
{
    var tz = jstz.determine(); // Determines the time zone of the browser client
    $("#timezone").val(tz.name()); // Returns the name of the time zone eg "Europe/Berlin"

    //Modal login and sign up forms processing
    var callbackLogin = function() {
        $("#modal-login-footer").html("<i></i>Signing in...")
                                .attr('class', 'glyphicons pen')
                                .css("color", "");

        var btn = $("#modal-login-submit");
        btn.button('loading');
        setTimeout(function () { btn.button('reset') }, 3000);

        $.post($("#modal-login-submit").data("login-url"), $("#modal-login-form").serialize(), function(data) {
            if(data.code == "0")
                window.location.replace(data.redirect);
            else {
                $("#modal-login-footer").html("<i></i>" + data.message)
                                        .css("color", "#e5412d")
                                        .attr('class', 'glyphicons warning_sign');
                setTimeout(function () { btn.button('reset') }, 0);
            }
        });
     };
     var callbackSignup = function() {
        $("#modal-signup-footer").html("<i></i>Signing up...")
                                 .attr('class', 'glyphicons pen')
                                 .css("color", "");

        var btn = $("#modal-signup-submit");
        btn.button('loading');
        $("#modal-signup-submit").html('<i></i><span class="strong">Signing Up...</span>');
        setTimeout(function () { btn.button('reset') }, 3000);

        $.post($("#modal-signup-submit").data("signup-url"), $("#modal-signup-form").serialize(), function(data) {
            if(data.code == "0")
                window.location.replace(data.redirect);
            else {
                $("#modal-signup-footer").html("<i></i>" + data.message)
                                         .css("color", "#e5412d")
                                         .attr('class', 'glyphicons warning_sign');
                setTimeout(function () { btn.button('reset') }, 0);
            }
        });
     };
    var callbackSubscribe = function() {
        var btn = $("#modal-subscribe-submit");
        btn.button('loading');
        setTimeout(function () { btn.button('reset') }, 3000);

        $.post($("#modal-subscribe-submit").data("subscribe-url"), $("#modal-subscribe-form").serialize(), function(data) {
            //TODO Add better handling of errors and subscription
            /*if(data.code == "0")
                window.location.replace(data.redirect);
            else {
                setTimeout(function () { btn.button('reset') }, 0);
            }*/
        });
    };

    $("#modal-login-submit").click(callbackLogin);
    $("#modal-login").keypress(function(event) {
        if (event.which == 13) {
            callbackLogin();
        }
    });

    $("#modal-signup-submit").click(callbackSignup);
    $("#modal-signup").keypress(function(event) {
        if (event.which == 13) {
            callbackSignup();
        }
    });

    $("#modal-subscribe-submit").click(callbackSubscribe);
    $("#modal-subscribe").keypress(function(event) {
        if (event.which == 13) {
            callbackSubscribe();
        }
    });
});