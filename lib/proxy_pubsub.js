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
 *  Proxy that allows a CA to access a publish/subscribe service.
 *
 * Publishing is restricted to its own local space, e.g.,
 *  <my_name>/<whatever_topic>. An exception is the insecure channel
 *  that by default  has a prefix `anybody/`.
 *
 * Subscribing is unrestricted and to reduce visibility a publisher could
 * use hard to guess topic names that need to be explicitly communicated through
 * a side channel.
 * 
 * @name caf_pubsub/proxy_pubsub
 * @namespace
 * @augments gen_proxy
 */
var caf = require('caf_core');
var genProxy = caf.gen_proxy;

/**
 * Factory method to create a proxy to  a publish/subscribe service.
 * 
 */
exports.newInstance = function(context, spec, secrets, cb) {

    var that = genProxy.constructor(spec, secrets);
    var pubsub = secrets.pubsub_ca;
    var prefix = secrets.myId + '/';
    // non-authenticated channels use prefix insecureChannelPrefix
    var insecureChannelPrefix = (spec && spec.env &&
                                 spec.env.insecureChannelPrefix) || 'anybody/';

    var checkTopic = function(topic) {
        if (topic.indexOf(insecureChannelPrefix) === 0) {
            return;
        }
        if (topic.indexOf(prefix) !== 0) {
            throw new Error('Invalid topic ' + topic + ' should have prefix ' +
                            prefix);
        }
    };

    /**
     * Publishes a new value for a topic.
     * 
     * Topics are scoped by this CA's name, e.g.,
     * topic is of the form  <ca_name>/<whatever>. An exception is the
     * insecure channel that by default  has a prefix `anybody/`.
     * 
     * @param {string} topic A topic for the published data.
     * @param {string} value A value to be published.
     * 
     * @name caf_pubsub/proxy_pubsub#publish
     * @function 
     *
     */
    that.publish = function(topic, value) {
        checkTopic(topic);
        pubsub.publish(topic, value);
    };

    /**
     * Subscribes to a topic.
     * 
     * It also identifies  a method name in this CA with signature:
     * 
     *      function(topic:string, newValue:string, callback:caf.cb) 
     * 
     * that will process new published events in that topic. 
     * 
     * Note that pub/sub notifications use standard messages and,
     * therefore, they are serialized 
     * with the rest of the messages in the input queue.
     * 
     * @param {string} topic A  topic to subscribe.
     * @param {string} methodName A method name to handle new events
     * of that topic.
     * 
     * @name caf_pubsub/proxy_pubsub#subscribe
     * @function 
     */
    that.subscribe = function(topic, methodName) {
        pubsub.subscribe(topic, methodName);
    };

    /**
     * Unsubscribes from a topic (or all if topic is undefined)
     * 
     * @param {string=} topic A topic to unsubscribe (or all topics if
     * undefined).  
     * 
     * @name caf_pubsub/proxy_pubsub#unsubscribe
     * @function 
     */
    that.unsubscribe = function(topic) {
        pubsub.unsubscribe(topic);
    };

    Object.freeze(that);
    cb(null, that);

};
