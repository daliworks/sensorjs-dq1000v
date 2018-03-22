'use strict';

var util = require('util');
var sensorDriver = require('../../index');
var Network = sensorDriver.Network;
var Sensor = sensorDriver.Sensor;

function DQ1000VModbusRTU(options) {
  Network.call(this, 'dq1000v-modbus-rtu', options);
}

util.inherits(DQ1000VModbusRTU, Network);

DQ1000VModbusRTU.prototype.discover = function(networkName, options, cb) {
  return cb && cb(new Error('Not supported'));
};

module.exports = new DQ1000VModbusRTU();
