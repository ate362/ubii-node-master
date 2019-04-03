const {Service} = require('./service.js');
const { DEFAULT_TOPICS } = require('@tum-far/ubii-msg-formats');

class ServerConfigService extends Service {
  constructor(id, name, host, connectionManager) {
    super(DEFAULT_TOPICS.SERVICES.SERVER_CONFIG);

    this.id = id;
    this.name = name;
    this.serverHost = host;
    this.connectionManager = connectionManager;
  }

  reply() {
    return {
      server: {
        id: this.id,
        name: this.name,
        ip: this.serverHost,
        portServiceZmq: this.connectionManager.ports.serviceZMQ.toString(),
        portServiceRest: this.connectionManager.ports.serviceREST.toString(),
        portTopicDataZmq: this.connectionManager.ports.topicDataZMQ.toString(),
        portTopicDataWs: this.connectionManager.ports.topicDataWS.toString(),
      }
    };
  }
}

module.exports = {
  'ServerConfigService': ServerConfigService,
};