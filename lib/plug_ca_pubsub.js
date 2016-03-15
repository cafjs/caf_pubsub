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
 *
 * It is transactional, delaying requests to this service until the message
 *  commits. 
 *
 * It also keeps track of subscribed topics to provide transparent recovery 
 * during failures or migration.
 *
 *
 * @name caf_pubsub/plug_ca_pubsub
 * @namespace
 * @augments caf_components/gen_plug_ca
 */

var caf_comp = require('caf_components');
var myUtils = caf_comp.myUtils;
var genPlugCA = caf_comp.gen_plug_ca;
var json_rpc = require('caf_transport').json_rpc;
var async = caf_comp.async;


/**
 * Factory method to create a plug for this CA's pubsub service.
 *
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {
    try {
        // {topic{string} : methodName{string}}
        var subscribed = {};
        
        var that = genPlugCA.constructor($, spec);

        /* Note that when this function propagates an error in callback,
         plug_pubsub will unsubscribe it, allowing GC */
        var deliverMsgF = function(topic, msg, cb0) {
            try { 
                var methodName = subscribed[topic];
                if (methodName) {                
                    var cb1 = function(err, data) {
                        if (err) {
                            cb0(err);
                        } else {
                            if (data && (json_rpc.isSystemError(data) ||
                                         json_rpc.getAppReplyError(data))) {
                                cb0(data);
                            } else {                            
                                data && $.ca.$.log &&
                                    $.ca.$.log.trace('Ignoring pubsub  value' +
                                                     JSON.stringify(data));
                                cb0(null);
                            }
                        }
                    };
                    if (that.__ca_isShutdown__) {
                        var err = new Error('pubsub: deliver to shutdown plug');
                        err.topic = topic;
                        err.msg = msg;
                        cb0(err);
                    } else {
                        var notif = JSON.parse(msg);
                        var all = [
                            json_rpc.getToken(notif), // token
                            $.ca.__ca_getName__(),  // to
                            json_rpc.getFrom(notif), // from
                            json_rpc.getSessionId(notif), //session
                            methodName // method
                        ].concat(json_rpc.getMethodArgs(notif)); // args
                        
                        var req = json_rpc.request.apply(json_rpc.request, all);
                        $.ca.__ca_process__(req, cb1);
                    }
                } else {
                    err = new Error('pubsub: Ignoring msg from unsubscribed' +
                                    ' channel');
                    err.topic = topic;
                    err.msg = msg;
                    // force unsubscribing to keep consistent
                    cb0(err);
                }
            } catch (ex) {
                cb0(ex);
            }
        };

        // for debugging
        deliverMsgF.caName = $.ca.__ca_getName__();

            // transactional ops
        var target = {
            publishImpl: function(topic, value, cb0) {
                var msg = json_rpc
                        .notification(topic, // to
                                      $.ca.__ca_getName__(), // from
                                      json_rpc.DEFAULT_SESSION, // session
                                      'invalidMethod', //method
                                      topic,
                                      value);
                $._.$.pubsub.publish(topic, JSON.stringify(msg), cb0);
            },
            subscribeImpl: function(topic, methodName, cb0) {
                subscribed[topic] = methodName;
                $._.$.pubsub.subscribe(topic, deliverMsgF, cb0);                
            },
            unsubscribeImpl: function(topic, cb0) {
                var all = [topic];
                if (topic === null) {
                    all = Object.keys(subscribed);
                    subscribed = {};
                } else {
                    delete subscribed[topic];
                }
                $._.$.pubsub.unsubscribe(all, deliverMsgF, cb0);
            }
        };
       
        that.__ca_setLogActionsTarget__(target);

        that.__ca_getName__ = function() {
            return $.ca.__ca_getName__();
        };

        that.publish = function(topic, value) {
            var args = Array.prototype.slice.apply(arguments);
            that.__ca_lazyApply__("publishImpl", args);
        };

        that.subscribe = function(topic, methodName) {
            var args = Array.prototype.slice.apply(arguments);
            that.__ca_lazyApply__("subscribeImpl", args);            
        };

        that.unsubscribe = function(topic) {
            var args = Array.prototype.slice.apply(arguments);
            if (typeof topic === 'undefined') {
                // unsubscribe all
                args.push(null);
            }
            that.__ca_lazyApply__("unsubscribeImpl", args);            
        };

        var super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    $._.$.pubsub.unsubscribe(Object.keys(subscribed),
                                             deliverMsgF, cb0);
                }
            });
        };
        
        var super__ca_resume__ = myUtils.superior(that, '__ca_resume__');
        that.__ca_resume__ = function(cp, cb0) {
            subscribed = cp.subscribed;
            super__ca_resume__(cp, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    async.eachSeries(Object.keys(subscribed), function(topic,
                                                                       cb1) {
                        $._.$.pubsub.subscribe(topic, deliverMsgF, cb1);
                    }, cb0);
                };
            });
        };
        
        var super__ca_prepare__ = myUtils.superior(that, '__ca_prepare__');
        that.__ca_prepare__ = function(cb0) {
            super__ca_prepare__(function(err, data) {
                if (err) {
                    cb0(err, data);
                } else {
                    data.subscribed = subscribed;
                    cb0(err, data);
                }
            });
        };
        
        cb(null, that);        
    } catch (err) {
        cb(err);
    }
};
