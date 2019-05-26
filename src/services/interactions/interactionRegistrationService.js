const {Service} = require('./../service.js');
const {Interaction} = require('./../../sessions/interaction.js');
const InteractionDatabase = require('../../storage/interactionDatabase');

const { DEFAULT_TOPICS } = require('@tum-far/ubii-msg-formats');

class InteractionRegistrationService extends Service {
  constructor() {
    super(DEFAULT_TOPICS.SERVICES.INTERACTION_REGISTRATION);
  }

  reply(interactionSpecs) {
    if (typeof interactionSpecs === 'undefined') {
      return {
        error: {
          title: 'InteractionRegistrationService Error',
          message: 'Interaction specifications are undefined.'
        }
      };
    }

    if (Array.isArray(interactionSpecs)) {
      let newInteractions = [];
      interactionSpecs.forEach((spec) => {
        try {
          InteractionDatabase.addInteraction(spec);
          newInteractions.push(new Interaction(spec));
        } catch (error) {
          return {
            error: {
              title: 'InteractionRegistrationService Error',
              message: error.toString()
            }
          };
        }
      });

      return {
        interactionList: newInteractions.map((interaction) => {return interaction.toProtobuf()})
      };
    }

    let interaction;
    try {
      interaction = InteractionDatabase.addInteraction(interactionSpecs);
    } catch (error) {
      return {
        error: {
          title: 'InteractionRegistrationService Error',
          message: error.toString()
        }
      };
    }

    return {interaction: interaction.toProtobuf()};
  }
}

module.exports = {
  'InteractionRegistrationService': InteractionRegistrationService
};