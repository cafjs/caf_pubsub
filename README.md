# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Extra Lib publish/subscribe

This repository contains a CAF extra lib to implement a publish subscribe bus using Redis.


## API

    lib/proxy_pubsub.js

See the Moody example application.
 
## Configuration Example

### framework.json

       "plugs": [
        {
            "module": "caf_pubsub/plug",
            "name": "pubsub_mux",
            "description": "Shared connection to a pub/sub service \n Properties: \n",
            "env": {

            }
        },
        ...
                

### ca.json

    "internal" : [
         {
            "module": "caf_pubsub/plug_ca",
            "name": "pubsub_ca",
            "description": "Provides a publish/subscription service for this CA",
            "env" : {
            
            }
        }, 
        ...
     ]
     "proxies" : [
        {
            "module": "caf_pubsub/proxy",
            "name": "pubsub",
            "description": "Access to a publish subscribe service\n Properties: \n insecureChannelPrefix: Prefix for a channel anybody can publish",
            "env" : {
               "insecureChannelPrefix": "anybody/"
            }
        },
        ...
      ]
  
  
    
        
            
 
