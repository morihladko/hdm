#!/bin/env node
//  OpenShift sample Node application
var express = require('express'),
	fs      = require('fs'),
	mongodb = require('mongodb'),
	monk    = require('monk'),
	_		= require('lodash'),
	winston = require('winston'),
	request = require('request'),
	
	TOTAL_SUM = 20000;

var logger = new (winston.Logger)({
	transports: [
		new (winston.transports.Console)({'timestamp':true})
	]
});

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
		self.mongo_host = process.env.OPENSHIFT_MONGODB_DB_HOST || 'localhost';
		self.mongo_port = process.env.OPENSHIFT_MONGODB_DB_PORT || 27017;

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
				'contribution': data.contribution,
				'email_sent': false
			}, function(err, doc) {
				if (err) {
					logger.log('error', 'db insert fail', {error: err, data: data});

					res.json({
						'success': false,
						'errors': [err],
					})
					return;
				}

				self._current_contributions += data.contribution;

				_.defer(function() {
					self.sendMail(data.email, function(err) {
						if (err) {
							logger.log('error', 'mail fail for %s, %s', doc.email, doc._id, err);
							return;
						}

						logger.log('info', 'mail sent to %s', doc.email)

						doc.email_sent = true;	
						donations.updateById(doc._id, doc);
					});
				});

				res.json({
					'success': true,
					'current_pos': self.getCurrentPosition(),
					'id': doc._id
				});
			}
		);
	}

	self.sendMail = function(email, callback) {
		request('http://dev.atteq.com/~peter/hdm/send.php?to=' + email, function(error, response, body) {
			if (error) {
				callback(error);
				return;
			};

			if (response.statusCode != 200) {
				callback('Mailer status: ' + response.statusCode);
				return;
			}

			try {
				body = JSON.parse(body);
			} catch (e) {
				callback('Can\'t parse body: ' + body);
				return;
			}

			if (body !== true) {
				callback("Mail server respond: " + JSON.stringify(body));
				return;
			}

			callback()
		});
	}

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

		self.routes['/donate'] = {
			'post': function(req, res) {
				var errors = [],
					data = _(req.body).pick(['name', 'email']).defaults({'name': '', 'email': '', 'contribution': ''}).valueOf();

				data.contribution = parseInt(req.body.contribution || req.body['contr-other'], 10);

				logger.log('info', 'Donation', data);
				
				// validation
				_.forEach(data, function(val, key) {
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
						return donation.contribution ? sum + donation.contribution : sum;
					}, 0);

					self._current_contributions = contributions;

					res.json(self.getCurrentPosition());
				});
			} else {
				res.json(self.getCurrentPosition());
			}
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
		var r, route, m, db;

        self.createRoutes();
        self.app = express();

		self.app.use('/static', express.static(__dirname + '/static'));

		self.app.use(express.urlencoded());
		self.app.use(express.json());

		db = monk('admin:cIKteuAlGtrM@' + self.mongo_host + ':' + self.mongo_port + '/hdm'),

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

zapp.start();
