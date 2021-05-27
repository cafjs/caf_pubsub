'use strict';

const caf = require('caf_core');

const ADMIN_CA = 'admin';
const ADMIN_CHANNEL = 'myNews';

const isAdmin = function(self) {
    const name = self.__ca_getName__();
    return (caf.splitName(name)[1] === ADMIN_CA);
};

const mainChannel = function(self) {
    const name = self.__ca_getName__();
    return caf.joinName(caf.splitName(name)[0], ADMIN_CA, ADMIN_CHANNEL);
};

exports.methods = {
    async __ca_init__() {
        this.state.counter = 0;
        this.$.pubsub.subscribe(mainChannel(this), '__ca_handle__');
        /* Security disabled in this example.
           this.$.security.addRule(this.$.security.newSimpleRule(
               '__ca_handle__', this.$.security.SELF, ADMIN_CA
           ));
        */
        return [];
    },
    async __ca_pulse__() {
        if (isAdmin(this)) {
            this.state.counter = this.state.counter + 1;
            this.$.pubsub.publish(mainChannel(this),
                                  'Counter: ' + this.state.counter);
        }
        return [];
    },
    async __ca_handle__(topic, msg, from) {
        this.$.log && this.$.log.debug('Got ' + msg + ' from ' + from);
        this.$.session.notify([msg]);
        return [];
    }
};

caf.init(module);
