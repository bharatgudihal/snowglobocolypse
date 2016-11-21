/*
*  All or portions of this file Copyright (c) Amazon.com, Inc. or its affiliates or
*  its licensors.
*
* For complete copyright and license terms please see the LICENSE at the root of this
* distribution (the "License"). All use of this software is governed by the License,
* or, if provided, by the license below or the license accompanying this file. Do not
* remove or modify any license notices. This file is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
*
*/
var async = require("async");
var dontDieModule = require("../../game-library/dontdie.js");

// Commands that the client can send to the Lambda
var commandRegistry = {
    
    "setupPlayer" : function (dontDie, event, callback) {
        if (event.username == null || event.favoriteColor == null) {
            return callback("Missing required data for setupPlayer command", dontDie);
        }
        
        var player = dontDie.systems.player;
        player.SetField("Username", event.username);
        player.SetField("FavoriteColor", event.favoriteColor);
        player.SetLoaded(true);
        callback(null, dontDie);
    },

    "startGame" : function (dontDie, event, callback) {
        dontDie.systems.player.StartGame(dontDie, callback);
    },

    "endGame" : function (dontDie, event, callback) {
        dontDie.systems.player.EndGame(dontDie, callback);
    },

    "getDailyGift" : function (dontDie, event, callback) {
        dontDie.systems.dailyGift.TryToGiveGift(dontDie, callback);
    },

    "getHighScoreTable": function (dontDie, event, callback) {
        dontDie.systems.highScoreTable.GetHighScores(dontDie, function (err, dontDie, highScores) {
            if (err != null) {
                return callback(err, dontDie);
            }

            dontDie.output.highScoreTable = highScores;
            return callback(null, dontDie);
        });
    },

    "getMessageOfTheDay": function (dontDie, event, callback) {
        dontDie.systems.messageOfTheDay.TryToGetMessageOfTheDay(dontDie, callback);
    },
    
    "getPlayerInfo" : function (dontDie, event, callback) {

        dontDie.output.getPlayerInfo = { };
        
        if (dontDie.systems.player.IsLoaded()) {
            favoriteColor = dontDie.systems.player.GetField("FavoriteColor");
            inventory = dontDie.systems.player.GetField("Inventory");

            if (favoriteColor != null) {
                dontDie.output.getPlayerInfo.favoriteColor = favoriteColor;
            }
            
            if (inventory != null) {
                dontDie.output.getPlayerInfo.inventory = inventory;
            }
            
            dontDie.output.getPlayerInfo.playerFound = "true";

            callback(null, dontDie);
        }
        else {
            dontDie.output.getPlayerInfo.playerFound = "false";
            callback(null, dontDie);
        }
    }
};

exports.handler = function (event, context) {
    
    if (!dontDieModule.util.IsIdentityValid(context)) {
        context.fail("Identity is not valid");
        return;
    }

    if (event.commands == null) {
        context.fail("No valid commands given");
        return;
    }

    var commandTasks = [null];
    
    // Go through each command, pushing a task for executing that command if it's a valid command.
    event.commands.forEach(function (commandName) {
        if (!(commandName in commandRegistry)) {
            context.fail("'" + commandName + "' is not a command");
            return;
        }

        console.log("Command: " + commandName);

        var command = commandRegistry[ commandName ];

        commandTasks.push(function (dontDie, callback) {
            command(dontDie, event, callback);
        });
    });
   
    var playerId = context.identity.cognitoIdentityId;
    var dontDie = new dontDieModule.DontDie(context, playerId);
    
    // Spin up a DontDie object
    dontDie.Start(function(err, dontDie) {
        
        if (err != null) {
            return dontDie.Finish(err);
        }
        
        commandTasks[0] = function (callback) {
            callback(null, dontDie);
        };
        
        // Execute all of the tasks passed up by the client
        async.waterfall(commandTasks, function (err, dontDie) { dontDie.Finish(err); } );
    });
};