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
    return  Math.pow(value, exponent);
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
      address: 10001,
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
    alarm:              { value: undefined, registered: false, address: 10100, type: 'readUInt16BE'},
    blower:             { value: undefined, registered: false, address: 10007, type: 'readUInt16BE'},
    cooling:            { value: undefined, registered: false, address: 10050, type: 'readUInt32BE'},
    dehumidification:   { value: undefined, registered: false, address: 10051, type: 'readUInt32BE'},
    heating:            { value: undefined, registered: false, address: 10052, type: 'readUInt16BE'},
    humidification:     { value: undefined, registered: false, address: 10053, type: 'readUInt16BE'},
    temperature:        { value: undefined, registered: false, address: 40001, type: 'readInt16BE',   exponent: -1},
    humidity:           { value: undefined, registered: false, address: 40002, type: 'readUInt16BE',  exponent: -1},
    setTemperature:     { value: undefined, registered: false, address: 30001, type: 'readInt16BE',   exponent: -1},
    setHumidity:        { value: undefined, registered: false, address: 30002, type: 'readUInt16BE',  exponent: -1},
  };

  self.actuators={
    run:                { value: undefined, registered: false, address: 00002, type: 'readUInt16BE', writeType: 'writeUInt16BE'}  ,
    alarmRelease:       { value: undefined, registered: false, address: 00003, type: 'readUInt16BE', writeType: 'writeUInt16BE'}  
  };

  self.on('done', function (startAddress, count, data) {
    function setValue (item) {
      if (startAddress < 30000) {
        var offset = (item.address - startAddress);
        if (data.data[offset] == true) {
          item.value = 'on';
        }
        else {
          item.value = 'off';
        }
      }
      else{
        if (startAddress <= item.address && item.address < startAddress + count * 2) {
          var offset = (item.address - startAddress) * 2;
          if (item.converter != undefined) {
            item.value = item.converter(data.buffer[item.type](offset) || 0);
          }
          else if (item.exponent != undefined){
            item.value = CalcPower((data.buffer[item.type](offset) || 0), item.exponent);
          }
          else {
            item.value = (data.buffer[item.type](offset) || 0);
          }
        }
      }
    };

    setValue(self.sensors.alarm);
    setValue(self.sensors.blower);
    setValue(self.sensors.cooling);
    setValue(self.sensors.dehumidification);
    setValue(self.sensors.heating);
    setValue(self.sensors.humidification);
    setValue(self.sensors.temperature);
    setValue(self.sensors.humidity);
    setValue(self.sensors.setTemperature);
    setValue(self.sensors.setHumidity);
  });

  self.on('setTemperature', function (cb) {
    var field = 'setTemperature';

    if (self.actuators[field] != undefined) {
      var registers = [];
      logger.trace('Set Temperature: ', field);

      registers[0] = new Buffer(4);
      registers[0][self.actuators[field].writeType](0, 0);
      registers[0][self.actuators[field].writeType](0, 2);
      self.parent.setValue(self.actuators[field].address, 1, registers, cb);
    }
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
    self.parent.run();
  }
  else if (self.actuators[endpoint.field] != undefined) {
    self.actuators[endpoint.field].registered = true;
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
