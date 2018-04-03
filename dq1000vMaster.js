'use strict';

var util = require('util');
var _ = require('lodash');
var async = require('async');
var ModbusRTU = require('modbus-serial');
var EventEmitter = require('events').EventEmitter;

var logger = require('./index').Sensor.getLogger('Sensor');

var MODBUS_UNIT_ID = 1;
var MODBUS_TIMEOUT = 1000;
var RETRY_OPEN_INTERVAL = 3000; // 3sec
var REGISTER_UPDATE_INTERVAL = 10000;
var START_OF_COILS = 10001;
var END_OF_COILS = 20000;

// client: modbus client
// registerAddress: register address from 40000
// bufferReadFunc: read function name of Buffer object
// cb: function (err, value)
function readValue(task, done) {
  var client = task.client;
  var cb = task.readCb;
  var address;
  var count;
  var readRegisters;

  logger.debug('readValue() registerAddress:', task.registerAddress,  task.registerCount);

  try {
    if (START_OF_COILS <= task.registerAddress && task.registerAddress <= END_OF_COILS) {
      client.readCoils(task.registerAddress - START_OF_COILS, task.registerCount)
        .then(function( data) {
          if (cb) {
            cb(null, task.registerAddress, task.registerCount, data);
          }

          return done && done();
        })
        .catch( function(err) {
          logger.error('Error:', err);
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else if (30001 <= task.registerAddress && task.registerAddress <= 39999) {
      client.readHoldingRegisters(task.registerAddress - 30001, task.registerCount)
        .then(function (data) {
          if (cb) {
            cb(undefined, task.registerAddress, task.registerCount, data);
          }
          return done && done();
        })
        .catch(function(err){
          logger.error('Error:', err);
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else if (40001 <= task.registerAddress && task.registerAddress <= 49999) {
      client.readInputRegisters(task.registerAddress - 40001, task.registerCount)
        .then(function( data) {
          if (cb) {
            cb(null, task.registerAddress, task.registerCount, data);
          }

          return done && done();
        })
        .catch( function(err) {
          logger.error('Error:', err);
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else {
      return done('Invalid address : ', task.registerAddress);
    }
  }
  catch (err) {
    logger.error('Error : ', err);
  }
}

function Master (config) {
  var self = this;

  self.config = Master.properties.config;

  if (config != undefined) {
    if (config.serial != undefined) {
      if (config.serial.port != undefined) {
        self.config.serial.port = config.serial.port;
      }

      if (config.serial.baudrate != undefined) {
        self.config.serial.baudrate = config.serial.port;
      }
    }

    if (config.interval != undefined) {
      self.config.interval = config.interval;
    }

    if (config.deviceID != undefined) {
      self.config.deviceID = config.deviceID;
    }

    if (config.timeout != undefined) {
      self.config.timeout = config.timeout;
    }
  }

  EventEmitter.call(self);
  self.client = new ModbusRTU();
  self.client.connectRTUBuffered(self.config.serial.port, { baudrate: self.config.serial.baudrate });
  self.client.setID(self.config.deviceID);
  self.client.setTimeout(self.config.timeout);
  self.children = [];
  self.readQueue = async.queue(readValue);
  self.readQueue.drain = function () {
    logger.debug('All the read tasks have been done.');
  };

  self.isRun = false;
}    

util.inherits(Master, EventEmitter);

Master.properties = {
  config : {
    serial : {
      port : '/dev/ttyXRUSB1',
      baudrate : 9600
    },
    interval : REGISTER_UPDATE_INTERVAL,
    deviceID : MODBUS_UNIT_ID,
    timeout : MODBUS_TIMEOUT
  }
};

Master.prototype.addInstance = function(instance) {
  var self = this;

  self.children.push(instance);
}

Master.prototype.getInstance = function (deviceID) {
  var self = this;
  var i;

  for (i = 0; i < self.children.length; i++) {
    if (self.children[i].deviceID == deviceID) {
      return self.children[i];
    }
  }

  return  undefined;
}

Master.prototype.run = function() {
  var self = this;

  if (self.intervalHandler != undefined) {
    return;
  }

  self.intervalHandler = setInterval(function() {
    if (self.client != undefined) {
      self.children.map(function (child) {
        var i;

        for (i = 0; i < child.addressSet.length; i++) {
          var callArgs = {
            client: self.client,
            registerAddress: child.addressSet[i].address,
            registerCount: child.addressSet[i].count,
            readCb: function (err, address, count, registers) {
              if (err == undefined) {
                child.emit('done', address, count, registers)
              }
            }
          };

          self.readQueue.push(callArgs, function pushCb(err) {
            if (err) {
              logger.error('pushCB error: ', err);
            }
          });
        }
      });
    }
  }, self.config.interval);

  self.isRun = true;
}

Master.prototype.getValue = function (field) {
  var self = this;

  var i;
  for(i = 0 ; i < self.items.length ; i++) {
    if (self.items[i].field == field) {
      return  self.items[i].value;
    }
  }

  return  undefined;
}

module.exports = new Master();
