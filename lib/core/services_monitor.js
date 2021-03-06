var async = require('../utils/async_extend.js');

// TODO: need to separate colors from states
// i.e use status: /on|off|warn/ not /red|green/
// it's up to the logger or console to determine the color
var ServicesMonitor = function(options) {
  this.events = options.events;
  this.logger = options.logger;
  this.checkList = {};
  this.checkTimers = {};
  this.checkState = {};
  this.working = false;
};

ServicesMonitor.prototype.initCheck = function(checkName) {
  var self = this;
  var check = this.checkList[checkName];

  if (!check) { return false; }

  self.events.on('check:' + checkName, function(obj) {
    // TODO: see todo above
    if (check && check.status === 'red' && obj.status === 'green') {
      self.events.emit('check:backOnline:' + checkName);
    }
    if (check && check.status === 'green' && obj.status === 'red') {
      self.events.emit('check:wentOffline:' + checkName);
    }
    self.checkState[checkName] = obj.name[obj.status];
    check.status = obj.status;
    self.events.emit("servicesState", self.checkState);
  });

  if (check.interval !== 0) {
    self.checkTimers[checkName] = setInterval(function() {
      check.fn.call(check.fn, function(obj) {
        self.events.emit('check:' + checkName, obj);
      });
    }, check.interval);
  }

  check.fn.call(check.fn, function(obj) {
    self.events.emit('check:' + checkName, obj);
  });
};

ServicesMonitor.prototype.addCheck = function(checkName, checkFn, time) {
  var self = this;
  this.logger.trace('add check: ' + checkName);
  this.checkList[checkName] = {fn: checkFn, interval: time || 5000};

  if (this.working) {
    this.initCheck(checkName);
  }
};

ServicesMonitor.prototype.stopCheck = function(name) {
  clearInterval(this.checkTimers[name]);
  delete this.checkTimers[name];
  delete this.checkList[name];
  delete this.checkState[name];
};

ServicesMonitor.prototype.startMonitor = function() {
  var self = this;
  this.working = true;
  this.logger.trace('startMonitor');

  async.eachObject(this.checkList, function(checkName, check, callback) {
    self.initCheck(checkName);
    callback();
  }, function(err) {
    if (err) {
      self.logger.error("error running service check");
      self.logger.error(err.message);
    }
  });
};

module.exports = ServicesMonitor;
