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
 *  Proxy that allows a CA to access a publish/subscribe service.
 *
 * @module caf_pubsub/proxy_pubsub
 * @augments external:caf_components/gen_proxy
 */
// @ts-ignore: augments not attached to a class
const caf_comp = require('caf_components');
const genProxy = caf_comp.gen_proxy;
const json_rpc = require('caf_transport').json_rpc;

exports.newInstance = async function($, spec) {

    const that = genProxy.create($, spec);

    that.FORUM_PREFIX = 'forum' + json_rpc.NAME_SEPARATOR;

    const personalPrefix = $._.__ca_getName__() + json_rpc.NAME_SEPARATOR;

    const checkTopic = function(topic) {
        if ((topic.indexOf(that.FORUM_PREFIX) !== 0) &&
            (topic.indexOf(personalPrefix) !== 0)) {
            const err = new Error('Invalid topic ' + topic +
                                  ' should have prefix ' +
                                  personalPrefix + ' or forum-');
            err['topic'] = topic;
            throw err;
        }
    };

    /**
     * Publishes a new value for a topic in a pubsub channel.
     *
     * The channel is implicitly created the first time is used.
     *
     * There are two types of channels:
     *
     *   - A personal channel is prefixed by the CA name, i.e.,
     * `<ca_name>-<whatever>`, and only that CA  can publish messages.
     *   - A forum channel has a name of the form `forum-<whatever>`,  and
     * anybody can publish to it.
     *
     * @param {string} topic A topic for the published message. It should have
     * a prefix `<ca_name>-` or `forum-` depending on the type of channel.
     * @param {string} value A message to be published.
     *
     * @throws Error If topic has an invalid prefix.
     *
     * @memberof! module:caf_pubsub/proxy_pubsub#
     * @alias publish
     */
    that.publish = function(topic, value) {
        checkTopic(topic);
        $._.publish(topic, value);
    };

    /**
     * Subscribes to a topic.
     *
     * It also identifies  a method name in this CA with signature:
     *
     *      function(topic:string, value:string, from: string, callback:cbType)
     *                           or
     *      async function(topic:string, value:string, from: string)
     *
     * that will process published events using that topic.
     *
     * Note that pub/sub notifications use standard messages and
     * standard method ACLs can be applied to restrict publishers.
     *
     * It is recommended to use an **internal** method, i.e., one that starts
     * with prefix `__ca_`.  Internal methods are safer because requests always
     * come from the trusted
     * bus and not from external sessions, i.e., the request came
     * from a call to `publish()` in the app, and not from arbitrary code.
     *
     * Note that `this.$.security.getCallerFrom()` does not provide the real
     * caller for internal methods, use the `from` argument instead.
     *
     * @param {string} topic A  topic to subscribe.
     * @param {string} methodName A method name to handle new events
     * of that topic. See the discussion on internal methods above.
     *
     * @memberof! module:caf_pubsub/proxy_pubsub#
     * @alias subscribe
     */
    that.subscribe = function(topic, methodName) {
        $._.subscribe(topic, methodName);
    };

    /**
     * Unsubscribes from a topic (or all if topic is undefined)
     *
     * @param {string=} topic A topic to unsubscribe (or all
     * topics if `undefined`).
     *
     * @memberof! module:caf_pubsub/proxy_pubsub#
     * @alias unsubscribe
     */
    that.unsubscribe = function(topic) {
        $._.unsubscribe(topic);
    };

    Object.freeze(that);
    return [null, that];
};
