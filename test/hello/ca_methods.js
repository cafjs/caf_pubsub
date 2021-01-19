// Modifications copyright 2020 Caf.js Labs and contributors
/*!
Copyright 2013 Hewlett-Packard Development Company, L.P.

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
"use strict";

exports.methods = {
    "__ca_init__" : function(cb) {
        this.$.log.debug("++++++++++++++++Calling init");
        this.state.pulses = 0;
        this.state.h1 = {};
        this.state.h2 = {};
        cb(null);
    },
    "__ca_resume__" : function(cp, cb) {
        this.$.log.debug("++++++++++++++++Calling resume: pulses=" +
                         this.state.pulses);

        cb(null);
    },
    "__ca_pulse__" : function(cb) {
        this.state.pulses = this.state.pulses + 1;
        this.$.log.debug('<<< Calling Pulse>>>' + this.state.pulses);
        cb(null);
    },
    subscribe: function(topic, methodName, cb) {
        this.$.pubsub.subscribe(topic, methodName);
        cb(null);
    },
    unsubscribe: function(topic, cb) {
        this.$.pubsub.unsubscribe(topic);
        cb(null);
    },
    publish: function(topic, value, cb) {
        this.$.pubsub.publish(topic, value);
        cb(null);
    },
    publishFail: function(topic, value, cb) {
        this.$.pubsub.publish(topic, value);
        setTimeout(function() {
            cb(new Error('Oops'));
        }, 100);
    },
    handler1 : function(topic, message, from, cb) {
        this.state.h1[topic] = message;
        cb(null);
    },
    handler2 : function(topic, message, from, cb) {
        this.state.h2[topic] = message;
        cb(null);
    },
    handlerException: function(topic, message, from, cb) {
        this.state.h1[topic] = message;
        this.state.h2[topic] = message;
         setTimeout(function() {
             throw new Error('Really Oops');
             //cb(new Error('Really Oops'));
        }, 100);
    },
    getState: function(cb) {
        cb(null, this.state);
    },
    die: function(cb) {
        var self = this;
//        this.__ca_shutdown__(null,cb);
        setTimeout(function() { self.__ca_shutdown__(null, function() {});},
                   100);
        cb(null);

    }
};
