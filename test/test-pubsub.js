"use strict"


var hello = require('./hello/main.js');
var app = hello;

var caf_core= require('caf_core');
var caf_comp = caf_core.caf_components;
var myUtils = caf_comp.myUtils;
var async = caf_comp.async;
var cli = caf_core.caf_cli;

var crypto = require('crypto');

var CA_OWNER_1='other1pubsub'+ crypto.randomBytes(8).toString('hex');
var CA_LOCAL_NAME_1='bar1pubsub';
var FROM_1 =  CA_OWNER_1 + '-' + CA_LOCAL_NAME_1;

var CA_OWNER_2='other2pubsub'+ crypto.randomBytes(8).toString('hex');
var CA_LOCAL_NAME_2='bar2pubsub';
var FROM_2 =  CA_OWNER_2 + '-' + CA_LOCAL_NAME_2;

var CA_OWNER_3='other3pubsub'+ crypto.randomBytes(8).toString('hex');
var CA_LOCAL_NAME_3='bar3pubsub';
var FROM_3 =  CA_OWNER_3 + '-' + CA_LOCAL_NAME_3;

var TOPIC1 = 'forum-topic1';
var TOPIC2 = 'forum-topic2';
var TOPIC3 = 'forum-topic3';

var HANDLER1 = 'handler1';
var HANDLER2 = 'handler2';
var HANDLER_EXCEPTION = 'handlerException';

var MSG1 = 'hello1';
var MSG2 = 'hello2';
var MSG3 = 'hello3';

process.on('uncaughtException', function (err) {
               console.log("Uncaught Exception: " + err);
               console.log(myUtils.errToPrettyStr(err));
               process.exit(1);

});

module.exports = {
    setUp: function (cb) {
       var self = this;
        app.init( {name: 'top'}, 'framework.json', null,
                      function(err, $) {
                          if (err) {
                              console.log('setUP Error' + err);
                              console.log('setUP Error $' + $);
                              // ignore errors here, check in method
                              cb(null);
                          } else {
                              self.$ = $;
                              cb(err, $);
                          }
                      });
    },
    tearDown: function (cb) {
        var self = this;
        if (!this.$) {
            cb(null);
        } else {
            this.$.top.__ca_graceful_shutdown__(null, cb);
        }
    },

    pubsub: function(test) {
        var self = this;
        var s1, s2, s3;
        var from1 = FROM_1;
        var from2 = FROM_2;
        var from3 = FROM_3;

        test.expect(40);
        async.series(
            [
                function(cb) {
                    s1 = new cli.Session('ws://foo-xx.vcap.me:3000', from1, {
                        from : from1
                    });
                    s1.onopen = function() {
                        s1.subscribe(TOPIC1, HANDLER1, cb);
                    };
                },
                function(cb) {
                    s2 = new cli.Session('ws://foo-xx.vcap.me:3000', from2, {
                        from : from2
                    });
                    s2.onopen = function() {
                        s2.subscribe(TOPIC1, HANDLER2, cb);
                    };
                },
                function(cb) {
                    s3 = new cli.Session('ws://foo-xx.vcap.me:3000', from3, {
                        from : from3
                    });
                    s3.onopen = function() {
                        s3.publish(TOPIC1, MSG1 , cb);
                    };
                },
                
                // 1. publish ok with different handlers 

                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG1, state.h1[TOPIC1]);
                        test.ok(!state.h2[TOPIC1]);
                        cb(null);
                    });                    
                },
                function(cb) {
                    s2.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG1, state.h2[TOPIC1]);
                        test.ok(!state.h1[TOPIC1]);
                        cb(null);
                    });                    
                },
                
                // 2. when it fails with exception it does not publish

                function(cb) {
                    var cb1 = function(err) {
                        test.ok(err);
                        cb(null);
                    };
                    s3.publishFail(TOPIC1, MSG2 , cb1);
                },
                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG1, state.h1[TOPIC1]);
                        test.ok(!state.h2[TOPIC1]);
                        cb(null);
                    });                    
                },
                
                // 3. unsubscribe works
                
                function(cb) {
                    s1.unsubscribe(TOPIC1, cb);
                },
                function(cb) {
                    s3.publish(TOPIC1, MSG2 , cb);
                },
                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG1, state.h1[TOPIC1]);
                        test.ok(!state.h2[TOPIC1]);
                        cb(null);
                    });                    
                },
                function(cb) {
                    s2.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG2, state.h2[TOPIC1]);
                        test.ok(!state.h1[TOPIC1]);
                        cb(null);
                    });                    
                },
                function(cb) {
                     s2.unsubscribe(TOPIC1, cb);
                },
                 function(cb) {
                    s3.publish(TOPIC2, MSG2 , cb);
                },
                // 4. subscribe with different topics
                
                function(cb) {
                    s1.subscribe(TOPIC2, HANDLER1, cb);
                },
                function(cb) {
                    s2.subscribe(TOPIC1, HANDLER2, cb);
                },
                function(cb) {
                    s3.publish(TOPIC2, MSG2 , cb);
                },
                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG2, state.h1[TOPIC2]);
                        test.ok(!state.h2[TOPIC2]);
                        cb(null);
                    });                    
                },
                function(cb) {
                    s2.getState(function(err, state) {
                        test.ifError(err);
                        test.ok(!state.h1[TOPIC2]);
                        test.ok(!state.h2[TOPIC2]);
                        cb(null);
                    });                    
                },
                
                // 5. subscribe with concurrent topics, TOPIC1+TOPIC2 in s1
                
                function(cb) {
                    s1.subscribe(TOPIC1, HANDLER1, cb);
                },                
                function(cb) {
                    s3.publish(TOPIC1, MSG1 , cb);
                },
                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG1, state.h1[TOPIC1]);
                        test.ok(!state.h2[TOPIC1]);
                        cb(null);
                    });                    
                },
                
                //6. unsubscribe all

                function(cb) {
                    s1.unsubscribe(null, cb);
                },
                function(cb) {
                    s3.publish(TOPIC1, MSG2 , cb);
                },
                function(cb) {
                    s3.publish(TOPIC2, MSG2 , cb);
                },
                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.equals(MSG1, state.h1[TOPIC1]);
                        test.ok(!state.h2[TOPIC1]);
                        cb(null);
                    });                    
                },
                
                //7. cannot publish to private channels

                function(cb) {
                    var cb1 = function(err) {
                        test.ok(false);
                        cb(null);
                    };
                    s3.onclose = function(err) {
                        test.ok(err);
                        cb(null);
                    };
                    s3.publish(FROM_2+'-topic', MSG2 , cb1);
                },
                function(cb) {
                    s3 = new cli.Session('ws://foo-xx.vcap.me:3000', from3, {
                        from : from3
                    });
                    s3.onopen = function() {
                        cb(null);
                    };
                },
                function(cb) {
                    var cb1 = function(err) {
                        test.ok(false);
                        cb(null);
                    };
                    s3.onclose = function(err) {
                        test.ok(err);
                        cb(null);
                    };
                    // unqualified topic fails
                    s3.publish('topic', MSG2 , cb1);
                },
                function(cb) {
                    s3 = new cli.Session('ws://foo-xx.vcap.me:3000', from3, {
                        from : from3
                    });
                    s3.onopen = function() {
                        cb(null);
                    };
                },                
                function(cb) {
                    //ok to owned ones
                    s3.publish(FROM_3+'-topic', MSG2 , cb);
                },                
                
                //8. Exception in handler unsubscribes
                function(cb) {
                    s2.subscribe(TOPIC3, HANDLER_EXCEPTION, cb);
                },
                function(cb) {
                    s1.subscribe(TOPIC3, HANDLER_EXCEPTION, cb);
                },
                function(cb) {
                    //ok to owned ones
                    s3.publish(TOPIC3, MSG3 , cb);
                },                
                function(cb) {
                    s1.getState(function(err, state) {
                        test.ifError(err);
                        test.ok(!state.h1[TOPIC3]);
                        test.ok(!state.h2[TOPIC3]);
                        cb(null);
                    });                    
                },
                function(cb) {
                    s2.getState(function(err, state) {
                        test.ifError(err);
                        test.ok(!state.h1[TOPIC3]);
                        test.ok(!state.h2[TOPIC3]);
                        cb(null);
                    });                    
                },
                
                // cleanup
                
                function(cb) {
                    s1.onclose = function(err) {
                        test.ifError(err);
                        cb(null, null);
                    };
                    s1.close();
                },
                function(cb) {
                    s2.onclose = function(err) {
                        test.ifError(err);
                        cb(null, null);
                    };
                    s2.close();
                },
                function(cb) {
                    s3.onclose = function(err) {
                        test.ifError(err);
                        cb(null, null);
                    };
                    s3.close();
                }
            ], function(err, res) {
                test.ifError(err);
                test.done();
            });
    }


};
