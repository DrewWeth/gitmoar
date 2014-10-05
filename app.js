
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
  if (req.session.auth_token){
    
    var client = github.client(token);
    var ghme = client.me();
    var repos = [];
    var me = null;
    readmes = [];

    ghme.info(function(err, data, headers){
      me = data;
      res.render('index', { token: req.session.auth_token, me: me});
    });
  } else 
  {
    res.redirect('/login');

  }

});

function mode(readsmes)
{
  if(readmes.length == 0)
    return null;
  var modeMap = {};
  var maxEl = readmes[0], maxCount = 1;
  for(var i = 0; i < readmes.length; i++)
  {
    var el = readmes[i];
    if(modeMap[el] == null)
      modeMap[el.language] = 1;
    else
      modeMap[el.language]++;  
    if(modeMap[el.language] > maxCount)
    {
      maxEl = el;
      maxCount = modeMap[el.language];
    }
  }
  return maxEl.language;
}


app.get('/correlations', function(req,res){
  var token = req.session.auth_token;
  
  var client = github.client(token);
  var ghme = client.me();
  var repos = [];
  var me = null;
  readmes = [];

  ghme.info(function(err, data, headers){
    me = data;
    ghme.repos(function(err, data, headers){
      repos = data;
      async.each(repos, function(repo, callback){
        var ghrepo = client.repo(repo["full_name"]); 
        ghrepo.readme(function(err, data, headers){
          if (data)
          {
            var b = new Buffer(data["content"], 'base64');
            labels = repo["language"];
            var obj = {
              name: repo["full_name"],
              language: repo["language"],
              content: b.toString(),
              labels: labels
            };
            readmes.push(obj);
          }
          callback();
        }); //file
      }, function(){
          var ghsearch = client.search();
          language_mode = mode(readmes);
          console.log("LANGUAGE MODE: " + language_mode);
          ghsearch.repos({
            q: 'language:' + language_mode,
            sort: 'stargazers_count',
            order: 'asc'
          }, function(err, data, headers){
            res.render('correlations', { token: token, readmes: readmes, repos: repos, interests: data["items"]});
          }); //array of search results
        });
      });
  });
});

app.get('/d3', function(req, res){

   //console.log('What the fuck');
  if (req.session.auth_token == null){
    //console.log("Logged in!");
    console.log("Not logged in!");

    res.render('index', {token: null});

  } else {

    var token = req.session.auth_token;
    var client = github.client(token);
    var ghme = client.me();

    var network = [];
    var new_network = [];
    var repos = [];
    var seen = {}; // track who we have seen already
    
    var me;
    // get self info so we don't have ourselves in the newtwork later
    ghme.info(function(err, data, headers){
      me = data;
      seen[me.id] = true;
    });

    getFirstLayer();

    function getFirstLayer(){

      var followers, following, done = 0;

      ghme.followers(function( err, data, headers){
        if(err) addFirstLayer(err, null, null);
        followers = data;
        done++;
        if ( done === 2 ) 
          addFirstLayer(null, followers, following);
      });

      ghme.following(function( err, data, headers){
        if(err) addFirstLayer(err, null, null);
        following = data;
        done++;
        if ( done === 2 ) 
          addFirstLayer(null, followers, following);
      });

      function addFirstLayer(err, followers, following){

        var combined = {};

        for( var i = 0, len = followers.length; i < len; i++){
          combined[followers[i].id] = followers[i];
        }

        for( var i = 0, len = following.length; i < len; i++){
          combined[following[i].id] = following[i];
        }

        var j = 0;

        for(var key in combined) {
          if(combined.hasOwnProperty(key)) {
            seen[key] = true;
            network[j] = combined[key];
            network[j].layer = 1;
            j++;
          }
        }

        getSecondLayer();

      }

    }

    var iter = 0;

    function getSecondLayer(){

      async.each(network, function(item, callback){
        //console.log("Item login: " + item.login);
        var ghuser = client.user(item.login);
        ghuser.following(function(err, data, headers){
            if(err) {
              console.log("There was an error in the getSecondLayer function");
              console.log(err);
              return;
            } 
           // console.log(data.login);
           for( var i = 0, len = data.length; i < len; i++) {
              if(!seen[data[i].id]) {
                data[i].layer = 2;
                new_network.push(data[i]);
                seen[data[i].id] = true;
               // console.log("A NEW THING: " + data[i].login);
              } else {
                //console.log("I SEEN'T IT!");
              }
          }
          iter++;
          //console.log(iter);
          console.log("New Network length: " + new_network.length);
          callback();
        });
        //callback();
      }, function(err){
        console.log("New Network size " + new_network.length);
        processNetwork();
      });

    }

    function processNetwork(){
      async.parallel([
        function(callback) {
          getFollowerCounts(callback);
        },
        function(callback) {
          console.log("new net count followers");
          getNewFollowerCounts(callback);
        },
        function(callback){
          getRepos(callback);
        }],
      function(err) {
        done();
      });
    }

    function getFollowerCounts(callback){

      console.log(network.length);

      async.each(network, function(item, callback1){
        var ghuser = client.user(item.login);
        ghuser.followers(function(err, data, headers){
            if(err) {
              console.log("There was an error in the getFollowerCounts function");
              console.log(err);
              return;
            } 
            var num = data.length;
            item.followers = num;
            console.log(item.login + " has " + num + " followers");
            callback1();
        });

      }, function(err){
        callback();
      });

    }

    function getNewFollowerCounts(callback){

      console.log("Get follower count new network length: " + new_network.length);

      async.each(new_network, function(item, callback1){
        var ghuser = client.user(item.login);
        ghuser.followers(function(err, data, headers){
            if(err) {
              console.log("There was an error in the getFollowerCounts function");
              console.log(err);
              return;
            } 
            var num = data.length;
            item.followers = num;
            console.log(item.login + " has " + num + " followers");
            callback1();
        });

      }, function(err){
        callback();
      });

    }



    function getRepos(callback){
      async.each(network, function(data, callback1){

        // TODO: only get repos from layer 1

        var ghuser = client.user(data["login"]);  
        console.log("Getting data for " + data["login"]);
        ghuser.repos(function(err, data, headers){
          repos.push(data);
          callback1();
        });
      }, function(err){
        callback();
      });
    }

    function done(){
      console.log('Finished!');
      console.log("Network length: " + network.length);
      res.setHeader('Content-Type', 'application/json');
      network.push.apply(network, new_network);
      res.end(JSON.stringify(network));
    }
  }


});

app.get('/connections', function(req, res){
  //console.log('What the fuck');
  if (req.session.auth_token == null){
    //console.log("Logged in!");
    console.log("Not logged in!");

    res.render('index', {token: null});

  } else {

    var token = req.session.auth_token;
    var client = github.client(token);
    var ghme = client.me();

    var network = [];
    var new_network = [];
    var repos = [];
    var seen = {}; // track who we have seen already
    
    var me;
    // get self info so we don't have ourselves in the newtwork later
    ghme.info(function(err, data, headers){
      me = data;
      seen[me.id] = true;
    });

   // getFirstLayer();
   done();

    function getFirstLayer(){

      var followers, following, done = 0;

      ghme.followers(function( err, data, headers){
        if(err) addFirstLayer(err, null, null);
        followers = data;
        done++;
        if ( done === 2 ) 
          addFirstLayer(null, followers, following);
      });

      ghme.following(function( err, data, headers){
        if(err) addFirstLayer(err, null, null);
        following = data;
        done++;
        if ( done === 2 ) 
          addFirstLayer(null, followers, following);
      });

      function addFirstLayer(err, followers, following){

        // deduplication logic

        //console.log("Followers: " + followers);
        //console.log("Following: " + following);

        var combined = {};

        for( var i = 0, len = followers.length; i < len; i++){
          combined[followers[i].id] = followers[i];
        }

        for( var i = 0, len = following.length; i < len; i++){
          combined[following[i].id] = following[i];
        }

        var j = 0;

        for(var key in combined) {
          if(combined.hasOwnProperty(key)) {
            seen[key] = true;
            network[j] = combined[key];
            network[j].layer = 1;
            j++;
          }
        }

        getSecondLayer();

      }

    }

    var iter = 0;

    function getSecondLayer(){

      async.each(network, function(item, callback){
        //console.log("Item login: " + item.login);
        var ghuser = client.user(item.login);
        ghuser.following(function(err, data, headers){
            if(err) {
              console.log("There was an error in the getSecondLayer function");
              console.log(err);
              return;
            } 
           // console.log(data.login);
           for( var i = 0, len = data.length; i < len; i++) {
              if(!seen[data[i].id]) {
                data[i].layer = 2;
                new_network.push(data[i]);
                seen[data[i].id] = true;
               // console.log("A NEW THING: " + data[i].login);
              } else {
                //console.log("I SEEN'T IT!");
              }
          }
          iter++;
          //console.log(iter);
          console.log("New Network length: " + new_network.length);
          callback();
        });
        //callback();
      }, function(err){
        console.log("New Network size " + new_network.length);
        processNetwork();
      });

    }

    function processNetwork(){
      async.parallel([
        function(callback) {
          getFollowerCounts(callback);
        },
        function(callback) {
          console.log("new net count followers");
          getNewFollowerCounts(callback);
        },
        function(callback){
          getRepos(callback);
        }],
      function(err) {
        done();
      });
    }

    function getFollowerCounts(callback){

      console.log(network.length);

      async.each(network, function(item, callback1){
        var ghuser = client.user(item.login);
        ghuser.followers(function(err, data, headers){
            if(err) {
              console.log("There was an error in the getFollowerCounts function");
              console.log(err);
              return;
            } 
            var num = data.length;
            item.followers = num;
            console.log(item.login + " has " + num + " followers");
            callback1();
        });

      }, function(err){
        callback();
      });

    }

    function getNewFollowerCounts(callback){

      console.log("Get follower count new network length: " + new_network.length);

      async.each(new_network, function(item, callback1){
        var ghuser = client.user(item.login);
        ghuser.followers(function(err, data, headers){
            if(err) {
              console.log("There was an error in the getFollowerCounts function");
              console.log(err);
              return;
            } 
            var num = data.length;
            item.followers = num;
            console.log(item.login + " has " + num + " followers");
            callback1();
        });

      }, function(err){
        callback();
      });

    }



    function getRepos(callback){
      async.each(network, function(data, callback1){

        // TODO: only get repos from layer 1

        var ghuser = client.user(data["login"]);  
        console.log("Getting data for " + data["login"]);
        ghuser.repos(function(err, data, headers){
          repos.push(data);
          callback1();
        });
      }, function(err){
        callback();
      });
    }

    function done(){
      console.log('Finished!');
      console.log("Network length: " + network.length);
      res.render('connections', { token: token, network1: network, network2: new_network, repos: repos});
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
  res.end();

});

app.get('/star', function(req, res){

  var url_parts = url.parse(req.url, true);
  var query = url_parts.query;
  var token = req.session.auth_token;
  var client = github.client(token);
  var ghme = client.me();
  console.log(query.repo);
  ghme.star(query.repo);
  res.end();

});


app.get('/search', function(req, res) {
  var query_str = req.query.q;
  
  var token = req.session.auth_token;
  var client = github.client(token);
  var ghsearch = client.search();
  console.log('first');  
  repos =[];
  users = [];
  
  ghsearch.users({
    q: query_str,
    sort: 'created',
    order: 'asc'
  },1, function(err, data, headers){
    users = data;
    ghsearch.repos({
      q: query_str,
      sort: 'stargazers_count',
      order: 'asc'
    }, function(err, data, headers){
      repos = data;
      res.render('search', { results: users["items"], repos: repos["items"] });
    });
  }); //array of search results
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

