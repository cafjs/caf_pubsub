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

        var shutdownIfErrF = function(err) {
            if (err) {
                var logMsg = 'Cannot unsubscribe, shutting down due to ' +
                        myUtils.errToPrettyStr(err);
                $._.$.log && $._.$.log.debug(logMsg);
                
                that.__ca_shutdown__(null, function(error) {
                    if (error) {
                        var logMsg = 'Cannot shutdown cleanly ' +
                                myUtils.errToPrettyStr(error);
                        $._.$.log && $._.$.log.error(logMsg);
                    }
                }); 
            }
        };
        
        var handleMsgF = function(topic, msg) {
            if (that.__ca_isShutdown__) {
                $._.$[sub] && $._.$[sub].clearPubSub(handleMsgF);
            } else {
                var all = allTopics[topic];
                if (all) {
                    var newAll = [];
                    async.each(all, function(fun, cb1) {
                        var cb2 =  myUtils.callJustOnce(null, function(err) {
                            if (err) {
                                // unsubscribe fun
                                err.topic = topic;
                                err.msg = msg;
                                var logMsg = 'Unsubscribing CA ' + fun.caName +
                                        ' due to exception ' +
                                        myUtils.errToPrettyStr(err);
                                $._.$.log && $._.$.log.debug(logMsg);
                            } else {
                                newAll.push(fun);
                            }
                            cb1(null);
                        });
                        fun(topic, msg, cb2);
                    }, function(err) {
                        //err is always null
                        if (newAll.length > 0) {
                            allTopics[topic] = newAll;
                        } else {
                            delete allTopics[topic];
                            var logMsg = 'Unsubscribing ' + topic +
                                    ' : No more clients!';
                            $._.$.log && $._.$.log.debug(logMsg);
                            if ($._.$[sub]) {
                                $._.$[sub].unsubscribePubSub(topic,
                                                             shutdownIfErrF);
                            } else {
                                shutdownIfErrF(new Error('No pub transport'));
                            }
                        }                        
                    });
                }
            }
        };
        

        /**
         * Subscribes a CA to receive messages of a particular topic.
         *
         * @param {string} topic Channel to subscribe.
         * @param {function(string, string, cb)} deliverF Function to notify
         *  the CA of a new message in the channel. It returns an error in 
         * callback  when it  is no longer valid to facilitate garbage 
         * collection.
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
                if ($._.$[sub]) {
                    $._.$[sub].subscribePubSub(topic, handleMsgF, cb0);
                } else {
                    cb0(new Error('Cannot subscribe: no connection'));
                }
            }
        };

        /**
         *  Unsubscribes a CA from a set of topics.
         *
         * @param {Array.<string>} topicArray Channels to unsubscribe.
         * @param {function(string, string, cb)} deliverF Function to notify
         *  the CA of a new message in the channel. It returns an error in 
         * callback  when it  is no longer valid to facilitate garbage 
         * collection.
         * @param {caf.cb} cb0 A callback to return subscription errors.
          */
        that.unsubscribe = function(topicArray, deliverF, cb0) {
            var unsubscribeImpl = function(topic, cb1) {
                var cleanupF = function(array, x) {
                    return array.filter(function(y) { return (x !== y); });
                };  
                var allF = allTopics[topic];
                if (Array.isArray(allF) && (allF.length > 0)) {
                    allF = cleanupF(allF, deliverF);
                    if (allF.length === 0) {
                        delete allTopics[topic];
                        if ($._.$[sub]) {
                            $._.$[sub].unsubscribePubSub(topic, cb1);
                        } else {
                            cb1(new Error('Cannot unsubscribe: no connection'));
                        }
                    } else {
                        allTopics[topic] = allF;
                        cb1(null);
                    }
                } else {
                    delete allTopics[topic];
                    cb1(null);
                }
            };
            
            $._.$.log && $._.$.log.trace('UNSUBSCRIBED to topics ' +
                                         JSON.stringify(topicArray) +
                                         ' ca ' + deliverF.caName);
            async.each(topicArray, function(topic, cb1) {
                unsubscribeImpl(topic, cb1);
            }, cb0);
        };
        

        /**
         * Publishes a message for a particular topic.
         *
         * @param {string} topic Channels to publish.
         * @param {string} message A message to publish.
         * @param {caf.cb} cb0 A callback to return publish errors.
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
                    $._.$[sub] && $._.$[sub].clearPubSub(handleMsgF);
                    cb0(null);
                }
            });
        };
  
        cb(null, that);
    } catch (err) {
        cb(err);
    }
};

