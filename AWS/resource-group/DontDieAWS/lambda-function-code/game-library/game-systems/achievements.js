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
var util = require('../util/util.js');
var async = require('async');

var staticDataModule = require("../util/staticdata.js");

var kAchievementBeingTracked = "Survival";
var kTestName = "AchievementTest";

var achievementsData = new staticDataModule.StaticData("achievements.csv");

exports.CreateSystem = function() {
    return new this.Achievements();
}

// Game system for a simple achievement system.  Criteria for achievements are specified in the achievements
// data as small pieces of javascript, allowing for a lot of flexibility.
exports.Achievements = function () {
    
    this.name = "achievements";

    this.Init = function (dontDie, callback) {
        achievementsData.WaitForLoad(dontDie, callback);
    };
    
    this.Finish = function (dontDie, callback) {
        
        var player = dontDie.systems.player;

        if (!player.IsLoaded()) {
            return callback(null, dontDie);
        }

        var tasks = [];

        for (var achievementName in achievementsData.data) {
            tasks.push(function (callback) {
                grantAchievementIfCriteriaMet(dontDie, achievementsData.data[achievementName], callback);
            })
        }
        
        async.parallel(tasks, function (err) {
            callback(err, dontDie);
        });
    };
    
    var grantAchievementIfCriteriaMet = function (dontDie, achievement, callback) {
        
        var playerSystem = dontDie.systems.player;
        var playerAchievements = playerSystem.GetField("Achievements");
        
        if (playerAchievements == null) {
            playerAchievements = {};
        }
        else if (playerAchievements[achievement.Name] != null) {
            return callback(null, dontDie);
        }

        //Pull player into the local context so we can use it in our achievement evaluations
        var player = dontDie.systems.player._fields;
        var grantAchievement = false;

        try {
            grantAchievement = eval(achievement.CompletionCriteria);
        }
        catch (e) {
            return callback(null, dontDie);
        }
        
        //Only grant the achievement if the player doesn't already ahve it
        if (grantAchievement) {
            console.log("Granting achievement: " + achievement.Name);
            
            playerAchievements[achievement.Name] = 1;
            playerSystem.SetField("Achievements", playerAchievements);
            
            var title = "Achievement Unlocked!";
            var desc = achievement.CompletionText;

            if (achievement.ItemReward) {

                dontDie.systems.itemManager.GetItem(dontDie, achievement.ItemReward, function (err, dontDie, itemData) {
                            
                    if (err != null) {
                        return callback(err, dontDie);
                    }

                    playerSystem.AddUpdate(dontDie, title, desc, achievement.ItemReward, itemData.icon, callback);
                });
            }
            else {
                
                playerSystem.AddUpdate(dontDie, title, desc, null, null, callback);
            }
        }
        else {
            callback(null, dontDie);
        }
    };

};