const uuidv4 = require('uuid/v4');


/**
 * A class able to gather a list of topic data with unknown length, for example as input for an interaction.
 * 
 * Topics are selected based on a regular expression given by the string `topicSelector`.
 * Optionally `identityMatchPattern` can be provided as a regular expression string. When generating the topic data list, 
 * it will match against each input topic and extract some identity string. The result will be added to the list entry as `identity`.
 */
class TopicMultiplexer {
  constructor({ id = undefined, name = '', dataType = '', topicSelector = '', identityMatchPattern = '' }, topicData = undefined) {

    this.id = id ? id : uuidv4();
    this.name = name;
    this.dataType = dataType;
    this.topicSelector = topicSelector;
    this.identityMatchPattern = identityMatchPattern;

    this.topicData = topicData;
    this.topicData.events.on('newTopic', (topic) => { this.addTopic(topic); });
    this.topicSelectorRegExp = new RegExp(this.topicSelector);
    if (this.identityMatchPattern.length > 0) {
      this.identityMatchRegExp = new RegExp(this.identityMatchPattern);
    }

    this.updateTopicList();
  }

  /**
   * Get the list of topics + their respective data based on the regular expression defined for this multiplexer.
   * 
   * If `identityMatchPattern` was specified, list entries will include the field identity.
   * 
   * @return {Array} List of {topic, data, [optional] identity} objects for all topic data that match the topic selector. 
   */
  get() {
    let topicDataRecords = [];
    this.topicList.forEach((topic) => {
      let entry = this.topicData.pull(topic);
      if (entry && entry.type !== this.dataType && entry.data !== undefined) {
        let record = { topic: topic, data: entry.data };
        //TODO: (Sandro) adhere to protobuf TopicDataRecord format?
        //record.type = entry.type;
        //record[entry.type] = entry.data;

        if (this.identityMatchRegExp) {
          record.identity = topic.match(this.identityMatchRegExp)[0];
        }

        topicDataRecords.push(record);
      }
    });

    return topicDataRecords;
  }

  updateTopicList() {
    this.topicList = this.topicData.getAllTopicsWithData().reduce((selectedTopics, entry) => {
      if (this.topicSelectorRegExp.test(entry.topic)) {
        selectedTopics.push(entry.topic);
      }
      return selectedTopics;
    }, []);
  }

  addTopic(topic) {
    if (this.topicSelectorRegExp.test(topic)) {
      this.topicList.push(topic);
    }
  }

  toProtobuf() {
    return {
      id: this.id,
      name: this.name,
      dataType: this.dataType,
      topicSelector: this.topicSelector,
      identityMatchPattern: this.identityMatchPattern
    };
  }
}

module.exports = {
  'TopicMultiplexer': TopicMultiplexer
}