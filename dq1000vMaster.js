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
var START_OF_DISCRETE = 20001;
var END_OF_DISCRETE = 30000;
var START_OF_HOLD_REGISTERS = 30001;
var END_OF_HOLD_REGISTERS = 40000;
var START_OF_INPUT_REGISTERS = 40001;
var END_OF_INPUT_REGISTERS = 50000;

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
          logger.error(err);
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else if (START_OF_DISCRETE <= task.registerAddress && task.registerAddress <= END_OF_DISCRETE) {
      client.readDiscreteInputs(task.registerAddress - START_OF_DISCRETE, task.registerCount)
        .then(function( data) {
          if (cb) {
            cb(null, task.registerAddress, task.registerCount, data);
          }

          return done && done();
        })
        .catch( function(err) {
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else if (START_OF_HOLD_REGISTERS <= task.registerAddress && task.registerAddress <= END_OF_HOLD_REGISTERS) {
      client.readHoldingRegisters(task.registerAddress - START_OF_HOLD_REGISTERS, task.registerCount)
        .then(function (data) {
          if (cb) {
            cb(undefined, task.registerAddress, task.registerCount, data);
          }
          return done && done();
        })
        .catch(function(err){
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else if (START_OF_INPUT_REGISTERS <= task.registerAddress && task.registerAddress <= END_OF_INPUT_REGISTERS) {
      client.readInputRegisters(task.registerAddress - START_OF_INPUT_REGISTERS, task.registerCount)
        .then(function( data) {
          if (cb) {
            cb(null, task.registerAddress, task.registerCount, data);
          }

          return done && done();
        })
        .catch( function(err) {
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
    logger.error(err);
  }
}

function writeValue(task, done) {
  var client = task.client;
  var cb = task.writeCb;
  var address;

  try {
    if (START_OF_COILS <= task.registerAddress && task.registerAddress <= END_OF_COILS) {
      client.writeCoil(task.registerAddress - START_OF_COILS, task.value)
        .then(function( data) {
          if (cb) {
            cb();
          }

          return done && done();
        })
        .catch( function(err) {
          if (cb) {
            cb(err);
          }

          return done && done(err);
        });
    }
    else if (START_OF_HOLD_REGISTERS <= task.registerAddress && task.registerAddress <= END_OF_HOLD_REGISTERS) {
      logger.info('writeRegister(', task.registerAddress - START_OF_HOLD_REGISTERS, task.value, ')');
      client.writeRegister(task.registerAddress - START_OF_HOLD_REGISTERS, task.value)
        .then(function (data) {
          if (cb) {
            cb();
          }
          return done && done();
        })
        .catch(function(err){
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
    logger.error(err);
  }
}

function queryProcess(task, done) {
  if (task.op == 'read') {
    return  readValue(task, done);
  }
  else if (task.op == 'write') {
    return  writeValue(task, done);
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

      if (config.serial.baudRate != undefined) {
        self.config.serial.baudRate = config.serial.port;
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
  self.client.connectRTUBuffered(self.config.serial.port, { baudRate: self.config.serial.baudRate });
  self.client.setID(self.config.deviceID);
  self.client.setTimeout(self.config.timeout);
  self.children = [];
  self.queryQueue = async.queue(queryProcess);
  self.queryQueue.drain = function () {
    logger.debug('All the read tasks have been done.');
  };

  self.isRun = false;
}    

util.inherits(Master, EventEmitter);

Master.properties = {
  config : {
    serial : {
      port : '/dev/serial-port-ioioi1',
      baudRate : 9600
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
            op : 'read',
            client: self.client,
            registerAddress: child.addressSet[i].address,
            registerCount: child.addressSet[i].count,
            readCb: function (err, address, count, registers) {
              if (err == undefined) {
                child.emit('done', address, count, registers)
              }
              else {
                child.emit('error', address, count, registers)
              }
            }
          };

          self.queryQueue.push(callArgs, function pushCb(err) {
            if (err) {
                child.emit('error', callArgs.registerAddress, callArgs.registerCount)
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

Master.prototype.setValue = function(address, value, cb) {
  var self = this;

  var callArgs = {
    op : 'write',
    client: self.client,
    registerAddress: address,
    value: value,
    writeCb: cb
  };

  self.queryQueue.push(callArgs, function pushCb(err) {
    if (err) {
      logger.error('pushCB error: ', err);
    }
  });
}

module.exports = new Master();
