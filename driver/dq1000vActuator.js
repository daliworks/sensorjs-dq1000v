'use strict';

var util = require('util');

var SensorLib = require('../index');
var Actuator = SensorLib.Actuator;
var _ = require('lodash');
var logger = Actuator.getLogger();
var dq1000v = require('../dq1000v');

function DQ1000VActuator(sensorInfo, options) {
  var self = this;

  Actuator.call(self, sensorInfo, options);

  self.field = self.id.split('-')[2];
  self.deviceID = self.id.split('-')[1];
  self.lastTime = 0;
  
  if (sensorInfo.model) {
    self.model = sensorInfo.model;
  }

  self.dataType = DQ1000VActuator.properties.dataTypes[self.model][0];
  
  self.parent.register(self);
}

DQ1000VActuator.properties = {
  supportedNetworks: ['dq1000v-modbus-rtu'],
  dataTypes: {
    dq1000vSwitch: ['powerSwitch']
  },
  models: [
    'dq1000vSwitch'
  ],
  commands: {
    dq1000vSwitch: [ 'on', 'off' ]
  },
  discoverable: false,
  addressable: true,
  recommendedInterval: 60000,
  maxInstances: 99,
  maxRetries: 8,
  idTemplate: '{gatewayId}-{deviceAddress}-{sequence}',
  category: 'actuator'
};

util.inherits(DQ1000VActuator, Actuator);

function sendCommand(actuator, cmd, options, cb) {
  if (_.isFunction(options)) {
    cb = options;
    options = null;
  }

  logger.trace('sendCommand : ', actuator.deviceAddress, actuator.field, cmd, options);
 
  try {
    var settings = JSON.parse(options.settings);
    logger.trace('Settings : ', settings);

    cb(undefined, 'Success!');
  }
  catch(err) {
    cb('Invalid JSON format', err);
  }
}

DQ1000VActuator.prototype._set = function (cmd, options, cb) {
  var self = this;

  try{
    if (options.settings != undefined) {
      var settings = JSON.parse(options.settings);
      self.master.emit(self.deviceAddress + '-' + self.field, settings);
    }
  }
  catch(err) {
    return cb && cb(err);
  }

}

DQ1000VActuator.prototype._get = function (cmd, options, cb) {
  var self = this;
  
  sendCommand(self.shortId, cmd, options, function (err, result) {
    if(err) {
      self.myStatus = 'err';
    } else {
      self.myStatus = 'on';
    }
    return cb && cb(err, result);
  });
};

DQ1000VActuator.prototype.getStatus = function () {
  return this.myStatus;
};

DQ1000VActuator.prototype.connectListener = function () {
  this.myStatus = 'on';
};

DQ1000VActuator.prototype.disconnectListener = function () {
  var rtn = {
    status: 'off',
    id: this.id,
    message: 'disconnected'
  };

  this.myStatus = 'off';
  this.emit('data', rtn);
};

module.exports = DQ1000VActuator;
