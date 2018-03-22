'use strict';

var util = require('util');

var SensorLib = require('../index');
var Sensor = SensorLib.Sensor;
var logger = Sensor.getLogger('Sensor');
var dq1000v = require('../dq1000v');

var addressTable = {
  alarm: [10100],
  blower: [10007],
  cooling: [10050],
  dehumidification: [10051],
  heating: [10052],
  humidification: [10053],
  temperature: [30001],
  humidity: [30002],
  setTemperature: [40001],
  setHumidity: [40002]
};

function DQ1000VSensor(sensorInfo, options) {
  var self = this;
  var tokens;

  Sensor.call(self, sensorInfo, options);

  tokens = self.id.split('-');
  self.deviceAddress = tokens[1];
  self.sequence = tokens[2];

  if (sensorInfo.model) {
    self.model = sensorInfo.model;
  }

  self.dataType = DQ1000VSensor.properties.dataTypes[self.model][0];
}

DQ1000VSensor.properties = {
  supportedNetworks: ['dq1000v-rs485'],
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
  idTemplate: '{gatewayId}-{deviceAddress}-{sequence}',
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

  dq1000v.getValue(self.deviceAddress, addressTable[self.sequence], function getValueCb(err, value) {
    if (err) {
      result.status = 'error';
      result.message = err.message ? err.message : 'Unknown error(No message)';
    } else {
      result.result[self.dataType] = value;
      result.time[self.dataType] = Date.now();
    }

    if (cb) {
      return cb(err, result);
    } else {
      self.emit('data', result);
    }
  });
};

DQ1000VSensor.prototype._enableChange = function () {
};

DQ1000VSensor.prototype._clear = function () {
};

module.exports = DQ1000VSensor;
