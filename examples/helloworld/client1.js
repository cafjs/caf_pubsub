'use strict';
/* eslint-disable  no-console */

var caf_core = require('caf_core');
var json_rpc = caf_core.caf_transport.json_rpc;
var caf_comp = caf_core.caf_components;
var myUtils = caf_comp.myUtils;
var caf_cli = caf_core.caf_cli;

/* `from` CA needs to be the same as target `ca` to enable creation, i.e.,
 *  only owners can create CAs.
 *
 *  With security on, we would need a token to authenticate `from`.
 */
var URL = 'http://root-hellopubsub.vcap.me:3000/#from=foo-admin&ca=foo-admin';

var s = new caf_cli.Session(URL);

s.onopen = function() {
    setTimeout(function() {
        console.log('Time expired!');
        s.close();
    }, 20000);
};

s.onmessage = function(msg) {
    var notif = json_rpc.getMethodArgs(msg)[0];
    console.log('Got notification in client1:' + notif);
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
    console.log('Done OK');
};
