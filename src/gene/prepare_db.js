use gate;
db["stats"].insert({"_id": "DUMMY"});
db["stats"].remove({"_id": "DUMMY"});

use guard;

db["apps"].insert({"_id": "DUMMY"});
db["apps"].remove({"_id": "DUMMY"});
db["apps"].ensureIndex({deleted: 1});

db["messaging"].insert({"_id": "DUMMY"});
db["messaging"].remove({"_id": "DUMMY"});

db["subscription"].insert({"_id": "DUMMY"});
db["subscription"].remove({"_id": "DUMMY"});

db["users"].insert(
{
    "_id": ObjectId("524e2eb4bdd80c5b8b245e03"),
    "access_level" : NumberInt(0),
    "apps" : [],
    "company" : "MoonGene",
    "created" : ISODate("2013-10-04T22:50:05.075+20:00"),
    "email" : "mg-admin@moongene.com",
    "first_name" : "Admin",
    "inbox" : {
        "unread" : [],
        "all" : []
    },
    "key" : "lY5iF1380855005048",
    "last_login" : ISODate("2013-10-04T22:50:05.075+20:00"),
    "last_name" : "Istrator",
    "pass" : "4a055349fb392893d272ff24367ab42358231d27",
    "payments" : {
        "plan" : "MG_FREE",
        "plan_data" : "",
        "transactions" : [],
        "month_balances" : []
    },
    "salt" : "I8bd8ljP9IGIe6M0HGcPJO6w9GaFIT5L",
    "suspended" : false,
    "tokens" : []
});
db["users"].ensureIndex({email: 1, created: 1});


db["users"].insert(
{
    "_id" : ObjectId("525dea3e211ba9c4fe609002"),
    "access_level" : NumberInt(1),
    "apps" : [],
    "company" : "MoonGene",
    "created" : ISODate("2013-10-16T21:22:06.657+20:00"),
    "email" : "mg-support@moongene.com",
    "first_name" : "MoonGene",
    "inbox" : {
        "unread" : [],
        "all" : []
    },
    "key" : "ASIOO1381886526635",
    "last_login" : ISODate("2013-10-16T21:22:06.657+20:00"),
    "last_name" : "Support",
    "pass" : "bcb75b71426c5b01ccaa3d7a5475d35e28ca6cad",
    "payments" : {
        "plan" : "MG_FREE",
        "plan_data" : "",
        "transactions" : [],
        "month_balances" : []
    },
    "salt" : "oNJN9OohxXeJZ2YuxGxj4GJS7xiNxyuP",
    "suspended" : false,
    "tokens" : []
});

db["payments"].insert(
{
    "_id" : "PLANS",
    "plans" : [ 
        {
            "name" : "Free",
            "id" : "MG_FREE",
            "level" : NumberInt(0),
            "price" : NumberInt(0),
            "events" : NumberInt(20000),
            "features" : [ 
                "Unlimited Apps", 
                "iOS & Android", 
                "Basic Support"
            ]
        }, 
        {
            "name" : "Startup",
            "id" : "MG_STARTUP",
            "price" : NumberInt(6000),
            "level" : NumberInt(1),
            "events" : NumberInt(200000),
            "features" : [ 
                "Unlimited Apps", 
                "iOS & Android", 
                "Commercial Support"
            ]
        }, 
        {
            "name" : "Pro",
            "id" : "MG_PRO",
            "price" : NumberInt(15000),
            "level" : NumberInt(2),
            "events" : NumberInt(1000000),
            "features" : [ 
                "Unlimited Apps", 
                "iOS & Android", 
                "Commercial Support"
            ]
        }, 
        {
            "name" : "Business",
            "id" : "MG_BUSINESS",
            "price" : NumberInt(45000),
            "level" : NumberInt(3),
            "events" : NumberInt(4000000),
            "features" : [ 
                "Unlimited Apps", 
                "iOS & Android", 
                "Commercial Support"
            ]
        }, 
        {
            "name" : "Enterprise",
            "id" : "MG_ENTERPRISE",
            "price" : NumberInt(200000),
            "level" : NumberInt(4),
            "events" : NumberInt(20000000),
            "features" : [ 
                "Unlimited Apps", 
                "iOS & Android", 
                "Commercial Support"
            ]
        }, 
        {
            "name" : "Custom",
            "id" : "MG_CUSTOM",
            "price" : NumberInt(-1),
            "level" : NumberInt(5),
            "events" : NumberInt(-1),
            "features" : [ 
                "Unlimited Apps", 
                "iOS & Android", 
                "SLA", 
                "On & Off Premise"
            ]
        }
    ]
});

