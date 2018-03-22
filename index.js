'use strict';

var logger = require('log4js').getLogger('Sensor');

function initDrivers() {
  var dq1000vSensor;

  try {
    dq1000vSensor = require('./driver/dq1000vSensor');
  } catch(e) {
    logger.error('Cannot load ./driver/dq1000vSensor', e);
  }

  return {
    dq1000vSensor: dq1000vSensor
  };
}

function initNetworks() {
  var modbusRTU;

  try {
    modbusRTU = require('./network/dq1000v-modbus-rtu');
  } catch (e) {
    logger.error('Cannot load ./network/dq1000v-modbus-rtu', e);
  }

  return {
    'dq1000v-modbus-rtu': modbusRTU
  };
}

module.exports = {
  networks: ['dq1000v-modbus-rtu'],
  drivers: {
    dq1000vSensor: [
      'dq1000vState',
      'dq1000vTemperature',
      'dq1000vHumidity'
    ]
  },
  initNetworks: initNetworks,
  initDrivers: initDrivers
};
