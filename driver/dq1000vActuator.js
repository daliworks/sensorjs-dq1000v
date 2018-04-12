'use strict';

var util = require('util');

var SensorLib = require('../index');
var Actuator = SensorLib.Actuator;
var _ = require('lodash');
var logger = Actuator.getLogger();
var DQ1000V = require('../dq1000v');

function DQ1000VActuator(sensorInfo, options) {
  var self = this;

  Actuator.call(self, sensorInfo, options);

  self.field = self.id.split('-')[2];
  self.deviceID = self.id.split('-')[1];
  self.gatewayID = self.id.split('-')[0];
  self.lastTime = 0;
  self.myStatus = 'on'; 

  self.parent = DQ1000V.create(self.deviceID);

 if (sensorInfo.model) {
    self.model = sensorInfo.model;
  }

  self.dataType = DQ1000VActuator.properties.dataTypes[self.model][0];
  
  self.parent.register(self);
}

DQ1000VActuator.properties = {
  supportedNetworks: ['dq1000v-modbus-rtu'],
  dataTypes: {
    dq1000vSwitch: ['powerSwitch'],
    dq1000vTemperatureController: ['stringActuator'],
    dq1000vHumidityController: ['stringActuator']
  },
  models: [
    'dq1000vSwitch',
    'dq1000vTemperatureController',
    'dq1000vHumidityController'
  ],
  commands: {
    dq1000vSwitch: [ 'on', 'off' ],
    dq1000vTemperatureController: [ 'send' ],
    dq1000vHumidityController: [ 'send' ]
  },
  discoverable: false,
  addressable: true,
  //recommendedInterval: 60000,
  //maxInstances: 99,
  //maxRetries: 8,
  idTemplate: '{gatewayId}-{deviceAddress}-{sequence}',
  category: 'actuator'
};

util.inherits(DQ1000VActuator, Actuator);

DQ1000VActuator.prototype._set = function (cmd, options, cb) {
  var self = this;

  logger.trace('_set(', cmd, options, ')');
  try{
    var value;
    var index = _.find(DQ1000VActuator.properties.commands[self.model], cmd);
    if (index < 0) {
      return cb && cb('Invalid command');
    }

    switch(cmd) {
    case 'on': 
      value = true;
      break;
    case 'off': 
      value = false;
      break;

    case 'send': 
      if (options.text != undefined) {
        value = Math.trunc(parseFloat(options.text) * 10);
        logger.trace('vlaue = ', value);
      }
      break;
    }

    self.parent.emit(self.field, value, function(err) {
      return cb && cb(err, 'Success!');
    });
  }
  catch(err) {
    return cb && cb(err);
  }

}

DQ1000VActuator.prototype._get = function (cmd, options, cb) {
  var self = this;
  var result = {
    status: 'on',
    id: self.id,
    result: {},
    time: {}
  };

  result.result[self.type] = self.parent.getValue(self);

  logger.info('Called _get():', result);

  self.emit('data', result);
};

DQ1000VActuator.prototype.getStatus = function () {
  var self = this;
  return self.myStatus;
};

module.exports = DQ1000VActuator;
