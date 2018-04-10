'use strict';

var util = require('util');

var SensorLib = require('../index');
var Sensor = SensorLib.Sensor;
var logger = Sensor.getLogger('Sensor');
var DQ1000V = require('../dq1000v');

function DQ1000VSensor(sensorInfo, options) {
  var self = this;
  var tokens;

  Sensor.call(self, sensorInfo, options);

  tokens = self.id.split('-');
  self.deviceID = tokens[1];
  self.field = tokens[2];

  self.parent = DQ1000V.create(self.deviceID);

  if (sensorInfo.model) {
    self.model = sensorInfo.model;
  }

  self.dataType = DQ1000VSensor.properties.dataTypes[self.model][0];

  self.parent.register(self);
}

DQ1000VSensor.properties = {
  supportedNetworks: ['dq1000v-modbus-rtu'],
  dataTypes: {
    'dq1000vTemperature': ['temperature'],
    'dq1000vHumidity': ['humidity'],
    'dq1000vState': ['onoff']
  },
  discoverable: false,
  addressable: true,
  recommendedInterval: 60000,
  maxInstances: 32,
  maxRetries: 8,
  idTemplate: '{gatewayId}-{deviceId}-{sequence}',
  models: [
    'dq1000vTemperatue',
    'dq1000vHumidity',
    'dq1000vState'
  ],
  category: 'sensor'
};

util.inherits(DQ1000VSensor, Sensor);

DQ1000VSensor.prototype._get = function (cb) {
  var self = this;
  var result = {
    status: 'on',
    id: self.id,
    result: {},
    time: {}
  };

  logger.debug('Called _get():', self.id);

  result.result[self.dataType] = self.parent.getValue(self);

  self.emit('data', result);
}

DQ1000VSensor.prototype._enableChange = function () {
};

DQ1000VSensor.prototype._clear = function () {
};

module.exports = DQ1000VSensor;
