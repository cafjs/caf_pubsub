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
 * multiplexes them for all the CAs in this node.js process instance.
 *
 *  The name of this component in framework.json should be pubsub_mux.
 */

var caf = require('caf_core');
var genPlug = caf.gen_plug;
var async = caf.async;
var redis = caf.redis;
//redis.debug_mode = true;

/**
 * Factory method to create a pubsub service connector.
 */
exports.newInstance = function(context, spec, secrets, cb) {


    var $ = context;
    $.log && $.log.debug('New PubSub plug');
    var allTopics = {};

    var that = genPlug.constructor(spec, secrets);

    var config = $.cf.getServiceConfig('redis');
    var pubRedis = redis.createClient(config.port, config.hostname);
    var subRedis = redis.createClient(config.port, config.hostname);

    var newErrorHandler = function(clientRedis) {
        return function(err) {
            $.log && $.log.trace('Fatal pubsub redis connection error to ' +
                                 JSON.stringify(config) + ' ' + err);
            if (that.isShutdown) {
                clientRedis.closing = true; // do not retry
            } else {
                that.shutdown($, function(null_error, sameThat) {
                                  cb(err, sameThat);
                              });
            }
        };
    };
    pubRedis.on('error', newErrorHandler(pubRedis));
    subRedis.on('error', newErrorHandler(subRedis));

    subRedis.on('message', function(topic, message) {
                    $.log && $.log.trace('GOT subscribed topic ' + topic +
                                          ' msg:' + message);
                    var allCAs = allTopics[topic];
                    for (var caId in allCAs) {
                        var notifyF = allCAs[caId];
                        var cleanupF = function(id) {
                            return function(error, data) {
                                if (error) {
                                    // LOG and ignore the error
                                    $.log && $.log.trace('ERROR delivering' +
                                                         ' subscribe message ' +
                                                         JSON
                                                         .stringify(message) +
                                                         ' for topic:' +
                                                         topic + ' to CA:' +
                                                         id + ' err:' +
                                                         JSON.stringify(error));
//                                    that.unsubscribe(topic, id);
                                }
                            };
                        };
                        notifyF(topic, message, cleanupF(caId));
                    }
                });

    /**
     * Subscribes a CA to receive messages of a particular topic.
     *
     * @param {string} topic Channel to subscribe.
     * @param {string} caId CA unique identifier.
     * @param {function(string, function(err, data))} notifyF Callback.
     *  function to notify
     *  the CA of a new message in the channel. If notifyF
     *  is no longer valid the callback is invoked with an error argument.
     */
    that.subscribe = function(topic, caId, notifyF) {
        var allCAs = allTopics[topic];
        if (allCAs) {
            allCAs[caId] = notifyF;
        } else {
            allCAs = {};
            allCAs[caId] = notifyF;
            allTopics[topic] = allCAs;
            $.log && $.log.trace('SUBSCRIBED to topic ' + topic);
            subRedis.subscribe(topic);
        }
    };

    /**
     *  Unsubscribes a CA from a topic.
     *
     */
    that.unsubscribe = function(topic, caId) {
        var allCAs = allTopics[topic];
        if (allCAs) {
            delete allCAs[caId];
            if (Object.keys(allCAs).length === 0) {
                delete allTopics[topic];
                $.log && $.log.trace('UNSUBSCRIBED to topic ' + topic);
                subRedis.unsubscribe(topic);
            }
        }
    };

    /**
     * Publishes a message for a particular topic.
     */
    that.publish = function(topic, message) {
        $.log && $.log.trace('PUBLISHED to topic ' + topic + ' message:' +
                             message);
        pubRedis.publish(topic, message);
    };

    var super_shutdown = that.superior('shutdown');
    that.shutdown = function(ctx, cb0) {
        $.log && $.log.trace('SHUTDOWN plug_pub');
        if (that.isShutdown) {
            // do nothing, return OK
            cb0(null, that);
        } else {
            pubRedis && pubRedis.quit();
            subRedis && subRedis.quit();
            super_shutdown(ctx, cb0);
        }
    };

    async.map([pubRedis, subRedis], function(clientRedis, cb0) {
                  clientRedis.auth(config.password, cb0);
              },
              function(err, ignored) {
                  if (err) {
                      $.log && $.log.trace('Fatal pubsub authentication error');
                      that.shutdown($, function(null_error, sameThat) {
                                        cb(err, sameThat);
                                    });
                  } else {
                      cb(null, that);
                  }
              });
};
