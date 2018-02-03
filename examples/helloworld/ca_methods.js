'use strict';

var caf = require('caf_core');

var ADMIN_CA = 'admin';
var ADMIN_CHANNEL = 'myNews';

var isAdmin = function(self) {
    var name = self.__ca_getName__();
    return (caf.splitName(name)[1] === ADMIN_CA);
};

var masterChannel = function(self) {
    var name = self.__ca_getName__();
    return caf.joinName(caf.splitName(name)[0], ADMIN_CA, ADMIN_CHANNEL);
};

exports.methods = {
    async __ca_init__() {
        this.state.counter = 0;
        this.$.pubsub.subscribe(masterChannel(this), 'handleMessage');
        return [];
    },
    async __ca_pulse__() {
        if (isAdmin(this)) {
            this.state.counter = this.state.counter + 1;
            this.$.pubsub.publish(masterChannel(this),
                                  'Counter: ' + this.state.counter);
        }
        return [];
    },
    async handleMessage(topic, msg) {
        this.$.log && this.$.log.debug('Got ' + msg);
        this.$.session.notify([msg]);
        return [];
    }
};

caf.init(module);
