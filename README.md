# CAF (Cloud Assistant Framework)

Co-design permanent, active, stateful, reliable cloud proxies with your web app.

See http://www.cafjs.com 

## CAF Lib publish/subscribe

[![Build Status](http://ci.cafjs.com/api/badges/cafjs/caf_pubsub/status.svg)](http://ci.cafjs.com/cafjs/caf_pubsub)

This repository contains a CAF library  that implements a publish/subscribe bus with, e.g., Redis.

## API

    lib/proxy_pubsub.js

 
## Configuration Example

        {
            "name": "cp",
            "module" : "caf_redis#plug",
            "description" : "Checkpointing service",
            ....
        },
        {
            "name": "cp2",
            "module" : "caf_redis#plug",
            "description" : "Checkpointing service",
            ...
        },
        {
            "name": "pubsub",
            "module": "caf_pubsub#plug",
            "description": "Publish/Subscribe service.",
            "env" : {
                "publishService" : "cp",
                "subscribeService" : "cp2"
            }
        }

        
We need two connections to the Redis backend to support concurrent publish and subscribe operations.


### ca.json

        {
            "module": "caf_pubsub#plug_ca",
            "name": "pubsub",
            "description": "Manages a Pub/Sub service for a CA",
            "env" : {
                "maxRetries" : "$._.env.maxRetries",
                "retryDelay" : "$._.env.retryDelay"
            },
            "components" : [
                {
                    "module": "caf_pubsub#proxy",
                    "name": "proxy",
                    "description": "Allows access to this CA Pub/Sub service",
                    "env" : {
                    }
                }
            ]
        }
  
  
    
        
            
 
