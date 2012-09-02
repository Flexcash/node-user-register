var config = require("./config.js");
var http = require("http");
var flash = require("connect-flash");
var express = require("express");
var redisStore = require("connect-redis")(express);
var path = require("path");
var mongoose = require("mongoose");
var socketio = require("socket.io");

var accountService = require("./apis/accountService.js");

var passport = require("passport");
var LocalStrategy = require("passport-local").Strategy;

mongoose.connect('mongodb://'+config.mongodb.user+'@'+config.mongodb.host+':'+config.mongodb.port +'/'+config.mongodb.database);

passport.serializeUser(function(user, done) {
  done(null, user._id);
});

passport.deserializeUser(function(id, done) {
  accountService.findUserById(id, function (err, user) {
    done(err, user);
  });
});

passport.use(new LocalStrategy(
  function(username, password, done) {   
        accountService.validatePassword(username, password, function(err, user) {
            if (err) {
              if (err == 1) { return done(null, false, {message: 'Unknown user ' + username}); }
              else if (err == 2) { return done(null, false, {message: 'User is inactive'}); }
              else if (err == 3) { return done(null, false, {message: 'Invalid password'}); }
            }
            else
            {
              return done(null, user)
            }
        });
  }
));

var app = module.exports = express.createServer();
var server = http.createServer(app);

app.configure(function() {
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());

  // Configure session to use Redis as store
 app.use(express.session({store: new redisStore
        , secret: 'secret'
        , key: 'express.sid'}
        ));
 
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(flash());

  app.use(app.router);

  // Serve static files like CSS, JS, ... placed in the folder named 'static'
  app.use("/static", express.static(path.join(__dirname, "static")));

  // Help to debug things
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

  // Set views directory and associated view engine (jade)
  app.set('views', path.join(__dirname, "views"));  
  app.set('view engine', 'jade');
});

var home = require('./routes/homeRoute.js');
var registerRouter = require('./routes/registerRoute.js');
var accountRouter = require('./routes/accountRoute.js');

ensureAuthenticated = function(req, res, next) {
  if (req.isAuthenticated()) {
    return next();
  }
  return res.redirect("/user/login");
};

app.get('/', home.index);

app.get('/user/register', registerRouter.index);
app.get('/user/activate/:activationKey', registerRouter.activate);
app.get('/user/desactivateUser/:activationKey', registerRouter.desactivateUser);
app.get('/users', registerRouter.listUsers);
app.post('/user/register', registerRouter.registerUser);
app.post('/user/activate', registerRouter.activateUser);

app.get('/user/login', function(req, res, next) {
  res.render('signin', {message: req.flash('error')});
});
app.post('/user/login',
 passport.authenticate('local', { failureRedirect: '/user/login', failureFlash: true }),
  function(req, res) {
    accountRouter.login(res, req.user);
  });

app.post('/user/logout', accountRouter.logout);

server.listen(config.node.port);
console.log("NodeJS is listening on http:/"+config.node.host+":"+config.node.port);

var io = socketio.listen(server);
io.set("store", new socketio.RedisStore);

// In this example we have one admin client socket that receives messages from others.

io.sockets.on('connection', function(socket) {
  // Promote this socket as admin
  socket.on(config.monitoring.socketMessage, function() {

    // Save the socket id to Redis so that all processes can access it.
    client.set("adminsocket", socket.id, function(err) {
      if (err) throw err;
      console.log("Admin socket is now" + socket.id);
    });
  });

  socket.on("sendToBAM", function(msg) {

    // Fetch the socket id from Redis
    client.get("adminsocket", function(err, socketId) {
      if (err) throw err;
      io.sockets.socket(socketId).emit(msg);
    });
  });
});
