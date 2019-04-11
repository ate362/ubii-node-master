const fs = require('fs');
const shelljs = require('shelljs');

const {ProtobufTranslator, MSG_TYPES} = require('@tum-far/ubii-msg-formats');

const {Interaction} = require('../sessions/interaction');
const {BASE_FOLDER_DB} = require('./storageConstants');


class InteractionDatabase {
  constructor() {
    this.directory = BASE_FOLDER_DB + '/interactions';
    if (!fs.existsSync(this.directory)) {
      shelljs.mkdir('-p', this.directory);
    }

    this.interactionSpecs = new Map();
    this.interactionFilepaths = new Map();

    this.loadInteractionFiles();
  }

  getInteraction(id) {
    return this.interactionSpecs.get(id);
  }

  getInteractionList() {
    return Array.from(this.interactionSpecs.values());
  }

  registerInteraction(specs) {
    console.info('registerInteraction');
    if (this.interactionSpecs.has(specs.id)) {
      throw 'Interaction with ID ' + specs.id + ' could not be registered, ID already exists'
    }

    if (!this.verifySpecification(specs)) {
      throw 'Interaction with ID ' + specs.id + ' could not be registered, invalid specs'
    }

    try {
      let interaction = new Interaction(specs);
      let interactionSpecs = interaction.toProtobuf();
      this.interactionSpecs.set(interactionSpecs.id, interactionSpecs);
      console.info('registerInteraction - before saveInteractionSpecsToFile')
      this.saveInteractionSpecsToFile(interactionSpecs);
    } catch (error) {
      throw error;
    }

    return interaction;
  }

  deleteInteraction(id) {
    try {
      this.interactionSpecs.delete(id);
      this.deleteInteractionFile(id);
    } catch (error) {
      throw error;
    }
  }

  updateInteractionSpecs(specs) {
    console.info('updateInteractionSpecs');
    if (!this.verifySpecification(specs)) {
      throw 'interaction specification could not be verified';
    }

    let interaction = this.interactionSpecs.get(specs.id);
    if (typeof interaction === 'undefined') {
      throw 'interaction with ID ' + specs.id + ' could not be found';
    }

    try {
      this.interactionSpecs.set(specs.id, specs);
      this.deleteInteractionFile(specs.id);
      this.saveInteractionSpecsToFile(specs);
    } catch (error) {
      throw error;
    }
  }

  loadInteractionFiles() {
    fs.readdir(this.directory, (err, files) => {
      if (err) {
        return console.info('InteractionDatabase - Unable to scan directory: ' + err);
      }

      files.forEach((file) => {
        this.loadInteractionSpecsFromFile(this.directory + '/' + file);
      });
    });
  }

  loadInteractionSpecsFromFile(path) {
    fs.readFile(path, (err, data) => {
      if (err) throw err;

      let specs = JSON.parse(data);

      if (this.interactionSpecs.has(specs.id)) {
        console.info('InteractionDatabase - interaction from file ' + path + ' has conflicting ID ' + specs.id);
      } else {
        this.interactionSpecs.set(specs.id, specs);
        this.interactionFilepaths.set(specs.id, path);
      }
    });
  }

  saveInteractionSpecsToFile(specs) {
    let path = this.directory + '/';
    if (specs.name && specs.name.length > 0) {
      path += specs.name + '_';
    }
    path += specs.id + '.interaction';
    console.info('saveInteractionSpecsToFile() - path ' + path);

    if (this.verifySpecification(specs)) {
      try {
        fs.writeFile(path, JSON.stringify(specs, null, 4), {flag: 'wx'});
        this.interactionFilepaths.set(specs.id, path);
      } catch (error) {
        console.info('###############');
        if (error) throw error;
      }
    } else {
      throw 'Invalid interaction specifications';
    }
  }

  deleteInteractionFile(id) {
    let path = this.interactionFilepaths.get(id);
    if (typeof path !== 'undefined') {
      fs.unlinkSync(path);
    }
  }

  verifySpecification(specs) {
    let translator = new ProtobufTranslator(MSG_TYPES.INTERACTION);
    let result = false;
    try {
      result = translator.verify(specs);
    }
    catch (error) {
      result = false;
    }

    return result;
  }
}

module.exports = new InteractionDatabase();
