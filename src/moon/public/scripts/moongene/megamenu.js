/* ==========================================================
 * FLAT KIT v1.2.0
 * megamenu.js
 * 
 * http://www.mosaicpro.biz
 * Copyright MosaicPro
 *
 * Built exclusively for sale @Envato Marketplaces
 * ========================================================== */ 

var megamenu = (function() 
{
    var $listItems = $( '.navbar.main li.mega-menu' ),
        $menuItems = $listItems.children( 'a' ),
        $subMenus = $( '.navbar.main li.mega-menu ul'),
        $subMenuIcon = $( '.navbar.main li.mega-menu .glyphicon-primary' ),
        $subMenuHeadline = $( '.navbar.main li.mega-menu .glyphicon-primary .headline' ),
        $subMenuDescription = $( '.navbar.main li.mega-menu .glyphicon-primary .description' ),
        $currentGlyph = "",
        $body = $( 'body' );
 
    function init() 
    {
        $menuItems.on( 'hover', open );
        $listItems.on( 'click', function( event ) { event.stopPropagation(); } );
        $subMenus.on ( 'hover', function( event ) {
            var newGlyph = event.currentTarget.attributes.getNamedItem("data-glyph").value;
            var headline = event.currentTarget.attributes.getNamedItem("data-headline").value;
            var desc = event.currentTarget.attributes.getNamedItem("data-desc").value;

            if ($currentGlyph !== newGlyph) {
                $subMenuIcon.removeClass("mega-menu-gplyph-animation");
                $subMenuIcon.attr("class", "glyphicons glyphicon-xlarge glyphicon-top glyphicon-primary  " + newGlyph);
                setTimeout(function() {
                    $subMenuIcon.addClass("mega-menu-gplyph-animation");
                }, 1);
                $currentGlyph = newGlyph;

                $subMenuHeadline.text(headline);
                $subMenuDescription.text(desc);
            }
        });

	}
 
	function open( event ) 
    {
    	$listItems.removeClass( 'mega-menu-open' );
        var $item = $( event.currentTarget ).parent( 'li' );
        $item.addClass( 'mega-menu-open' );
        $body.off( 'click' ).on( 'click', close );
        return false;
    }
 
    function close( event ) 
    {
    	$listItems.removeClass( 'mega-menu-open' );
    }
 
    return { init : init };
 
})();

$(function()
{
	megamenu.init();
});