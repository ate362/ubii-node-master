const fs = require('fs');

const {
  DEFAULT_PORT_SERVICE_ZMQ,
  DEFAULT_PORT_SERVICE_REST,
  DEFAULT_PORT_TOPICDATA_ZMQ,
  DEFAULT_PORT_TOPICDATA_WS,
  DEFAULT_USE_HTTPS
} = require('../network/constants');

class ConfigService {
  constructor() {
    this.config = JSON.parse(fs.readFileSync('./config.json'));
  }

  useHTTPS() {
    return typeof this.config.useHTTPS !== 'undefined' ? this.config.useHTTPS : DEFAULT_USE_HTTPS;
  }

  getPortServiceZMQ() {
    return typeof this.config.ports.serviceZMQ !== 'undefined'
      ? this.config.ports.serviceZMQ
      : DEFAULT_PORT_SERVICE_ZMQ;
  }

  getPortServiceREST() {
    return typeof this.config.ports.serviceREST !== 'undefined'
      ? this.config.ports.serviceREST
      : DEFAULT_PORT_SERVICE_REST;
  }

  getPortTopicdataZMQ() {
    return typeof this.config.ports.topicdataZMQ !== 'undefined'
      ? this.config.ports.topicdataZMQ
      : DEFAULT_PORT_TOPICDATA_ZMQ;
  }

  getPortTopicdataWS() {
    return typeof this.config.ports.topicdataWS !== 'undefined'
      ? this.config.ports.topicdataWS
      : DEFAULT_PORT_TOPICDATA_WS;
  }
}

module.exports = new ConfigService();
