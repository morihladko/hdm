#!/bin/env node
//  OpenShift sample Node application
var express = require('express'),
	fs      = require('fs'),
	mailer  = require('express-mailer'),
	exphbs  = require('express3-handlebars'),
	mongodb = require('mongodb'),
	monk    = require('monk'),
	db      = monk('localhost/aplusr'),
	_		= require('lodash')
	
	TOTAL_SUM = 20000;

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;

    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

	self.getCurrentPosition = function() {
		return Math.min(1.0, self._current_contributions / TOTAL_SUM);
	};

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_NODEJS_IP;
        self.port      = process.env.OPENSHIFT_NODEJS_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_NODEJS_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
    self.cache_get = function(key) { return self.zcache[key]; };


    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

	self.donate = function(req, res, data) {
		var db = req.db,
			donations = db.get('donations');

		donations.insert({
				'name': data.name,
				'email': data.email,
				'contribution': data.contribution
			}, function(err, doc) {
				if (err) {
					res.json({
						'success': false,
						'errors': [err]
					})
					return;
				}

				self._current_contributions += data.contribution;

				self.app.mailer.send({
						template: 'email',
						attachments: [{
							filename: 'blahoprani.pdf',
							filePath: __dirname + '/attachments/jeden_svet.pdf'
						}]
					}, {
						to: data.email,
						subject: 'Hura Do Mexika',

					}, function (err) {
						if (err) {
						  // handle error
							res.json({
								'success': false,
								'errors': [err]
							})
							return;
						}

						res.json({
							'success': true,
							'current_pos': self.getCurrentPosition() 
						});
					} 
				);
			}
		);
	}

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

		self.routes['/donate'] = {
			'post': function(req, res) {
				var errors = [],
					data = _(req.body).pick(['name', 'email']).defaults({'name': '', 'email': '', 'contribution': ''}).valueOf();

				data.contribution = parseInt(req.body.contribution || req.body['contr-other'], 10);
				
				// validation
				_.forEach(data, function(val, key) {
					console.log(key, val);
					if (!val) {
						errors.push('Parameter [' + key + '] is required');
					}
				})
				
				if (!(data.contribution > 0)) {
					errors.push('Contribution has to be positive number');
				}

				if (!errors.length) {
					self.donate(req, res, data);
				} else {
					console.log('wtf');
					res.json({
						'success': false,
						'errors': errors
					});
				}
			}
		};

		self.routes['/current_pos'] = function(req, res) {
			var donations, db = req.db;

			if (_.isUndefined(self._current_contributions)) {
				donations = db.get('donations');

				donations.find().on('success', function(donations) {
					var contributions = _.reduce(donations, function(sum, donation) {
						return sum + donation.contribution;
					}, 0);

					self._current_contributions = contributions;

					res.json(self.getCurrentPosition());
				})
			} else {
				res.json(self._current_contributions / TOTAL_SUM);
			}
		};

		self.routes['/send'] = function(req, res) {
			self.app.mailer.send({
					template: 'email',
					attachments: [{
						filename: 'blahoprani.pdf',
						filePath: __dirname + '/attachments/jeden_svet.pdf'
					}]
				}, {
					to: 'morihladko@gmail.com',
					subject: 'Hola',

				}, function (err) {
					if (err) {
					  // handle error
					  console.log(err);
					  res.send('There was an error sending the email');
					  return;
					}
					res.send('Email Sent');
				} 
			);
		};

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };


    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
		var r, route, m;

        self.createRoutes();
        self.app = express();

		self.app.use('/static', express.static(__dirname + '/static'));
		self.app.set('views', __dirname + '/views');
		self.app.engine('handlebars', exphbs());
		self.app.set('view engine', 'handlebars');

		self.app.use(express.urlencoded());
		self.app.use(express.json());

		self.app.use(function(req, res, next) {
			req.db = db;
			next();
		});

        //  Add handlers for the app (from the routes).
        for (r in self.routes) {
			route = self.routes[r];

			if (typeof route === 'function') {
				self.app.get(r, route);
			} else {
				for (m in route) {
					self.app[m](r, route[m]);
				}
			}
        }
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();

        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });

    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();

mailer.extend(zapp.app, {
	from: 'Atka a Radan <huradomexika@gmail.com>',
	host: 'smtp.gmail.com',
	secureConnection: true,
	port: 465,
	transportMethod: 'SMTP',
	auth: {
		user: 'huradomexika@gmail.com',
		pass: 'atkaaradansaberu'
	}
});

zapp.app.mailer.send({
	template: 'email',
	to: 'morihladko@gmail.com',
	subject: 'Hola',
	attachments: [{
		filename: 'blahoprani.pdf',
		path: __dirname + '/attachments/jeden_svet.pdf'
	}]

},
function (err) {
	if (err) {
	  // handle error
	  console.log(err);
	  res.send('There was an error sending the email');
	  return;
	}
});

zapp.start();
