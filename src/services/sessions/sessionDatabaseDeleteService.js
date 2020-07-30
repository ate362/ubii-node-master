const { Service } = require('../service.js');
const SessionDatabase = require('../../storage/sessionDatabase');

const { DEFAULT_TOPICS, MSG_TYPES } = require('@tum-far/ubii-msg-formats');

class SessionDatabaseDeleteService extends Service {
  constructor() {
    super(
      DEFAULT_TOPICS.SERVICES.SESSION_DATABASE_DELETE,
      MSG_TYPES.SESSION,
      MSG_TYPES.SUCCESS + ', ' + MSG_TYPES.ERROR
    );
  }

  reply(sessionMessage) {
    let session = SessionDatabase.getSession(sessionMessage.id);
    if (typeof session === 'undefined') {
      return {
        error: {
          title: 'SessionDatabaseDeleteService Error',
          message: 'Could not find session with ID ' + sessionMessage.id
        }
      };
    } else {
      try {
        SessionDatabase.deleteSession(sessionMessage.id);
      } catch (error) {
        return {
          error: {
            title: 'SessionDatabaseDeleteService Error',
            message: error.toString()
          }
        };
      }

      return {
        success: {
          title: 'SessionDatabaseDeleteService',
          message: 'Successfully deleted session with ID ' + sessionMessage.id
        }
      };
    }
  }
}

module.exports = {
  SessionDatabaseDeleteService: SessionDatabaseDeleteService
};
