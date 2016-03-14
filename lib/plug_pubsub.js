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
/**
 * Creates connections to an external publish/subscribe service and
 * multiplexes them for all the CAs in this process.
 *
 * @name caf_pubsub/plug_pubsub
 * @namespace
 * @augments caf_components/gen_plug
 *
 */
var caf_comp = require('caf_components');
var async = caf_comp.async;
var myUtils = caf_comp.myUtils;
var genPlug = caf_comp.gen_plug;
var assert = require('assert');

/**
 * Factory method to create a pubsub service connector.
 *
 *  @see  caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        var that = genPlug.constructor($, spec);
        $._.$.log && $._.$.log.debug('New PubSub plug');

        // {topic:string -> Array.<function(string, string)>
        var allTopics = {};
        
        assert.equal(typeof spec.env.subscribeService, 'string',
                      "'spec.env.subscribeService' is not a string");
        var sub = spec.env.subscribeService;

        assert.equal(typeof spec.env.publishService, 'string',
                      "'spec.env.publishService' is not a string");
        var pub = spec.env.publishService;

        var unsubscribe = function(topic, cb0) {
            cb0 = cb0 || function(err) {
                if (err) {
                    $._.$.log && $._.$.log.debug('Cannot unsubscribe,' +
                                                 ' shutting down due to ' +
                                                 myUtils.errToPrettyStr(err));
                    that.__ca_shutdown__(null, function(error) {
                        if (error) {
                            $._.$.log &&
                                $._.$.log.error('Cannot shutdown cleanly' +
                                                myUtils.errToPrettyStr(error));
                        }
                    }); 
                }
            };
            $._.$[sub].unsubscribePubSub(topic, cb0);
        };
        
        var deliverMsgF = function(topic, msg) {
            if (that.__ca_isShutdown__) {
                $._.$[sub] && $._.$[sub].clearPubSub(deliverMsgF);
            } else {
                var all = allTopics[topic];
                if (all) {
                    var newAll = [];
                    all.forEach(function(fun) {
                        try {
                            fun(topic, msg);
                            newAll.push(fun);
                        } catch (err) {
                            err.topic = topic;
                            err.msg = msg;
                            err.fun = fun;
                            $._.$.log &&
                                $._.$.log.debug('Exception delivering ' +
                                                'pub/sub message ' +
                                                myUtils.errToPrettyStr(err) +
                                                ' to CA ' + fun.caName);
                        }
                    });
                    if (newAll.length > 0) {
                        allTopics[topic] = newAll;
                    } else {
                        delete allTopics[topic];
                        $._.$.log && $._.$.log.debug('Unsubscribing ' + topic +
                                                     ' : No more clients!');
                        unsubscribe(topic);
                    }
                }
            }
        };
        

        /**
         * Subscribes a CA to receive messages of a particular topic.
         *
         * @param {string} topic Channel to subscribe.
         * @param {function(string, string)} deliverF Function to notify
         *  the CA of a new message in the channel. It throws when it
         *  is no longer valid to facilitate garbage collection.
         * @param {caf.cb} cb0 A callback to return subscription errors.
         */
        that.subscribe = function(topic, deliverF, cb0) {
            $._.$.log && $._.$.log.trace('SUBSCRIBED to topic ' + topic +
                                        ' ca ' + deliverF.caName);
            var present = function(array, x) {
                return array.some(function(y) { return (x === y); });
            };        
            var allF = allTopics[topic];
            if (Array.isArray(allF) && (allF.length > 0)) {
                if (!present(allF, deliverF)) {
                    allF.push(deliverF);
                }
                cb0(null);
            } else {
                allF = [deliverF];
                allTopics[topic] = allF;
                $._.$[sub].subscribePubSub(topic, deliverMsgF, cb0);
            }
        };

        var unsubscribeImpl = function(topic, deliverF, cb0) {
            var cleanupF = function(array, x) {
                return array.filter(function(y) { return (x !== y); });
            };  
            var allF = allTopics[topic];
            if (Array.isArray(allF) && (allF.length > 0)) {
                allF = cleanupF(allF, deliverF);
                if (allF.length === 0) {
                    delete allTopics[topic];
                    $._.$[sub].unsubscribePubSub(topic, cb0);
                } else {
                    allTopics[topic] = allF;
                    cb0(null);
                }
            } else {
                delete allTopics[topic];
                cb0(null);
            }
        };

        /**
         *  Unsubscribes a CA from a set of topics.
         *
         */
        that.unsubscribe = function(topicArray, deliverF, cb0) {
            $._.$.log && $._.$.log.trace('UNSUBSCRIBED to topics ' +
                                         JSON.stringify(topicArray) +
                                         ' ca ' + deliverF.caName);
            async.eachSeries(topicArray, function(topic, cb1) {
                unsubscribeImpl(topic, deliverF, cb1);
            }, cb0);
        };
        

        /**
         * Publishes a message for a particular topic.
         */
        that.publish = function(topic, message, cb0) {
            $._.$.log && $._.$.log.trace('PUBLISHED to topic ' + topic +
                                         ' message:' + message);
            $._.$[pub].publishPubSub(topic, message, cb0);
        };
        
        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    $._.$[sub] && $._.$[sub].clearPubSub(deliverMsgF);
                    cb0(null);
                }
            });
        };
  
        cb(null, that);
    } catch (err) {
        cb(err);
    }
};

