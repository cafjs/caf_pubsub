'use strict';
/* eslint-disable  no-console */

const caf_core = require('caf_core');
const caf_comp = caf_core.caf_components;
const myUtils = caf_comp.myUtils;
const caf_cli = caf_core.caf_cli;

/* `from` CA needs to be the same as target `ca` to enable creation, i.e.,
 *  only owners can create CAs.
 *
 *  With security on, we would need a token to authenticate `from`.
 */
/* eslint-disable max-len */
const URL = 'http://root-hellopubsub.localtest.me:3000/#from=foo-admin&ca=foo-admin';

const s = new caf_cli.Session(URL);

s.onopen = function() {
    setTimeout(function() {
        console.log('Time expired!');
        s.close();
    }, 20000);
};

s.onmessage = function(msg) {
    const notif = caf_cli.getMethodArgs(msg)[0];
    console.log('Got notification in client1:' + notif);
};

s.onclose = function(err) {
    if (err) {
        console.log(myUtils.errToPrettyStr(err));
        process.exit(1);
    }
    console.log('Done OK');
};
