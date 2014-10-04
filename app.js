
/**
 * Module dependencies.
 */
 var express = require('express');
 var routes = require('./routes');
 var user = require('./routes/user');
 var http = require('http');
 var path = require('path');
 var passport = require('passport');
 var github = require('octonode');
 var qs = require('querystring');
 var url = require('url');
 var engine = require('ejs-locals');
 var fs = require('fs');
 var _ = require('underscore-node');
 var async = require('async');

// Database connection. Modify conString for your own local copy
var conString = "";

// Build the authorization config and url
var auth_url = github.auth.config({
  id: '4ff4888698512a1a4bc7',
  secret: '42cd0241af8d9f6fd548403951c6a4d1f38d4654'
}).login(['user', 'repo', 'gist']);

// Store info to verify against CSRF
var state = auth_url.match(/&state=([0-9a-z]{32})/i);

var app = express();

// all environments
app.set('port', process.env.PORT || 3000);
//Jade stuff
app.set('views', path.join(__dirname, '/views'));
app.set('view engine', 'ejs'); 
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('123'));
app.use(express.session());
app.use(app.router);
app.use(express.static( __dirname + '/public' ));


// Set the directory to get the views to be /views
//app.set('views', __dirname + '/views');

// Use the 'hbs' view engine
//app.set('view engine', 'jade');	//to use hbs instead of jade (cuz i dont wanna learn jade atm)

// Use the express development style logging
app.use(express.logger('dev'));

// Parses request input
app.use(express.bodyParser());

// Does the routing we'll define below!
app.use(app.router);

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

//app.get('/', routes.index);
app.get('/users', user.list);
/*app.post('/login', passport.authenticate('local', {
	successRedirect: '/',
	failureRedirect: '/login',
	failureFlash: true})
);*/

// redirect to github login 
app.get('/login', function(req, res){
  res.writeHead(301, {'Content-Type': 'text/plain', 'Location': auth_url});
  res.end('Redirecting to ' + auth_url);
});

app.get('/auth', function(req, res){
  uri = url.parse(req.url);
  var values = qs.parse(uri.query);
  // Check against CSRF attacks
  if (!state || state[1] != values.state) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('fail 403');
  } else {
    github.auth.login(values.code, function (err, token) {
      req.session.auth_token = token
      res.redirect('/');
    });
  }
});

app.get('/logout', function(req, res){
  req.session.auth_token = null;
  res.redirect('/');
})


//Start of GET/POST pages

app.use(function(req, res, next){
  res.status(404);
  // respond with html page
  if (req.accepts('ejs')) {
    res.render('404', { url: req.url });
    return;
  }
});

// main logic goes here

app.get('/', function(req, res) {
  var inputData = {};
  if (req.session.auth_token){
    console.log("Logged in!");

    var token = req.session.auth_token;
    var client = github.client(token);
    var ghme = client.me();
    var me;
    ghme.info(function(err, data, headers){
      me = data;
      //console.log(me);
    });

    // set up for multiple calls finishing
    var res1, res2, res3, res4, done = 0;

    ghme.followers(function( err, data, headers){
      if(err) handle_data(err, null, null, null, null);
      res1 = data;
      done++;
      if ( done === 4 ) 
        handle_data(null, res1, res2, res3, res4);
    });

    ghme.following(function( err, data, headers){
      if(err) handle_data(err, null, null, null, null);
      res2 = data;
      done++;
      if ( done === 4 ) 
        handle_data(null, res1, res2, res3, res4);
    });

    ghme.starred(function( err, data, headers){
      if(err) handle_data(err, null, null, null, null);
      res3 = data;
      done++;
      if ( done === 4 ) 
        handle_data(null, res1, res2, res3, res4);
    });

    ghme.repos(function( err, data, headers){
      if(err) handle_data(err, null, null, null, null);
      res4 = data;
      done++;
      if ( done === 4 ) 
        handle_data(null, res1, res2, res3, res4);
    });

    function handle_data(err, res1, res2, res3, res4) {
      if(err) {
        console.log("There was an error in the handle_data function");
        console.log(err);
        return;
      } 

      // all the data has finished loading 
      // put it in a thing
      inputData.followers = res1;
      inputData.following = res2;
      inputData.starred = res3;
      inputData.repos = res4;

      fs.writeFile("test.json", JSON.stringify(inputData), function(err, written, buffer){
        if(err) {
          console.log("There was an error in the writing file function");
          console.log(err);
          return;
        } 
      });

      var combined = {};

      for( var i = 0, len = inputData.followers.length; i < len; i++){
        combined[inputData.followers[i].id] = inputData.followers[i];
      }

      for( var i = 0, len = inputData.following.length; i < len; i++){
        combined[inputData.following[i].id] = inputData.following[i];
      }

      var combined_array = [];
      var j = 0;

      for(var key in combined) {
        if(combined.hasOwnProperty(key)) {
          combined_array[j] = combined[key];
          j++;
        }
      }

      //console.log(combined);

      var users_pool = {};

      // get the following of each user in the combined
      // and add them to the users pool
      async.each(combined_array, function(item, callback){
        //console.log(item);
        var ghuser = client.user(item.login);
        ghuser.following(function(err, data, headers){
          if(err) {
            console.log("There was an error in the get followers of followers function");
            console.log(err);
            callback(err);
          } 
          for(var i = 0, len = data.length; i < len; i++) {
            users_pool[data[i].id] = data[i];
          }
          console.log('Do a callback');
          callback();

        });
      }, function(err) {
        console.log("Got all followers");
        //console.log(users_pool);
        //console.log(Object.keys(users_pool).length);
        get_follower_counts();
      });

      var users_pool_array = [];

      function get_follower_counts(){
        
        var j = 0;

        for(var key in users_pool) {
          if(users_pool.hasOwnProperty(key)) {
            users_pool_array[j] = users_pool[key];
            j++;
          }
        }

        async.each(users_pool_array, function(item, callback){

          var ghuser = client.user(item.login);
          ghuser.following(function(err, data, headers){
            var num = data.length;
            item.followers = num;
            callback();
          });

        },function(err){
          console.log("Got all follower counts");
          function compare(a,b) {
            if (a.followers > b.followers)
               return -1;
            if (a.followers < b.followers)
              return 1;
            return 0;
          }

          users_pool_array.sort(compare);
          for ( var i = 0, len = users_pool_array.length; i < len; i++ ) {
            console.log("User: " + users_pool_array[i].login + " followers: " + users_pool_array[i].followers);
          }
          res.render('index', { token: req.session.auth_token, github_data: inputData});

        });
      }
      

    }

  } else 
  {
    res.redirect('/login');

  }

});

app.get('/correlations', function(req,res){
  var token = req.session.auth_token;
   
      res.render('correlations', { token: token})
})

app.get('/connections', function(req, res){
  console.log('What the fuck');
  if (req.session.auth_token == null){
    //console.log("Logged in!");
    console.log("Not logged in!");

    res.render('index', {token: null});

  } else {

    var token = req.session.auth_token;
    var client = github.client(token);
    var ghme = client.me();

    var network = [];
    var repos = [];





    function getRepos(){
      async.each(network, function(data, callback){

        var ghuser = client.user(data["login"]);  
        console.log("Getting data for " + data["login"]);
        ghuser.repos(function(err, data, headers){
          repos.push(data);
          callback();
        });
      }, function(err){
        done();
      });
    }

    function done(){
      console.log('WHAJCBHDJKSCHBSJDKHBCKJSHDBK');
      res.render('connections', { token: token, followers: followers, repos: repos})
    }
  }


});

app.get('/follow', function(req, res){

  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  var token = req.session.auth_token;
  var client = github.client(token);
  var ghme = client.me();
  ghme.follow(query.user);

});

app.get('/star', function(req, res){

  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  var token = req.session.auth_token;
  var client = github.client(token);
  var ghme = client.me();
  ghme.follow(query.repo);
  

});


app.get('/searching', function(req, res) {
  var lname = req.query.search;
  console.log(lname);
  
  res.render('search');
});

app.get('/more', function(req, res){
  var html= '<li class="list-group-item">Name<i class="pull-right fa fa-star"></i></li>';
  res.send(html);
});


app.get('/random', function(req, res){
  res.send('Whee!')
});


app.get('/tables', function(req, res) {
  res.render('tables');
}); 

http.createServer(app).listen(app.get('port'), function(){

  console.log('Express server listening on port ' + app.get('port'));
});

