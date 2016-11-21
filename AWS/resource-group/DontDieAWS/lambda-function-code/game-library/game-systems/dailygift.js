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
var dailyGifts = new staticDataModule.StaticData("dailygift.csv");

exports.CreateSystem = function () {
    return new this.DailyGift();
}

// Game System for a simple Daily Gift system.  Gifts can be missions or items.  Gifts can be given all day, or just at
// a certain time range of the day.  You can give multiple gifts in a given time range, but time ranges can not overlap.
exports.DailyGift = function () {
    
    this.name = "dailyGift";

    this.Init = function (dontDie, callback) {
        dailyGifts.WaitForLoad(dontDie, callback);
    };
    
    this.TryToGiveGift = function (dontDie, callback) {
        
        // There needs to be a player for us to give a gift to
        if (!dontDie.systems.player.IsLoaded()) {
            return callback("PlayerNotLoaded", dontDie);
        }
        
        var dailyGift = this;
        
        async.waterfall(
            [
                function (callback) {
                    dailyGift.GetTodaysGift(dontDie, callback);
                },

                function (dontDie, gift, callback) {
                    // If there is currently no daily gift, bail
                    if (gift == null) {
                        return callback(null, dontDie, false);
                    }
                    
                    var lastDailyGiftTime = dontDie.systems.player.GetField("LastDailyGiftTime");
                    
                    // If we have gotten a gift before, make sure that it didn't fall in this gift's range
                    if (lastDailyGiftTime != null) {
                        
                        var lastDailyGiftTimeDate = new Date(lastDailyGiftTime);
                        var startDate = new Date(gift.Date);
                        var endDate = new Date(gift.EndDate);

                        if (startDate <= lastDailyGiftTimeDate && endDate >= lastDailyGiftTimeDate) {
                            return callback(null, dontDie, false);
                        }
                    }
                    
                    var i = 1;
                    var giftTasks = [];
                    
                    // Create a granting task for each gift in this record
                    while(gift["GiftName" + i] != null && gift["GiftName" + i] != "") {
                        
                        var giftName = gift["GiftName" + i];
                        var giftType = gift["GiftType" + i];
                        
                        giftTasks.push(dailyGift._GrantGift.bind(dailyGift, dontDie, giftType, giftName));

                        ++i;
                    }
                    
                    // Complete gift tasks in parallel
                    async.parallel(giftTasks, function (err) {
                        callback(err, dontDie, true);
                    });
                },
        
                function (dontDie, giftGiven, callback) {
                    
                    if (giftGiven) {
                        dontDie.systems.player.SetField("LastDailyGiftTime", util.GetFormattedDate(true));
                    }
                    
                    return callback(null, dontDie);
                }
            ],

            callback);
    };

    this.GetTodaysGift = function (dontDie, callback) {
        var todaysDate = util.GetCorrectedDate(true);
        var gift = dailyGifts.BinarySearchByDate(todaysDate);
        callback(null, dontDie, gift);
    };
    
    this._GrantGift = function(dontDie, giftType, giftName, callback)
    {
        // If the gift is an item, add it to the player's inventory
        if (giftType == "item") {
            
            playerSystem.AddUpdate(dontDie, title, desc, achievement.ItemReward, itemData.icon, callback);
        }
        // If it's a mission, start the mission
        else if (giftType == "mission") {
            dontDie.systems.missionManager.StartMission(dontDie, giftName, function (err, data) {
                callback(null, dontDie, err == null);
            });
        }
        else {
            return callback("Error, daily gift type not specified");
        }
    }

    this.Finish = function (dontDie, callback) {
        callback(null, dontDie);
    };

}