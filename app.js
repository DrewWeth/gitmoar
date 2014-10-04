
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
var Cookies = require('cookies');
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
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.json());
app.use(express.urlencoded());
app.use(express.methodOverride());
app.use(express.cookieParser('your secret here'));
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
  var cookies = new Cookies( req, res);
  uri = url.parse(req.url);
  var values = qs.parse(uri.query);
  // Check against CSRF attacks
  if (!state || state[1] != values.state) {
    res.writeHead(403, {'Content-Type': 'text/plain'});
    res.end('fail 403');
  } else {
    github.auth.login(values.code, function (err, token) {
      cookies.set('token', token); // write the token as a cookie
      res.writeHead(200, {'Content-Type': 'text/plain'});
      //res.end(token);
      res.end("authenticated!");
    });
  }
});

//test the cookies
app.get('/cookies', function(req, res){
  var cookies = new Cookies( req, res);
  res.setHeader('Content-Type', 'application/json');
  res.writeHead(200, {'Content-Type': 'text/plain'});
  var token = cookies.get("token");
  res.end(token);
});

//Start of GET/POST pages

app.use(function(req, res, next){
  res.status(404);
  // respond with html page
  if (req.accepts('jade')) {
    res.render('404', { url: req.url });
    return;
  }
});

// main logic goes here

app.get('/', function(req, res) {
  var cookies = new Cookies( req, res);
  if (cookies.get("token")){
    console.log("Logged in!");
  } else {
    console.log("Not logged in!");
  }


  res.render('index');
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

