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
var messages = new staticDataModule.StaticData("messageoftheday.csv");

exports.CreateSystem = function () {
    return new this.MessageOfTheDay();
}

// Game system that tracks a message of the day
exports.MessageOfTheDay = function () {
    this.name = "messageOfTheDay";
    
    this.Init = function (dontDie, callback) {
        messages.WaitForLoad(dontDie, callback);
    };
    
    this.Finish = function (dontDie, callback) {
        callback(null, dontDie);
    }
    
    // Looks for a message of the day and outputs it to the client if one was found
    this.TryToGetMessageOfTheDay = function (dontDie, callback) {
        var messageOfTheDay = this;
        
        async.waterfall(
            [
                function (callback) {
                    // Look up today's message
                    messageOfTheDay.GetTodaysMessage(dontDie, callback);
                },

                function (dontDie, messageData, callback) {
                    // If we didn't have a message, then one isn't set for today
                    if (messageData == null) {
                        callback(null, dontDie);
                    } 
                    else {
                        
                        // Tell the client about the message
                        var messageOfTheDayData = {
                            message: messageData.Message,
                            color: messageData.Color
                        };
                        dontDie.output.messageOfTheDay = messageOfTheDayData;
                        
                        callback(null, dontDie);
                    }
                    return;
                }
            ],

        callback);
    };
    
    // Look up today's message in the loaded message data
    this.GetTodaysMessage = function (dontDie, callback) {
        var todaysDate = util.GetCorrectedDate(true);
        var todaysMessage = messages.BinarySearchByDate(todaysDate);
        callback(null, dontDie, todaysMessage);
    }
}