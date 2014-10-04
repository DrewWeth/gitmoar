function search(){
 $('#search').on('keyup', function(e){
   if(e.keyCode === 13) {
     var parameters = { search: $(this).val() };
     $.get(
     	"/searching",
     	parameters
     );
    };
 });
};