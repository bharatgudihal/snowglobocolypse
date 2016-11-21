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

var async = require('async');
var util = require("../util/util.js");
var cloudCanvasSettings = require("../../CloudCanvas/settings.js");
var kPlayerTableHashKey = "PlayerID";
var kPlayerFields = ["StartGameTime", 
                     "EndGameTime", 
                     "Username", 
                     "LastDailyGiftTime", 
                     "Inventory", 
                     "ActiveMission", 
                     "TotalScore", 
                     "LastScore", 
                     "Achievements",
                     "FavoriteColor"];

exports.CreateSystem = function ()
{
    return new this.Player();
}

// Game System that represents the player playing the game.  Persisted player data is stored in the Player Table,
// and cached in memory in the _fields variable.  Changing of fields should be done through SetField, which will
// handle setting fields to dirty so that they will be written back out to Dynamo when the Lambda finishes.
exports.Player = function ()
{
    this.name = "player";

    this.Init = function (dontDie, callback) {
        
        this.dontDie = dontDie;
        this.playerId = dontDie.playerId;
        this._nonPersistedInventory = [];       // Perishable items that are not persisted (ie: the shield)
        this._gameStarted = false;              // Flag set after a new game has started (ie: player has been dropped back in the game world)
        this._gameEnded = false;                // Flag set after a game has ended (ie: player just died)
        this._loaded = false;                   // Flag set if LoadData completes successfully
        this._dirtyFields = {};                 // Tracks what fields have changed
        this._fields = {};                      // Data for each column of the player table record

        dontDie.output.player = {};
        dontDie.output.player.updates = [];

        // If we have a player Id, load data for the player now
        if (this.playerId != null) {
            this.LoadData(dontDie, callback);
        }
        else {
            callback(null, dontDie);
        }
    };
    
    this.Finish = function (dontDie, callback) {
        
        if (!this.IsLoaded()) {
            return callback(null, dontDie);
        }

        // Save any changed data to the player table
        util.SaveDynamoItem(dontDie, cloudCanvasSettings.PlayerTable, kPlayerTableHashKey, this.playerId, this._fields, this._dirtyFields, callback);
    };
    
    this.IsLoaded = function () {
        return this._loaded;
    };
    
    this.SetLoaded = function (loaded) {
        this._loaded = loaded;
    }

    this.GetField = function (fieldName) {
        return this._fields[fieldName];
    };
    
    this.SetField = function (fieldName, value) {
        this._fields[fieldName] = value;
        this.SetFieldDirty(fieldName);
    };

    this.SetFieldDirty = function (fieldName) {
        this._dirtyFields[fieldName] = 1;
    };
    
    this.HasDirtyFields = function () {
        return Object.keys(this._dirtyFields).length > 0;
    };

    // Loads the player's data from the Player Table if it hasn't already been loaded
    this.LoadData = function (dontDie, callback) {
        
        if (!this.IsLoaded()) {
            
            var player = this;
            
            async.waterfall([
                function (callback) {
                    util.GetDynamoItem(dontDie, cloudCanvasSettings.PlayerTable, kPlayerTableHashKey, player.playerId, kPlayerFields, callback);
                },
                function (dontDie, fieldData, callback) {
                    player._loaded = fieldData != null;
                    player._fields = fieldData != null ? fieldData : { };
                    callback(null, dontDie);
                }
            ],
            
            function (err, dontDie) {
                if (err != null) {
                    player._loaded = false;
                }

                callback(err, dontDie, player._fields);
            });
        }
        else {
            callback(null, dontDie, player._fields);
        }
    };

    this.HasActiveMission = function () {
        var activeMission = this.GetField("ActiveMission");
        return activeMission != null && Object.keys(activeMission).length > 0;
    };
    
    this.AddUpdate = function (dontDie, title, desc, itemName, itemIcon, callback) {
        
        var update = {
            "title": title,
            "desc" : desc,
            "item" : itemName,
            "itemIcon" : itemIcon
        };

        dontDie.output.player.updates.push(update);

        if (itemName != null) {
            this.AddToInventory(dontDie, itemName, callback);
        }
        else {
            callback(null, dontDie);
        }
    };

    // Adds the given item to the player's inventory
    this.AddToInventory = function (dontDie, itemName, callback) {
        
        if (!this.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }

        var player = this;
        
        async.waterfall([
            function (callback) {
                dontDie.systems.itemManager.GetItem(dontDie, itemName, callback);
            },
            function (dontDie, itemData, callback) {
                if (itemData.Persist == "true") {
                    var inventory = player.GetField("Inventory");
                    
                    if (inventory == null) {
                        inventory = [];
                    }

                    inventory.push(itemName);
                    player.SetField("Inventory", inventory);
                }
                else {
                    player._nonPersistedInventory.push(itemName);
                }
                
                callback(null, dontDie);
            }
        ],
        
        callback);
    };
    
    // Marks the start of a game, ie, the player has just started playing
    this.StartGame = function (dontDie, callback) {
        
        if (!this.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }

        this.SetField("StartGameTime", util.GetFormattedDate(true));

        this._gameStarted = true;
        callback(null, dontDie);
    };
    
    // Marks the end of a game, ie, the player has just died
    this.EndGame = function (dontDie, callback) {
        
        if (!this.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }
        
        // Mark that the game has just ended
        this._gameEnded = true;

        // Update the player's EndTime, TotalScore, and lastScore
        this.SetField("EndGameTime", util.GetFormattedDate(true));
        var score = util.GetElapsedTimeInSeconds(this.GetField("StartGameTime"), this.GetField("EndGameTime"));
        
        var totalScore = this.GetField("TotalScore");
        if (totalScore == null) {
            totalScore = 0;
        }

        this.SetField("TotalScore", totalScore + score);
        this.SetField("LastScore", score);
        
        var highScoreTable = dontDie.systems.highScoreTable;
        var player = this;

        // Try to add the player's score to the high score table
        highScoreTable.TryToAddScore(dontDie, this.GetField("Username"), score, this.GetField("FavoriteColor"), function (err, dontDie, addedToHighScoreTable) {
            
            if (err != null) {
                return callback(err, dontDie);
            }
            else {
                
                // Tell the client some details about the game ending
                var endGameInfo = {}; 
                endGameInfo.score = score;
                endGameInfo.madeHighScoreTable = addedToHighScoreTable.toString();
                endGameInfo.endGameTime = player.GetField("EndGameTime");
                dontDie.output.player.endGameInfo = endGameInfo;

                return callback(null, dontDie);
            }
  
        });
    };
    
    this.GameJustStarted = function () {
        return this._gameStarted;
    };
    
    this.GameJustEnded = function () {
        return this._gameEnded;
    };

}