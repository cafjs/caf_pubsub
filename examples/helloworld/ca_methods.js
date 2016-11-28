'use strict';

var caf = require('caf_core');
var json_rpc = caf.caf_transport.json_rpc;

var ADMIN_CA = 'admin';
var ADMIN_CHANNEL = 'myNews';

var isAdmin = function(self) {
    var name = self.__ca_getName__();
    return (json_rpc.splitName(name)[1] === ADMIN_CA);
};

var masterChannel = function(self) {
    var name = self.__ca_getName__();
    return json_rpc.joinName(json_rpc.splitName(name)[0], ADMIN_CA,
                             ADMIN_CHANNEL);
};

exports.methods = {
    __ca_init__: function(cb) {
        this.state.counter = 0;
        this.$.pubsub.subscribe(masterChannel(this), 'handleMessage');
        cb(null);
    },
    __ca_pulse__: function(cb) {
        if (isAdmin(this)) {
            this.state.counter = this.state.counter + 1;
            this.$.pubsub.publish(masterChannel(this),
                                  'Counter: ' + this.state.counter);
        }
        cb(null);
    },
    handleMessage: function(topic, msg, cb) {
        this.$.log && this.$.log.debug('Got ' + msg);
        this.$.session.notify([msg]);
        cb(null);
    }
};

caf.init(module);
