
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
var fs = require("fs");
var engine = require('ejs-locals');
//var less = require('less');

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
    //console.log("Logged in!");

    var token = req.session.auth_token;
    var client = github.client(token);
    var ghme = client.me();

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
        return;
      } 

      // all the data has finished loading 
      // put it in a thing
      inputData.followers = res1;
      inputData.following = res2;
      inputData.starred = res3;
      inputData.repos = res4;

      console.log(res1);
      console.log(res2);
      console.log(res3);
      console.log(res4);
      
      res.render('index', { token: req.session.auth_token, github_data: inputData});

    }

  } else {
    console.log("Not logged in!");
    res.render('index', {token: null});

  }

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

