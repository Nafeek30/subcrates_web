$( document ).ready(function() {
	jQuery("#accordion .card-link").on("click", function(){
	    if(jQuery(this).hasClass("active")){
	        jQuery(this).removeClass("active");
	        jQuery("#accordion .card-link").removeClass("active");
	    }
	    else{
	    	jQuery("#accordion .card-link").removeClass("active");
	        jQuery(this).addClass("active");
	    }
	});
});