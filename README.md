HackerClubProjectOne
====================

Currently in development:
------------------------
* Node REST HTTP API server with Mongo database

Dependencies
------------
* Node (see http://nodejs.org)
* npm - node package manager
* MongoDb
* npm install flatiron
* npm install union
* npm install mongojs

Instructions
------------
* Start the mongo database process:

    sudo mongod

* Start the node server:

    node main.js

* Hit the node server with some requests using these commands:

List all audit data:
curl -i -H "Content-type: application/json" -X GET http://localhost:8082/audit

Add some audit data:
curl -i -H "Content-type: application/json" -X POST http://localhost:8082/audit -d '{"visitor":{"name":"Garrett","age":"30"}}'

Get all events:
curl -i -H "Content-type: application/json" -X GET http://localhost:8082/events

Loading localhost:8082 in your brower will create an event.  Try re-loading the page and then running the curl command again to see the results.
