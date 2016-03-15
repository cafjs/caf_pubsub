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
 * There are two types of channels:
 *
 *   - A personal channel is prefixed by the CA name, i.e., 
 * '<ca_name>-<whatever>', and only that CA  can publish messages.
 * 
 *   - A forum channel has a name of the form 'forum-<whatever>',  and anybody
 *  can publish to it. However, subscribers can filter publishers using method
 *  ACLs, since pubsub messages are processed by invoking a CA method selected 
 * by the recipient.
 *
 * Currently, anybody can subscribe to a channel if they know its name, and we 
 * use hard to guess channel names to limit visibility.  
 * 
 * @name caf_pubsub/proxy_pubsub
 * @namespace
 * @augments caf_components/gen_proxy
 */
var caf_comp = require('caf_components');
var genProxy = caf_comp.gen_proxy;
var json_rpc = require('caf_transport').json_rpc;

/**
 * Factory method to create a proxy to  a publish/subscribe service.
 * 
 * @see caf_components/supervisor
 */
exports.newInstance = function($, spec, cb) {

    var that = genProxy.constructor($, spec);
    
    that.FORUM_PREFIX = 'forum' + json_rpc.NAME_SEPARATOR;

    var personalPrefix = $._.__ca_getName__() + json_rpc.NAME_SEPARATOR;

    var checkTopic = function(topic) {
        if ((topic.indexOf(that.FORUM_PREFIX) !== 0) && 
            (topic.indexOf(personalPrefix) !== 0)) {
            var err = new Error('Invalid topic ' + topic +
                                ' should have prefix ' +
                                personalPrefix + ' or forum-');
            err.topic = topic;
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
     * '<ca_name>-<whatever>', and only that CA  can publish messages. 
     *   - A forum channel has a name of the form 'forum-<whatever>',  and 
     * anybody can publish to it. 
     * 
     * @param {string} topic A topic for the published message. It should have 
     * a prefix '<ca_name>-' or 'forum-' depending on the type of channel. 
     * @param {string} value A message to be published.
     * 
     * @throws Error If topic has an invalid prefix.
     *
     * @name caf_pubsub/proxy_pubsub#publish
     * @function 
     *
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
     *      function(topic:string, value:string, callback:caf.cb) 
     * 
     * that will process new published events in that topic. 
     * 
     * Note that pub/sub notifications use standard messages and,
     * therefore, standard method ACLs can be applied to restrict publishers.
     * 
     * @param {string} topic A  topic to subscribe.
     * @param {string} methodName A method name to handle new events
     * of that topic.
     * 
     * @name caf_pubsub/proxy_pubsub#subscribe
     * @function 
     */
    that.subscribe = function(topic, methodName) {
        $._.subscribe(topic, methodName);
    };

    /**
     * Unsubscribes from a topic (or all if topic is undefined)
     * 
     * @param {string|null|undefined} topic A topic to unsubscribe (or all
     * topics if undefined or null).  
     * 
     * @name caf_pubsub/proxy_pubsub#unsubscribe
     * @function 
     */
    that.unsubscribe = function(topic) {
        $._.unsubscribe(topic);
    };

    Object.freeze(that);
    cb(null, that);

};
