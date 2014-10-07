var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var session = require('express-session');
var querystring = require('querystring');
var bcrypt = require('bcrypt-nodejs');



var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var store = {};

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(session({secret: 'nyan cat'}));

app.use('/create', function(req, res, next){
  var sessionID = querystring.parse(req.headers.cookie)['connect.sid'] || req.sessionID;

  console.log(req.sessionID);
  console.log(store);
  if (store.hasOwnProperty(sessionID)){
    console.log("Already authenticated")
    next();
  } else {
    console.log('Hi. Not authenticated');
    res.render('login');
  }
});

app.get('/',
function(req, res) {
  res.render('index');
});

app.get('/create',
function(req, res) {
  //if authenticated
  res.render('index');
});

app.get('/links',
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links',
function(req, res) {
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

app.post('/login', function(req) {
  var formData = "";
  console.log(req.body);
  var credentials = {};
  credentials.username = req.body.username;
  credentials.password = req.body.password;

  console.log('Credentials: ',credentials);
  db.knex('users').where({
    username: credentials.username,
    password: credentials.password});


  // req.on('data', function(chunk){
  //   console.log('getting data');
  //   formData += chunk;
  //   console.log(formData);
  // });

  // req.on('end', function(){
  //   // var credentials = querystring.parse(formData);
  //   console.log('Credentials: ',credentials);
  //   db.knex(users).where({
  //     username: credentials.username,
  //     password: magicBCrypypHash(credentials.password)
  //   });
  // });
});
/************************************************************/
// Write your authentication routes here
/************************************************************/




// /login
//  // on success, go to links page
//  // on error, issue app.get('/') with an error message (username/password combo is not found)
//
// /signup
//  // provide username & password
//  // 1. check if username already exists
//      // if yes, check if password matches
//        // if passsword matches, log them in, go to links page
//      // if no, issue app.get('/') with an error message (username exists)
//     2. if username does not exist
//      // create an entry in database
//      // encrypt password, etc.
//     3. on success, go to links page (which will be blank)
//
//
// /logout
//





/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
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
