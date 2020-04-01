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

'use strict';
/**
 * Creates connections to an external publish/subscribe service,
 * multiplexing them for all the CAs in this process.
 *
 *  Properties:
 *
 *          {subscribeService: string, publishService: string}
 *
 *   where `subscribeService` and `publishService` are the names of the services
 * that we use to interact with the publish/subscribe backend. For example,
 * `cp` and `cp2` if we are using `Redis`. Note that `Redis` needs two different
 * connections to support concurrent publish and subscribe.
 *
 * @module caf_pubsub/plug_pubsub
 * @augments external:caf_components/gen_plug
 */
// @ts-ignore: augments not attached to a class
const caf_comp = require('caf_components');
const async = caf_comp.async;
const myUtils = caf_comp.myUtils;
const genPlug = caf_comp.gen_plug;
const assert = require('assert');

exports.newInstance = async function($, spec) {
    try {
        const that = genPlug.create($, spec);
        $._.$.log && $._.$.log.debug('New PubSub plug');

        // {topic:string -> Array.<function(string, string)>
        const allTopics = {};

        assert.equal(typeof spec.env.subscribeService, 'string',
                     "'spec.env.subscribeService' is not a string");
        const sub = spec.env.subscribeService;

        assert.equal(typeof spec.env.publishService, 'string',
                     "'spec.env.publishService' is not a string");
        const pub = spec.env.publishService;

        const shutdownIfErrF = function(err) {
            if (err) {
                const logMsg = 'Cannot unsubscribe, shutting down due to ' +
                          myUtils.errToPrettyStr(err);
                $._.$.log && $._.$.log.debug(logMsg);

                that.__ca_shutdown__(null, function(error) {
                    if (error) {
                        const logMsg = 'Cannot shutdown cleanly ' +
                                  myUtils.errToPrettyStr(error);
                        $._.$.log && $._.$.log.error(logMsg);
                    }
                });
            }
        };

        const handleMsgF = function(topic, msg) {
            if (that.__ca_isShutdown__) {
                $._.$[sub] && $._.$[sub].clearPubSub(handleMsgF);
            } else {
                const all = allTopics[topic];
                if (all) {
                    const newAll = [];
                    async.each(all, function(fun, cb1) {
                        const cb2 = myUtils.callJustOnce(null, function(err) {
                            if (err) {
                                // unsubscribe fun
                                err.topic = topic;
                                err.msg = msg;
                                const logMsg = 'Unsubscribing CA ' +
                                          fun.caName +
                                          ' due to exception ' +
                                          myUtils.errToPrettyStr(err);
                                $._.$.log && $._.$.log.debug(logMsg);
                            } else {
                                newAll.push(fun);
                            }
                            cb1(null);
                        });
                        fun(topic, msg, cb2);
                    }, function() {
                        //error in callback is always null
                        if (newAll.length > 0) {
                            allTopics[topic] = newAll;
                        } else {
                            delete allTopics[topic];
                            const logMsg = 'Unsubscribing ' + topic +
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


        /*
         * Subscribes a CA to receive messages of a particular topic.
         *
         * @param {string} topic Channel to subscribe.
         * @param {function(string, string, cb)} deliverF Function to notify
         *  the CA of a new message in the channel. It returns an error in
         * callback  when it  is no longer valid to facilitate garbage
         * collection.
         * @param {cbType} cb0 A callback to return subscription errors.
         */
        that.subscribe = function(topic, deliverF, cb0) {
            $._.$.log && $._.$.log.trace('SUBSCRIBED to topic ' + topic +
                                        ' ca ' + deliverF.caName);
            const present = function(array, x) {
                return array.some(function(y) { return (x === y); });
            };
            let allF = allTopics[topic];
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

        /*
         *  Unsubscribes a CA from a set of topics.
         *
         * @param {Array.<string>} topicArray Channels to unsubscribe.
         * @param {function(string, string, cb)} deliverF Function to notify
         *  the CA of a new message in the channel. It returns an error in
         * callback  when it  is no longer valid to facilitate garbage
         * collection.
         * @param {cbType} cb0 A callback to return subscription errors.
          */
        that.unsubscribe = function(topicArray, deliverF, cb0) {
            const unsubscribeImpl = function(topic, cb1) {
                const cleanupF = function(array, x) {
                    return array.filter(function(y) { return (x !== y); });
                };
                let allF = allTopics[topic];
                if (Array.isArray(allF) && (allF.length > 0)) {
                    allF = cleanupF(allF, deliverF);
                    if (allF.length === 0) {
                        delete allTopics[topic];
                        if ($._.$[sub]) {
                            $._.$[sub].unsubscribePubSub(topic, cb1);
                        } else {
                            const logMsg = 'Cannot unsubscribe: no connection';
                            $._.$.log && $._.$.log.debug(logMsg);
                            // No connection means implicitly unsubscribed
                            cb1(null);
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
            async.eachSeries(topicArray, function(topic, cb1) {
                unsubscribeImpl(topic, cb1);
            }, cb0);
        };


        /*
         * Publishes a message for a particular topic.
         *
         * @param {string} topic Channels to publish.
         * @param {string} message A message to publish.
         * @param {cbType} cb0 A callback to return publish errors.
         */
        that.publish = function(topic, message, cb0) {
            $._.$.log && $._.$.log.trace('PUBLISHED to topic ' + topic +
                                         ' message:' + message);
            $._.$[pub].publishPubSub(topic, message, cb0);
        };

        const super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
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

        return [null, that];
    } catch (err) {
        return [err];
    }
};
