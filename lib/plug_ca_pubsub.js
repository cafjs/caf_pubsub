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
 * Creates a connection to a publish/subscribe service for this CA.
 *
 * It is transactional, delaying requests to this service until the message
 *  commits.
 *
 * It also keeps track of subscribed topics to provide transparent recovery
 * during failures or migration.
 *
 *
 * @module caf_pubsub/plug_ca_pubsub
 * @augments external:caf_components/gen_plug_ca
 */
// @ts-ignore: augments not attached to a class

const caf_comp = require('caf_components');
const myUtils = caf_comp.myUtils;
const genPlugCA = caf_comp.gen_plug_ca;
const json_rpc = require('caf_transport').json_rpc;
const async = caf_comp.async;

exports.newInstance = async function($, spec) {
    try {
        const that = genPlugCA.constructor($, spec);

        /*
         * The contents of this variable are always checkpointed before
         * any state externalization (see `gen_transactional`).
         *
         * `subscribed` key is {topic{string} : methodName{string}}
         */
        that.state = {subscribed: {}};

        /* Note that when this function propagates an error in callback,
         plug_pubsub will unsubscribe it, allowing GC */
        const deliverMsgF = function(topic, msg, cb0) {
            const cb1 = function(err, data) {
                if (err) {
                    cb0(err);
                } else {
                    /* We do not propagate the app error or exception
                     * in the callback because otherwise we would unsubscribe
                     * with, e.g., authorization failures, creating a denial of
                     * service.*/
                    if (data) {
                        if (json_rpc.isSystemError(data) ||
                            json_rpc.getAppReplyError(data)) {
                            const logMsg = 'Ignoring Error in pubsub handler ' +
                                      JSON.stringify(data);
                            $.ca.$.log && $.ca.$.log.debug(logMsg);
                        } else {
                            const logMsg = 'Ignoring pubsub value' +
                                      JSON.stringify(data);
                            $.ca.$.log && $.ca.$.log.trace(logMsg);
                        }
                    }
                    cb0(null);
                }
            };

            try {
                const methodName = that.state.subscribed[topic];
                if (that.__ca_isShutdown__) {
                    const err = new Error('pubsub: delivered to shutdown plug');
                    err['topic'] = topic;
                    err['msg'] = msg;
                    cb0(err);
                } else if (!methodName) {
                    const err = new Error('pubsub: Ignoring msg from '+
                                          ' unsubscribed channel');
                    err['topic'] = topic;
                    err['msg'] = msg;
                    // force unsubscribing to keep consistent
                    cb0(err);
                } else {
                    const notif = JSON.parse(msg);
                    const all = [
                        json_rpc.getToken(notif), // token
                        $.ca.__ca_getName__(), // to
                        json_rpc.getFrom(notif), // from
                        json_rpc.getSessionId(notif), //session
                        methodName // method
                    ].concat(json_rpc.getMethodArgs(notif)); // args

                    const req = json_rpc.request.apply(json_rpc.request, all);
                    $.ca.__ca_process__(req, cb1);
                }
            } catch (ex) {
                cb0(ex);
            }
        };

        // Hack for debugging
        deliverMsgF['caName'] = $.ca.__ca_getName__();

        // transactional ops
        const target = {
            publishImpl: function(topic, value, cb0) {
                const msg = json_rpc.notification(
                    topic, // to
                    $.ca.__ca_getName__(), // from
                    json_rpc.DEFAULT_SESSION, // session
                    'invalidMethod', //method
                    topic,
                    value
                );
                $._.$.pubsub.publish(topic, JSON.stringify(msg), cb0);
            },
            subscribeImpl: function(topic, methodName, cb0) {
                that.state.subscribed[topic] = methodName;
                $._.$.pubsub.subscribe(topic, deliverMsgF, cb0);
            },
            unsubscribeImpl: function(topic, cb0) {
                let all = [topic];
                if (topic === null) {
                    all = Object.keys(that.state.subscribed);
                    that.state.subscribed = {};
                } else {
                    delete that.state.subscribed[topic];
                }
                $._.$.pubsub.unsubscribe(all, deliverMsgF, cb0);
            }
        };

        that.__ca_setLogActionsTarget__(target);

        that.__ca_getName__ = function() {
            return $.ca.__ca_getName__();
        };

        // eslint-disable-next-line
        that.publish = function(topic, value) {
            const args = Array.prototype.slice.apply(arguments);
            that.__ca_lazyApply__('publishImpl', args);
        };

        // eslint-disable-next-line
        that.subscribe = function(topic, methodName) {
            const args = Array.prototype.slice.apply(arguments);
            that.__ca_lazyApply__('subscribeImpl', args);
        };

        that.unsubscribe = function(topic) {
            const args = Array.prototype.slice.apply(arguments);
            if (typeof topic === 'undefined') {
                // unsubscribe all
                args.push(null);
            }
            that.__ca_lazyApply__('unsubscribeImpl', args);
        };

        const super__ca_shutdown__ = myUtils.superior(that, '__ca_shutdown__');
        that.__ca_shutdown__ = function(data, cb0) {
            super__ca_shutdown__(data, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    $._.$.pubsub.unsubscribe(Object.keys(that.state.subscribed),
                                             deliverMsgF, cb0);
                }
            });
        };

        const super__ca_resume__ = myUtils.superior(that, '__ca_resume__');
        that.__ca_resume__ = function(cp, cb0) {
            //Backwards compatibility
            if (cp.subscribed && (!cp.state || !cp.state.subscribed)) {
                cp.state = cp.state || {};
                cp.state.subscribed = cp.subscribed;
            }

            super__ca_resume__(cp, function(err) {
                if (err) {
                    cb0(err);
                } else {
                    const topics = Object.keys(that.state.subscribed);
                    async.each(topics, function(topic, cb1) {
                        $._.$.pubsub.subscribe(topic, deliverMsgF, cb1);
                    }, cb0);
                }
            });
        };

        return [null, that];
    } catch (err) {
        return [err];
    }
};
