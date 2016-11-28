## Running the examples

First install `devDependencies`. In top `caf_ca/` dir:

    npm install

Second, run locally a `redis-server` instance at the default port 6379 with no password. In ubuntu:

    apt-get install redis-server

and then, for example,  in the `examples/helloworld` directory:

    node ca_methods.js

to start the server at port 3000, and

    node client1.js
    node client2.js

to run the client code.
