Gene, Core and Load Modules
=========
Gene & Core and the 2 modules that are responsible for collecting and analysing incoming data.
Load App is also available to do load tests and prefill database with artificial values for testing.

REQUIREMENTS
------------

- SBT for Scala
- Java 6 and higher

CONFIGURATION
-------------
Folder src/main/resources includes config files for different modules.
Mainly only IP addresses need to be changed for the first launch. See
AKKA documention for more details on Cluster configuration.

MongoDB instance, either local or networked must be also available. The following databases must be created:
gate
guard
health

Use prepare_db.js to precreate all necessary collections and documents.

LAUNCH
------

With compilation:
On Windows use runModule batch files, modify if needed to launch with different config files.
On Linux use sbt -Dconfig.resource=gene/gene.dev.conf "run-main com.moongene.Gene", where instead of Gene can be Core or Load modules.

Without compilation:
Use bin/gene one-jar modules