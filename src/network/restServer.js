const express = require('express');
const http = require('http');
const https = require('https');
const bodyParser = require('body-parser');
const fs = require('fs');

const NetworkConfigManager = require('./networkConfigManager');

class RESTServer {
  /**
   * Communication endpoint implementing the zmq reply pattern.
   * @param {*} port Port to bind.
   * @param {*} autoBind Should the socket bind directly after the initialization of the object?
   * If not, the start method must be called manually.
   */
  constructor(port = 5555, useHTTPS = true, autoBind = true) {
    this.port = port;
    this.useHTTPS = useHTTPS;

    let ipLan = NetworkConfigManager.hostAdresses.ethernet;
    let ipWifi = NetworkConfigManager.hostAdresses.wifi;
    if (this.useHTTPS) {
      this.allowedOrigins = [
        'https://' + ipLan + ':12345',
        'https://' + ipWifi + ':12345',
        'https://localhost:12345'
      ];
    } else {
      this.allowedOrigins = [
        'http://' + ipLan + ':8080',
        'http://' + ipLan + ':8081',
        'http://' + ipWifi + ':8080',
        'http://' + ipWifi + ':8081',
        'http://localhost:8080',
        'http://localhost:8081'
      ];
    }

    if (autoBind) {
      this.start();
    }
  }

  start() {
    // init
    this.app = express();

    if (this.useHTTPS) {
      var credentials = {
        //ca: [fs.readFileSync(PATH_TO_BUNDLE_CERT_1), fs.readFileSync(PATH_TO_BUNDLE_CERT_2)],
        cert: fs.readFileSync('./certificates/ubii.com+5.pem'),
        key: fs.readFileSync('./certificates/ubii.com+5-key.pem')
      };
      this.server = https.createServer(credentials, this.app);
    } else {
      this.server = http.createServer(this.app);
    }

    // CORS
    this.app.use((req, res, next) => {
      let validOrigin = this.allowedOrigins.find(element => element === req.headers.origin);
      res.header('Access-Control-Allow-Origin', validOrigin);
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');

      next();
    });

    this.app.use(bodyParser.urlencoded({ extended: true }));

    // VARIANT A: PROTOBUF
    /*this.app.use(bodyParser.raw({
      type: 'application/octet-stream',
      limit: '10mb'
    }));*/

    /// VARIANT B: JSON
    this.app.use(bodyParser.json());

    this.server.listen(this.port, () => {
      console.info('[' + new Date() + '] REST Service connection: Listening on *:' + this.port);
    });
  }

  stop() {
    this.server.close();
  }

  setRoutePOST(route, callback) {
    this.app.post(route, callback);
  }
}

module.exports = RESTServer;
