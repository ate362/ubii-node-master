const EventEmitter = require('events');
const { v4: uuidv4 } = require('uuid');

const { proto, ProtobufTranslator, MSG_TYPES } = require('@tum-far/ubii-msg-formats');
const SessionStatus = proto.ubii.sessions.SessionStatus;
const namida = require('@tum-far/namida');
const { ProcessingModuleManager } = require('@tum-far/ubii-node-nodejs/src/index');

const { ClientManager } = require('../clients/clientManager');
const { DeviceManager } = require('../devices/deviceManager');

class Session extends EventEmitter {
  constructor(specs = {}, masterNodeID, topicData, processingModuleManager) {
    super();

    // take over specs
    specs && Object.assign(this, JSON.parse(JSON.stringify(specs)));
    // new instance is getting new ID
    this.id = uuidv4();
    this.processingModules = this.processingModules || [];
    this.ioMappings = this.ioMappings || [];

    this.masterNodeID = masterNodeID;
    this.topicData = topicData;
    this.processingModuleManager = processingModuleManager;

    this.lockstepPMs = new Map();
    this.localPMs = [];
    this.remotePMs = new Map();

    this.initialize();

    this.status = SessionStatus.CREATED;

    this.translatorProtobuf = new ProtobufTranslator(MSG_TYPES.SESSION);
  }

  initialize() {
    // setup for processing modules
    for (let pmSpec of this.processingModules) {
      pmSpec.sessionId = this.id;
      // if PM isn't assigned to run on a particular node, assign one (preferably dedicated processing node)
      //TODO: check if dedicated processing nodes are available to run it (requires load balancing and communication)
      if (!pmSpec.nodeId) {
        let processingNodeIDs = ClientManager.instance.getNodeIDsForProcessingModule(pmSpec);
        if (processingNodeIDs.length > 0) {
          //TODO: some more sophisticated load assessment for each processing node
          // nodes reporting metrics on open resources
          pmSpec.nodeId = processingNodeIDs[0];
        } else {
          pmSpec.nodeId = this.masterNodeID;
        }
      }

      // should PM run on this node?
      if (pmSpec.nodeId === this.masterNodeID) {
        let pm = this.processingModuleManager.getModuleBySpecs(pmSpec, this.id);
        if (!pm) {
          pm = this.processingModuleManager.createModule(pmSpec);
        }
        if (pm) {
          pmSpec.id = pm.id;
          this.localPMs.push(pmSpec);
        } else {
          namida.logFailure(
            this.toString(),
            'could not instantiate processing module ' + pmSpec.name
          );
          return false;
        }
      }
      //PM should run on a different node, group PMs by node ID they're running on
      else {
        if (!this.remotePMs.has(pmSpec.nodeId)) {
          this.remotePMs.set(pmSpec.nodeId, []);
        }
        pmSpec.id = uuidv4(); // assign ID to PM spec before starting remotely
        this.remotePMs.get(pmSpec.nodeId).push(pmSpec);
      }

      // fill out ID for I/O mapping for this PM
      // if multiple PMs specified within this session have the same name referenced by the mapping and no specific ID is given by the mapping,
      // it is assumed it doesn't matter which PM receives which I/O mapping as they're all instances of the same PM
      let ioMapping = this.ioMappings.find(
        (mapping) => !mapping.processingModuleId && mapping.processingModuleName === pmSpec.name
      );
      if (ioMapping) {
        ioMapping.processingModuleId = pmSpec.id;

        for (let inputMapping of ioMapping.inputMappings) {
          if (inputMapping.topicMux) {
            inputMapping.topicMux.id = uuidv4();
          }
        }

        for (let outputMapping of ioMapping.outputMappings) {
          if (outputMapping.topicDemux) {
            outputMapping.topicDemux.id = uuidv4();
          }
        }
      }

      // gather PMs running in lockstep, group PMs by node ID they're running on
      if (pmSpec.processingMode && pmSpec.processingMode.lockstep) {
        if (!this.lockstepPMs.has(pmSpec.nodeId)) {
          this.lockstepPMs.set(pmSpec.nodeId, []);
        }
        this.lockstepPMs.get(pmSpec.nodeId).push(pmSpec);
      }
    }

    this.processingModuleManager.applyIOMappings(this.ioMappings, this.id);
  }

  start() {
    if (this.status === SessionStatus.RUNNING) {
      namida.logFailure('Session ' + this.id, "can't be started again, already running");
      this.emit(Session.EVENTS.START_FAILURE);
      return;
    }

    if (!this.processingModules || this.processingModules.length === 0) {
      namida.logFailure('Session ' + this.id, 'session has no processing modules to start');
      this.emit(Session.EVENTS.START_FAILURE);
      return;
    }

    // listen for events to check if all PMs have been started
    this.onProcessingModuleStartedListener = this.onProcessingModuleStarted.bind(this);
    this.processingModuleManager.addListener(
      ProcessingModuleManager.EVENTS.PM_STARTED,
      this.onProcessingModuleStartedListener
    );

    this.pmsAwaitingStart = [];
    this.localPMs.forEach((localPM) => {
      this.pmsAwaitingStart.push(localPM);
    });
    this.remotePMs.forEach((nodePMs) => {
      this.pmsAwaitingStart.push(...nodePMs);
    });

    // start local processing modules
    this.localPMs.forEach(async (pmSpec) => {
      await this.processingModuleManager.startModule(pmSpec);
    });

    this.timeoutStartPMs = setTimeout(() => {
      if (this.pmsAwaitingStart.length > 0) {
        this.startDone(false);
      }
    }, Session.CONSTANTS.TIMEOUT_START_PMS);


    /// ### old

    // start processing modules
    /*this.localPMs.forEach(async (pmSpec) => {
      let pm = this.processingModuleManager.getModuleByID(pmSpec.id);
      await pm.initialized;
      let success = pm.start();
      if (success) {
        this.processingModuleManager.emit(ProcessingModuleManager.EVENTS.PM_STARTED, pm);
      }
    });

    if (this.remotePMs.size > 0) {
      this.onProcessingModuleStartedListener = this.onProcessingModuleStarted.bind(this);
      this.processingModuleManager.addListener(
        ProcessingModuleManager.EVENTS.PM_STARTED,
        this.onProcessingModuleStartedListener
      );

      this.pmsAwaitingRemoteStart = [];
      this.remotePMs.forEach((nodePMs) => {
        this.pmsAwaitingRemoteStart.push(...nodePMs);
      });

      this.timeoutStartRemotePMs = setTimeout(() => {
        if (this.pmsAwaitingRemoteStart.length > 0) {
          this.startDone(false);
        }
      }, Session.CONSTANTS.TIMEOUT_START_REMOTE_PMS);
    } else {
      this.startDone(true);
    }

    // start lockstep cycles
    this.tLastLockstepPass = Date.now();
    this.lockstepProcessingPass();*/

    return;
  }

  onProcessingModuleStarted(pmSpec) {
    let index = this.pmsAwaitingStart.findIndex(
      (pm) => pm.sessionId === this.id && pm.id === pmSpec.id
    );
    if (index !== -1) {
      this.pmsAwaitingStart.splice(index, 1);
    }

    if (this.pmsAwaitingStart.length === 0) {
      namida.logSuccess(this.toString(), 'all PMs started');
      this.startDone(true);
    }
  }

  startDone(success) {
    this.timeoutStartPMs && clearTimeout(this.timeoutStartPMs);

    if (success) {
      this.status = SessionStatus.RUNNING;
      this.emit(Session.EVENTS.START_SUCCESS);
    } else {
      this.emit(Session.EVENTS.START_FAILURE, this.pmsAwaitingStart);
    }
  }

  stop() {
    if (this.status !== SessionStatus.RUNNING) {
      return false;
    }

    if (this.onProcessingModuleStartedListener) {
      this.processingModuleManager.removeListener(
        ProcessingModuleManager.EVENTS.PM_STARTED,
        this.onProcessingModuleStartedListener
      );
    }

    this.onProcessingModuleStoppedListener = this.onProcessingModuleStopped.bind(this);
    this.processingModuleManager.addListener(
      ProcessingModuleManager.EVENTS.PM_STOPPED,
      this.onProcessingModuleStoppedListener
    );

    this.pmsAwaitingStop = [];
    this.localPMs.forEach((localPM) => {
      this.pmsAwaitingStop.push(localPM);
    });
    this.remotePMs.forEach((nodePMs) => {
      this.pmsAwaitingStop.push(...nodePMs);
    });

    for (let localPM of this.localPMs) {
      this.processingModuleManager.stopModule(localPM);
    }

    this.timeoutStopPMs = setTimeout(() => {
      let success = true;
      if (this.pmsAwaitingStop.length > 0) {
        success = false;
      }
      this.stopDone(success);
    }, Session.CONSTANTS.TIMEOUT_STOP_PMS);

    // old

    /*for (let processingModule of this.localPMs) {
      this.processingModuleManager.getModuleByID(processingModule.id).stop();
    }

    if (this.remotePMs.size > 0) {
      this.onProcessingModuleStoppedListener = this.onProcessingModuleStopped.bind(this);
      this.processingModuleManager.addListener(
        ProcessingModuleManager.EVENTS.PM_STOPPED,
        this.onProcessingModuleStoppedListener
      );

      this.pmsAwaitingRemoteStop = [];
      this.remotePMs.forEach((nodePMs) => {
        this.pmsAwaitingRemoteStop.push(...nodePMs);
      });

      this.timeoutStopRemotePMs = setTimeout(() => {
        let success = true;
        if (this.pmsAwaitingRemoteStop.length > 0) {
          success = false;
        }
        this.stopDone(success);
      }, Session.CONSTANTS.TIMEOUT_STOP_PMS);
    } else {
      this.stopDone(true);
    }*/

    return true;
  }

  onProcessingModuleStopped(pmSpec) {
    let index = this.pmsAwaitingStop.findIndex(
      (pm) => pm.sessionId === this.id && pm.id === pmSpec.id
    );
    if (index !== -1) {
      this.pmsAwaitingStop.splice(index, 1);
    }

    if (this.pmsAwaitingStop.length === 0) {
      namida.logSuccess(this.toString(), 'all PMs stopped');
      this.stopDone(true);
    }
  }

  stopDone(success) {
    this.timeoutStopPMs && clearTimeout(this.timeoutStopPMs);

    if (success) {
      this.status = SessionStatus.STOPPED;
      this.lockstepPMs = new Map();
      this.localPMs = [];
      this.remotePMs = new Map();
      this.emit(Session.EVENTS.STOP_SUCCESS);
    } else {
      this.emit(Session.EVENTS.STOP_FAILURE, this.pmsAwaitingStop);
    }

    if (this.onProcessingModuleStoppedListener) {
      this.processingModuleManager.removeListener(
        ProcessingModuleManager.EVENTS.PM_STOPPED,
        this.onProcessingModuleStoppedListener
      );
    }
  }

  lockstepProcessingPass() {
    // timing
    let tNow = Date.now();
    let deltaTime = tNow - this.tLastLockstepPass;
    this.tLastLockstepPass = tNow;

    // gather inputs
    let processingPromises = [];
    this.lockstepPMs.forEach((pms, clientID) => {
      // one request per client
      let lockstepProcessingRequest = {
        processingModuleIds: [],
        records: [],
        deltaTimeMs: deltaTime
      };

      pms.forEach((pm) => {
        lockstepProcessingRequest.processingModuleIds.push(pm.id);

        // gather inputs for all PMs running under client ID
        let inputMappings = this.ioMappings.find(
          (element) => element.processingModuleId === pm.id
        ).inputMappings;
        if (inputMappings) {
          pm.inputs.forEach((input) => {
            let inputMapping = inputMappings.find(
              (element) => element.inputName === input.internalName
            );
            let topicSource = inputMapping[inputMapping.topicSource] || inputMapping.topicSource;
            // single topic input
            if (typeof topicSource === 'string') {
              let topicdataEntry = this.topicData.pull(topicSource);
              let record = { topic: topicSource };
              record.type = topicdataEntry.type;
              record[topicdataEntry.type] = topicdataEntry.data;
              lockstepProcessingRequest.records.push(record);
            }
            // topic muxer input
            else if (typeof topicSource === 'object') {
              let records = DeviceManager.instance.getTopicMux(topicSource.id).get();
              lockstepProcessingRequest.records.push(...records);
            }
          });
        }
      });

      // send out request, save promise
      processingPromises.push(
        this.processingModuleManager
          .sendLockstepProcessingRequest(clientID, lockstepProcessingRequest)
          .then((lockstepProcessingReply) => {
            // sanity check making sure all PMs were included
            let allProcessingModulesReplied = lockstepProcessingRequest.processingModuleIds.every(
              (id) => lockstepProcessingReply.processingModuleIds.includes(id)
            );
            if (!allProcessingModulesReplied) {
              let missingIDs = lockstepProcessingRequest.processingModuleIds.filter(
                (id) => !lockstepProcessingReply.processingModuleIds.includes(id)
              );
              let message = 'not all ProcessingModules replied during lockstep pass, missing are:';
              missingIDs.forEach((id) => {
                let pm = this.processingModuleManager.getModuleByID(id);
                message += '\n' + pm.toString();
              });
              namida.logFailure(this.toString(), message);
            }

            // publish received records to topicdata
            lockstepProcessingReply.records.forEach((record) => {
              this.topicData.publish(record.topic, record);
            });
          })
      );
    });

    Promise.all(processingPromises).then(() => {
      setImmediate(() => {
        this.lockstepProcessingPass();
      });
    });
  }

  toProtobuf() {
    //return this.translatorProtobuf.proto.fromObject(this);

    return {
      id: this.id,
      name: this.name,
      tags: this.tags,
      description: this.description,
      authors: this.authors,
      status: this.status,
      processingModules: this.processingModules,
      ioMappings: this.ioMappings,
      editable: this.editable
    };
  }

  toString() {
    return 'Session ' + this.name + ' (ID ' + this.id + ')';
  }
}

Session.CONSTANTS = Object.freeze({
  TIMEOUT_START_PMS: 10000,
  TIMEOUT_STOP_PMS: 10000
});

Session.EVENTS = Object.freeze({
  START_SUCCESS: 0,
  START_FAILURE: 1,
  STOP_SUCCESS: 2,
  STOP_FAILURE: 3
});

module.exports = { Session };
