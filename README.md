# Caf.js

Co-design cloud assistants with your web app and IoT devices.

See https://www.cafjs.com

## Library to Access a Publish/Subscribe Bus

[![Build Status](https://github.com/cafjs/caf_pubsub/actions/workflows/push.yml/badge.svg)](https://github.com/cafjs/caf_pubsub/actions/workflows/push.yml)

This repository contains a `Caf.js` library that implements a publish/subscribe bus using, for example, a `Redis` backend.

There are two types of channels:

 * A *private channel* name is prefixed by the CA name, i.e., `<ca_name>-<whatever>`, and only that CA can publish messages.

 * A *forum channel* has a name of the form `forum-<whatever>`, and anybody can publish to it. However, subscribers can filter publishers using method ACLs, since pubsub messages are always processed by invoking a CA method. This method is chosen by the subscriber.

Anybody can subscribe to a channel if they know its name, and we recommend to use hard to guess channel names to limit visibility.

The delivery guarantees depend on the pubsub backend service. `Redis`, for example, is best effort. However, when the plugin has committed to publish a message, it will retry after a CA or node.js process crash.

A pubsub service complements well a `SharedMap` (see {@link external:caf_sharing}). `SharedMaps` are silently updated, and this makes them very efficient when shared by many CAs. Messages generated by a pubsub service are processed by subscribed CAs and, for example, can trigger external actions. By combining them, we can get the right mix of silent updates vs external actions.

`Caf.js` discourages `point-to-point` communication between CAs. At the network infrastructure level, `point-to-point` becomes `all-to-all` very quickly, limiting the scalability of the system.

However, if you really need `point-to-point`, you can always use a *private pubsub channel*, or write a new plugin...

Instead, applications should expose higher-level communication patterns to improve scalability. These patterns can then be implemented efficiently with specialized services, such as `SharedMap` or `pubsub`. This approach is common for HPC applications that, for example, use MPI collective communication calls.

### Hello World (see `examples/helloworld`)

The following example has a privileged CA, i.e., `admin`, that regularly publishes messages in a private channel. CAs with the same owner subscribe to this channel, and the handler function notifies clients using sessions (see {@link external:caf_session}).

```
exports.methods = {
    async __ca_init__() {
        this.state.counter = 0;
        this.$.pubsub.subscribe(masterChannel(this), 'handleMessage');
        return [];
    },
    async __ca_pulse__() {
        if (isAdmin(this)) {
            this.state.counter = this.state.counter + 1;
            this.$.pubsub.publish(masterChannel(this),
                                  'Counter: ' + this.state.counter);
        }
        return [];
    },
    async handleMessage(topic, msg) {
        this.$.log && this.$.log.debug('Got ' + msg);
        this.$.session.notify([msg]);
        return [];
    }
}
```

A couple of helper functions for naming:

```
const ADMIN_CA = 'admin';
const ADMIN_CHANNEL = 'myNews';
const isAdmin = function(self) {
    const name = self.__ca_getName__();
    return (caf.splitName(name)[1] === ADMIN_CA);
};
const masterChannel = function(self) {
    const name = self.__ca_getName__();
    return caf.joinName(caf.splitName(name)[0], ADMIN_CA, ADMIN_CHANNEL);
};
```

See the client code in `examples/helloworld/client1.js`

## API

See {@link module:caf_pubsub/proxy_pubsub}

## Configuration

### framework.json

See {@link module:caf_pubsub/plug_pubsub}

### ca.json

See {@link module:caf_pubsub/plug_ca_pubsub}
