
$(window).scroll(function() {
	if($(window).scrollTop() + $(window).height() == $(document).height()) {
			$.ajax({
				type: "get",
				url: "http://localhost:3000/more"
			})
			.done(function( msg ) {
				$('#cool-cats').append(msg);
			});
		
	}
});

