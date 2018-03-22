'use strict';

var net = require('net');
var util = require('util');
var _ = require('lodash');
var async = require('async');
var modbus = require('modbus-serial');
var EventEmitter = require('events').EventEmitter;

var logger = require('./index').Sensor.getLogger('Sensor');

var MODBUS_UNIT_ID = 1;
var RETRY_OPEN_INTERVAL = 3000; // 3sec

function isInvalid() {
  return false;
}

// client: modbus client
// registerAddress: register address from 40000
// bufferReadFunc: read function name of Buffer object
// cb: function (err, value)
function readValue(task, done) {
  var client = task.client;
  var registerAddress = task.registerAddress;
  var bufferReadFunc = task.bufferReadFunc;
  var cb = task.cb;
  var from = registerAddress - 40001;
  var to = from + 1;

  logger.debug('readValue() registerAddress:', registerAddress);
  client.readHoldingRegisters(MODBUS_UNIT_ID, from, to, function readCb(err, data) {
    var buffer = new Buffer(4);
    var value;
    var badDataErr;

    if (err) {
      logger.error('modbus-tcp.readHoldingRegisters() Error:', err);

      if (cb) {
        cb(err);
      }

      return done && done(err);
    }

    if (data.length < 2 || !Buffer.isBuffer(data[0]) || !Buffer.isBuffer(data[1])) {
      logger.error('modbus-tcp.readHoldingRegisters() Error: bad data format');
      badDataErr = new Error('Bad data:', data);

      if (cb) {
        cb(badDataErr);
      }

      return done && done(badDataErr);
    }

    data[0].copy(buffer, 0);
    data[1].copy(buffer, 2);

    logger.debug('data:', data);

    value = buffer[bufferReadFunc](0) || 0;

    logger.debug('Converted value:', value, registerAddress);

    if (cb) {
      cb(null, value);
    }

    return done && done();
  });
}

function DQ1000V () {
  var self = this;

  EventEmitter.call(self);

  self.sockets = [];
  self.clients = [];
  self.callbacks = [];
  self.connecting = false;
  self.dataRequestQueue = async.queue(readValue);
  self.dataRequestQueue.drain = function () {
    logger.debug('All the tasks have been done.');
  };
}

util.inherits(DQ1000V, EventEmitter);

// address: {IP}:{port}
// registerInfo: [{register address}, {buffer read function}]
// cb: function (err, value)
DQ1000V.prototype.getValue = function (address, regObj, cb) {
  var self = this;
  var registerAddress;
  var bufferReadFunc;
  var addressTokens;
  var deviceAddress;
  var devicePort;
  var client;
  var socket;
  var callbackArgs = {};

  logger.debug('Called getValue():', address, regObj);

  if (!regObj) {
    return cb && cb(new Error('No register information'));
  }

  /*
  if (!isValidAddress(address)) {
    return cb && cb(new Error('Bad device address:', address));
  }
  */

  registerAddress = regObj[0];
  bufferReadFunc = regObj[1];

  self.clients[address] = client = new modbus();

  client.connectRTU('/dev/ttyUSB0', { baudrate : 9600}, read);
  client.setID(address);

  function read(){
    client.readHoldingRegisters(address, 1);
  }
};

module.exports = new DQ1000V();
