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
var util = require("../util/util.js");

var staticDataModule = require("../util/staticdata.js");
var missions = new staticDataModule.StaticData("missions.csv");

exports.CreateSystem = function () {
    return new this.MissionManager();
}

// Game System that tracks an active mission for completion criteria.  Note: there can only be one active mission at a time.
exports.MissionManager = function () {
    
    this.name = "missionManager";

    this.Init = function (dontDie, callback) {
        missions.WaitForLoad(dontDie, callback);
    };
    
    // Attempts to begin the specified mission
    this.StartMission = function (dontDie, missionId, callback) {
        
        // Without a player, there isn't anyone to start the mission
        if (!dontDie.systems.player.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }
        
        // Only one mission is allowed to be active at a time
        if (dontDie.systems.player.HasActiveMission()) {
            callback("AlreadyHasMission", dontDie);
            return;
        }
        
        var missionManager = this;
        
        async.waterfall([
            function (callback) {
                // Grab the mission data
                missionManager.GetMission(dontDie, missionId, callback);
            },

            function (dontDie, missionData, callback) {
                if (missionData == null) {
                    callback("MissionNotFound");
                    return;
                }
                
                var activeMission = {
                    "MissionId" : missionId,
                    "NumGamesCompleted" : 0
                };
                
                // Tell the client that we started a mission
                dontDie.output.player.mission = {
                    status : "Start",
                    missionData : missionData,
                    activeMissionData : activeMission
                };
                
                // Set the active mission in the player record
                dontDie.systems.player.SetField("ActiveMission", activeMission);
                
                callback(null, dontDie);
            }
        ],

        callback);

    };
    
    // Update the active mission, checking for completion
    this.UpdateActiveMission = function (dontDie, callback) {

        var player = dontDie.systems.player;
        
        // Without a player, there isn't anyone to update a mission
        if (!player.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }
        
        // We have to have an active mission in order to update one
        if (!player.HasActiveMission()) {
            return callback(null, dontDie);
        }
        
        var missionManager = this;
        var activeMission = player.GetField("ActiveMission");
        
        // Check completion criteria for completed x number of games
        if (player.GameJustEnded()) {
            ++activeMission.NumGamesCompleted;
            player.SetField("ActiveMission", activeMission);
        }
        
        async.waterfall([
            function (callback) {
                // Grab the mission data
                missionManager.GetMission(dontDie, activeMission.MissionId, callback);
            },

            function (dontDie, missionData, callback) {
                
                // If criteria is met, complete the mission
                if (missionManager._IsMissionCriteriaMet(player, missionData)) {
                    missionManager.CompleteMission(dontDie, missionData, callback);
                }
                else {
                    
                    // If the mission is not completed, tell the client the mission is still in progress
                    if (!("mission" in dontDie.output.player)) {
                        dontDie.output.player.mission = {
                            status : "InProgress",
                            missionData : missionData
                        };
                    }
                    
                    dontDie.output.player.mission.activeMissionData = activeMission;
                    
                    callback(null, dontDie);
                }
            }
        ],

    callback);
    };
    
    // Checks mission criteria specified in the mission data to see if we can complete the mission
    this._IsMissionCriteriaMet = function (player, missionData) {
        
        var activeMission = player.GetField("ActiveMission");
        
        return activeMission != null && activeMission.NumGamesCompleted >= parseInt(missionData.NumberOfGamesReq);
    };
    
    // Actually completes the given mission
    this.CompleteMission = function (dontDie, missionData, callback) {
        
        var player = dontDie.systems.player;
        
        // Without a player, we can complete a mission
        if (!player.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }
        
        // Tell the client that we just completed a mission
        dontDie.output.player.mission = {
            status : "Complete",
            missionData : missionData
        };
        
        var rewardData = 
        {
            "title": "Mission Complete!", 
            "desc" : missionData.CompletionText, 
            "reward" : "",
            "rewardIcon" : ""
        };
        
        // Reset the active mission in the player's record
        player.SetField("ActiveMission", {}); 
        
        var title = "Mission Complete!";
        var desc = missionData.CompletionText;

        // If the mission has an item reward, grant it to the player now
        if (missionData.ItemReward != "") {
            
            dontDie.systems.itemManager.GetItem(dontDie, missionData.ItemReward, function (err, dontDie, itemData) {

                player.AddUpdate(dontDie, title, desc, missionData.ItemReward, itemData.icon, callback);
            });
        }
        else {
            player.AddUpdate(dontDie, title, desc, null, null, callback);
        }

    };
    
    // Get a mission for the loaded mission data
    this.GetMission = function (dontDie, missionId, callback) {
        var mission = missions.data[missionId];
        var error = mission == null ? "Mission not found" : null;
        callback(error, dontDie, mission);
    };
    
    this.Finish = function (dontDie, callback) {
        
        // If a player isn't loaded, we can't do anything
        if (!dontDie.systems.player.IsLoaded()) {
            return callback(null, dontDie);
        }
        
        // Try to update the mission if one is active
        this.UpdateActiveMission(dontDie, callback);
    };
};