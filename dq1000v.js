'use strict';

var net = require('net');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var EventEmitter = require('events').EventEmitter;
var Master = require('./dq1000vMaster');
var logger = require('./index').Sensor.getLogger('Sensor');

function  CalcPower(value, exponent) {
  try {
    return  value * exponent;
  }
  catch(e) {
    logger.error('Invalid pow(', value, ',', exponent, ')');
  }
}

function DQ1000V (deviceID) {
  var self = this;

  EventEmitter.call(self);

  self.parent = Master;
  self.deviceID = deviceID;
  self.run = false;
  self.interval = 10000;
  self.addressSet = [
    {
      address: 10002,
      count: 2
    },
    {
      address: 20001,
      count: 100
    },
    {
      address: 30001,
      count: 2
    },
    {
      address: 40001,
      count: 2
    }
  ];

  self.sensors = {
    run:                { endpoint: undefined, value: undefined, registered: false, address: 10002, type: 'readUInt16BE', retryCount: 0},
    alarm:              { endpoint: undefined, value: undefined, registered: false, address: 20100, type: 'readUInt16BE', retryCount: 0},
    blower:             { endpoint: undefined, value: undefined, registered: false, address: 20007, type: 'readUInt16BE', retryCount: 0},
    cooling:            { endpoint: undefined, value: undefined, registered: false, address: 20050, type: 'readUInt32BE', retryCount: 0},
    dehumidification:   { endpoint: undefined, value: undefined, registered: false, address: 20051, type: 'readUInt32BE', retryCount: 0},
    heating:            { endpoint: undefined, value: undefined, registered: false, address: 20052, type: 'readUInt16BE', retryCount: 0},
    humidification:     { endpoint: undefined, value: undefined, registered: false, address: 20053, type: 'readUInt16BE', retryCount: 0},
    temperature:        { endpoint: undefined, value: undefined, registered: false, address: 40001, type: 'readInt16BE',   exponent: 0.1, retryCount: 0},
    humidity:           { endpoint: undefined, value: undefined, registered: false, address: 40002, type: 'readUInt16BE',  exponent: 0.1, retryCount: 0},
    settingTemperature: { endpoint: undefined, value: undefined, registered: false, address: 30001, type: 'readInt16BE',   exponent: 0.1, retryCount: 0},
    settingHumidity:    { endpoint: undefined, value: undefined, registered: false, address: 30002, type: 'readUInt16BE',  exponent: 0.1, retryCount: 0},
  };

  self.actuators={
    operation:          { endpoint: undefined, value: undefined, registered: false, address: 10002, type: 'readUInt16BE', writeType: 'writeUInt16BE', retryCount: 0},
    alarmRelease:       { endpoint: undefined, value: undefined, registered: false, address: 10003, type: 'readUInt16BE', writeType: 'writeUInt16BE', retryCount: 0},
    temperatureControl: { endpoint: undefined, value: undefined, registered: false, address: 30001, type: 'readInt16BE',  writeType: 'writeInt16BE', retryCount: 0},
    humidityControl:    { endpoint: undefined, value: undefined, registered: false, address: 30002, type: 'readUInt16BE', writeType: 'writeUInt16BE', retryCount: 0},
  };

  self.on('done', function (startAddress, count, data) {
    function setValue (item) {
      if (startAddress < 30000) {
        if (startAddress <= item.address && item.address < startAddress + count) {
          var offset = (item.address - startAddress);
          var value;
          if (data.data[offset] == true) {
            value = 1;
          }
          else {
            value = 0;
          }


          if (item.value != value) {
            if ((item.endpoint.onChange != undefined) && (item.endpoint.onChange == true)) {
              var result = {
                status: 'on',
                id: item.endpoint.id,
                result: {},
                time: {}
              };

              result.result[item.endpoint.dataType] = value;
              result.time[item.endpoint.dataType] = _.now();

              item.endpoint.emit('change', result);
            }
            item.value = value;
          }
          item.retryCount = 0;
        }
      }
      else {
        if (startAddress <= item.address && item.address < startAddress + count * 2) {
          var offset = (item.address - startAddress) * 2;
          var value;

          if (item.converter != undefined) {
            value = item.converter(data.buffer[item.type](offset) || 0);
          }
          else if (item.exponent != undefined){
            value = CalcPower((data.buffer[item.type](offset) || 0), item.exponent);
          }
          else {
            value = (data.buffer[item.type](offset) || 0);
          }
          item.value = value;
          item.retryCount = 0;
        }
      }
    };

    setValue(self.sensors.run);
    setValue(self.sensors.alarm);
    setValue(self.sensors.blower);
    setValue(self.sensors.cooling);
    setValue(self.sensors.dehumidification);
    setValue(self.sensors.heating);
    setValue(self.sensors.humidification);
    setValue(self.sensors.temperature);
    setValue(self.sensors.humidity);
    setValue(self.sensors.settingTemperature);
    setValue(self.sensors.settingHumidity);
    setValue(self.actuators.temperatureControl);
    setValue(self.actuators.humidityControl);
    setValue(self.actuators.operation);
    setValue(self.actuators.alarmRelease);
  });

  self.on('error', function (startAddress, count, data) {
    function setError (item) {
      item.retryCount = item.retryCount + 1;
      if (item.retryCount >= 10) {
        if (startAddress <= item.address && item.address < startAddress + count) {
          item.value = undefined;
        }
        else if (startAddress <= item.address && item.address < startAddress + count * 2) {
          item.value = undefined;
        }
      }
    };

    setError(self.sensors.run);
    setError(self.sensors.alarm);
    setError(self.sensors.blower);
    setError(self.sensors.cooling);
    setError(self.sensors.dehumidification);
    setError(self.sensors.heating);
    setError(self.sensors.humidification);
    setError(self.sensors.temperature);
    setError(self.sensors.humidity);
    setError(self.sensors.settingTemperature);
    setError(self.sensors.settingHumidity);
    setError(self.actuators.temperatureControl);
    setError(self.actuators.humidityControl);
    setError(self.actuators.operation);
    setError(self.actuators.alarmRelease);
  });

  function SetValue(field, value, cb) {
    if (self.actuators[field] != undefined) {
      if ((value == undefined) || (cb == undefined)) {
        logger.error('Invalid arguments(', value, cb, ')');
      }
      else {
        self.parent.setValue(self.actuators[field].address, value, cb);
      }
    }
  }

  self.on('temperatureControl', function (value, cb) {
    SetValue('temperatureControl', value, cb);
  });

  self.on('humidityControl', function (value, cb) {
    SetValue('humidityControl', value, cb);
  });

  self.on('operation', function (value, cb) {
    SetValue('operation', value, cb);
  });

  self.on('alarmRelease', function (value, cb) {
    SetValue('alarmRelase', value, cb);
  });
}

util.inherits(DQ1000V, EventEmitter);

function Create_(deviceID) {
  var dq1000v = Master.getInstance(deviceID);
  if (dq1000v == undefined) {
    dq1000v = new DQ1000V(deviceID);
    logger.trace('DQ1000V(', deviceID, ') is created.');
    Master.addInstance(dq1000v);
  }

  return  dq1000v;
}

DQ1000V.prototype.register = function(endpoint) {
  var self = this;

  if (self.sensors[endpoint.field] != undefined) {
    self.sensors[endpoint.field].registered = true;
    self.sensors[endpoint.field].endpoint = endpoint;
    self.parent.run();
  }
  else if (self.actuators[endpoint.field] != undefined) {
    self.actuators[endpoint.field].registered = true;
    self.actuators[endpoint.field].endpoint = endpoint;

    endpoint.emit('connect');
  }
  else{
    logger.error('Undefined base field tried to register : ', endpoint.field);
  }
}

DQ1000V.prototype.getValue = function (endpoint) {
  var self = this;

  if (self.sensors[endpoint.field] != undefined) {
    return  self.sensors[endpoint.field].value;
  }
  else if (self.actuators[endpoint.field] != undefined) {
    return  self.actuators[endpoint.field].value;
  }

  logger.error('Tried to get value of undefined field : ', endpoint.field);
  return  undefined;
}

module.exports = 
{
  create: Create_
}
