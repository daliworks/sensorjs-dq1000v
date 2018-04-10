'use strict';

var logger = require('log4js').getLogger('Sensor');

function initDrivers() {
  var dq1000vSensor;
  var dq1000vActuator;

  try {
    dq1000vSensor = require('./driver/dq1000vSensor');
  } catch(e) {
    logger.error('Cannot load ./driver/dq1000vSensor', e);
  }

  try {
    dq1000vActuator = require('./driver/dq1000vActuator');
  } catch(e) {
    logger.error('Cannot load ./driver/dq1000vActuator', e);
  }

  return {
    dq1000vSensor: dq1000vSensor,
    dq1000vActuator: dq1000vActuator
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
    ],
    dq1000vActuator: [
      'dq1000vSwitch'
    ]
  },
  initNetworks: initNetworks,
  initDrivers: initDrivers
};
