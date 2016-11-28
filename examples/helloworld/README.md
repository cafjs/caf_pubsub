`client1.js` starts `admin` CA that publishes messages. It also subscribes to them.

`client2.js` starts `ca1` CA that subscribes to them.

When the client times out, and then we retry after a while, the pending notifications are not lost. They have been collected by the CA, and pushed to the client when it reconnects. See `caf_session` for details.
