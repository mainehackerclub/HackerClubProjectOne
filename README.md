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

* Hit the node server with a request, using this curl command:

    curl -i -H "Content-type: application/json" -X POST -d '{"message":"hello world"}' http://localhost:8082

This will hit display output from the node process running on your machine, as well as insert a record into the Mongo database.

Add your "I was here" message below
-----------------------------------

Slashthedragon was here.

Hello World! Well I should say: Hello Hacker Club!
This is Zack Schiller. I am just testing out this whole GitHub commit stuff.
Here I go...

This is Garrett committing from my linode server at http://hc1.goodnyou.me.
