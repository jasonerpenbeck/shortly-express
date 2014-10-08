var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var cookieparser = require('cookie-parser');
var querystring = require('querystring');
var bcrypt = require('bcrypt-nodejs');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');

var app = express();
var validSessions = {};
var SESSIONEXP = 3000000;

var userLoggedIn = function(req, res) {
  console.log((validSessions.hasOwnProperty(req.sessionID) && Date.now() - validSessions[req.sessionID].authDate < SESSIONEXP));
  return (validSessions.hasOwnProperty(req.sessionID) && Date.now() - validSessions[req.sessionID].authDate < SESSIONEXP);
};

var checkUser = function(req, res, next){
  !userLoggedIn(req) ? res.redirect('/login') : next();
};


app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(cookieparser());
app.use(session({secret: 'This should be working.'}));

app.get('/create', checkUser, function(req, res) {
  console.log('user has requested to get "/create"');
  res.render('index');
});

app.get('/', checkUser, function(req, res) {
  console.log('user has requested to get "/"');
  res.render('index');
});

app.get('/links', checkUser, function(req, res) {
  console.log('user has requested to get "/links"');
  console.log('Session ID from request within app.get links: ',req.sessionID);
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', checkUser, function(req, res) {
  var uri = req.body.url;
  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.get('/login', function(req, res) {
  console.log('user has requested to get "/login"');
  res.render('login');
});

app.get('/signup',
function(req, res) {
  console.log('user has requested to get "/signup"');
  res.render('signup');
});

/************************************************************/
// Write your authentication routes here
/************************************************************/
app.get('/logout', function(req, res) {
  console.log('user has requested to get "/logout"');
  req.session.destroy(function(err) {
    console.log('Error: ',err);
  }); // check syntax
  console.log('User is logged out and we are making a new session for her');
  res.redirect('/login');
});


app.post('/signup', function(req, res) {
  console.log('user has requested to post to "/signup"');
  var credentials = {};
  credentials.username = req.body.username;
  credentials.password = req.body.password;

  console.log('Credentials: ',credentials);
  db.knex('users').insert({
    username: credentials.username,
    password: credentials.password,
    created_at: Date.now(),
    updated_at: Date.now()}).then(function(rows) {
      console.log(rows);

      validSessions[req.sessionID] = {
        authDate: Date.now(),
        userID: rows[0].id,
        lastPage: []
      };

      console.log('Session post-signup authentication: ',validSessions[req.sessionID]);
      res.redirect('/');

/*
      console.log('Hi.  You now exist in our database.');
      db.knex.raw('select * from users where id = ?', [newID]).then(function(resp) {
      });
*/
    }).catch(function(error) {
      console.log('Error: ',error);
      res.redirect('/login');
    });
});

app.post('/login', function(req, res) {
  var credentials = {};
  credentials.username = req.body.username;
  credentials.password = req.body.password;

  // Run this to delete all rows from users
  // db.knex('users').del().then(function() {
  //   console.log("Rows have been deleted");
  // });

  // Run this to select all rows from users
  // db.knex('users').select().then(function(allRows) {
  //   console.log(allRows);
  // });

  console.log('Credentials: ',credentials);

  db.knex('users').where({
    username: credentials.username,
    password: credentials.password})
  .then(function(rows) {
    console.log('Rows: ',rows);
    // console.log('Hi. You are authentic.');
    validSessions[req.sessionID] = {
      authDate: Date.now(),
      userID: rows[0].id, // get userID from database query
      lastPage: []
    };
    console.log('ValidSessions: ',validSessions, ' | ', req.sessionID);
    res.redirect('/');
  })
  .catch(function(error) {
    console.log('Error: ',error);
    console.log('Bad log in');
    res.redirect('/login');
  });

});

/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  console.log('Junky URL');
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
