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
 * Creates a (virtual) connection to a publish/subscribe service for this CA.
 * It provides transactional properties, buffering requests for this service
 * in a log until the message commits. It also checkpoints both the set of
 *  subscribed topics and the current log to allow transparent recovery during
 * failures or migration.
 *
 *  The name of this component in a ca.json description should be pubsub_ca.
 *
 * @name caf_pubsub/plug_ca_pubsub
 * @namespace
 * @augments gen_transactional
 */
var caf = require('caf_core');
var genTransactional = caf.gen_transactional;
var json_rpc = caf.json_rpc;

var publishOp = function(topic, value) {
    return {'op' : 'publish', 'topic' : topic, 'value' : value};
};

var subscribeOp = function(topic, methodName) {
    return {'op' : 'subscribe', 'topic' : topic, 'methodName' : methodName};
};

var unsubscribeOp = function(topic) {
    return {'op' : 'unsubscribe', 'topic' : topic};
};

exports.newInstance = function(context, spec, secrets, cb) {

    var $ = context;
    var subscribed = {};
    var logActions = [];

    var any = secrets.myId + '/*';

    var that = genTransactional.constructor(spec, secrets);

    that.publish = function(topic, value) {
        logActions.push(publishOp(topic, value));
    };

    that.subscribe = function(topic, methodName) {
        logActions.push(subscribeOp(topic, methodName));
    };

    that.unsubscribe = function(topic) {
        logActions.push(unsubscribeOp(topic));
    };

    that.__ca_init__ = function(cb0) {
        subscribed = {};
        logActions = [];
        cb0(null);
    };

    var replayLog = function() {
        for (var i = 0; i < logActions.length; i++) {
            var action = logActions[i];
            switch (action.op) {
            case 'publish' :
                $.pubsub_mux.publish(action.topic, action.value);
                break;
            case 'subscribe' :
                var methodName = action.methodName;
                subscribed[action.topic] = methodName;
                var notifyF = function(sameTopic, msg, cb0) {
                    var cb1 = function(err, data) {
                        if (err) {
                            cb0(err);
                        } else {
                            if (json_rpc.isSystemError(data)) {
                                // force unsubscribe
                                cb0(data);
                            } else {
                                // ignore application errors
                                cb0(err, data);
                            }
                        }
                    };
                    var notifMsg = json_rpc.request(json_rpc.SYSTEM_TOKEN,
                                                    secrets.myId,
                                                    json_rpc.SYSTEM_FROM,
                                                    json_rpc.SYSTEM_SESSION_ID,
                                                    methodName,
                                                    sameTopic,
                                                    msg);
                    secrets.inqMgr.process(notifMsg, cb1);
                };
                $.pubsub_mux.subscribe(action.topic, secrets.myId, notifyF);
                break;
            case 'unsubscribe' :
                var unsubscribeOneF = function(topic) {
                    if (subscribed[topic]) {
                        delete subscribed[topic];
                        $.pubsub_mux.unsubscribe(topic, secrets.myId);
                    }
                };
                if (action.topic) {
                    unsubscribeOneF(action.topic);
                } else {
                    // falsy means unsubscribe all
                    for (var topicName in subscribed) {
                        unsubscribeOneF(topicName);
                    }
                }
                break;
            default:
                throw new Error('Pubsub: invalid log action ' +
                                logActions[i].op);
            }
        }
        logActions = [];
    };

    var restore = function(target) {
      var result = [];
      for (var name in target) {
          result.push(unsubscribeOp(name));
      }
      for (name in target) {
          result.push(subscribeOp(name, target[name]));
      }
      return result;
    };

    that.__ca_resume__ = function(cp, cb0) {
        cp = cp || {};
        var restoreActions = restore(cp.subscribed || {});
        subscribed = cp.subscribed || {};
        logActions = restoreActions.concat(cp.logActions || []);
        replayLog();
        cb0(null);
    };

    that.__ca_begin__ = function(msg, cb0) {
        logActions = [];
        cb0(null);
    };

    that.__ca_prepare__ = function(cb0) {
        var dumpState = {
            'subscribed' : subscribed,
            'logActions' : logActions
        };
        cb0(null, JSON.stringify(dumpState));
    };

    that.__ca_commit__ = function(cb0) {
        replayLog();
        cb0(null);
    };

    that.__ca_abort__ = function(cb0) {
        logActions = [];
        cb0(null);
    };

    cb(null, that);
};
