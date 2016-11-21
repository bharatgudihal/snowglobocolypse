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
var cloudCanvasSettings = require("../../CloudCanvas/settings.js");

var kMaxHighScores = 10;
var kS3Bucket = cloudCanvasSettings.MainBucket;
var kS3Key = "highscores";

exports.CreateSystem = function() {
    return new this.HighScoreTable();
}

// Game System that tracks high score data in S3
exports.HighScoreTable = function () {
    
    this.name = "highScoreTable";

    this.Init = function (dontDie, callback) {
        this.dirty = false;
        this.highScores = {};
        this._loaded = false;

        callback(null, dontDie);
    };

    this.Finish = function (dontDie, callback) {
        
        if (!this.dirty) {
            callback(null, dontDie);
            return;
        }
        
        var setHighscoreRequest = {};
        setHighscoreRequest.Bucket = kS3Bucket;
        setHighscoreRequest.Key = kS3Key;
        setHighscoreRequest.Body = JSON.stringify(this.highScores, null, 4);
        
        /*
        TODO: As Preston pointed out:
  
        There is a race condition here.
        Say there are 2 players submitting high scores and this ordering hapens:

        Player1's lambda reads high score object
        Player2's lambda reads high score object
        Player1's lambda writes high score object
        Player2's lambda writes high score object

        Now player 1's high score is gone.

        */ 

        var highScoreTable = this;

        util.s3.upload(setHighscoreRequest, function (err, data) {
            if (err) {
                console.log("Could not save highscore list");
                callback(err, dontDie);
                return;
            }
            else {
                highScoreTable.dirty = false;
                callback(null, dontDie);
                return;
            }
        });
    };
    
    // Pulls the high score data from S3 if it's not already loaded
    this.GetHighScores = function (dontDie, callback) {
        
        if (this._loaded) {
            return callback(null, dontDie, this.highScores);
        }
        
        var getHighscoreRequest = {};
        getHighscoreRequest.Bucket = kS3Bucket;
        getHighscoreRequest.Key = kS3Key;
        
        var highScoreTable = this;
        
        util.s3.getObject(getHighscoreRequest, function (err, data) {
            if (err) {
                if (err.code == "NoSuchKey") {
                    console.log("Highscore file does not exist in S3. Creating...");
                    highScoreTable.highScores.scores = [];
                }
                else {
                    console.log("Could not retrieve highscore list");
                    callback(err, dontDie, null);
                    return;
                }
            }
            else {
                highScoreTable.highScores = JSON.parse(data.Body);
            }
            
            this._loaded = true;
            callback(null, dontDie, highScoreTable.highScores);
        });
    };
    
    // Adds the given username and score to the high score data if that score makes the cut
    this.TryToAddScore = function (dontDie, username, score, color, callback) {
        
        if (username == null || score == null || color == null) {
            return callback("Invalid inputs for TryToAddScore", dontDie);
        }

        var highScoreTable = this;

        async.waterfall([
            function (callback) {
                highScoreTable.GetHighScores(dontDie, callback);
            },

            function (dontDie, highScores, callback) {
                
                // If we have maxed out our number of high scores...
                if (highScores.scores.length >= kMaxHighScores) {
                    
                    var lowestScore = highScores.scores.slice(-1)[0].Score;

                    // If the given score isn't better than the lowest score, then bail
                    if (score <= lowestScore) {
                        callback(null, dontDie, false);
                        return;
                    }
                    // Otherwise, drop the lowest score in preparation for adding the new score
                    else {
                        highScores.scores.pop();
                    }
                }
                
                var scoreRecord = {};
                scoreRecord.Score = score;
                scoreRecord.Username = username;
                scoreRecord.Color = color;
                
                // Add the new score record and sort
                highScores.scores.push(scoreRecord);
                highScores.scores.sort(function (scoreRecordA, scoreRecordB) { return scoreRecordB.Score - scoreRecordA.Score });
                
                // Mark the high score table as dirty so that the high score data will be saved out to S3
                highScoreTable.dirty = true;
                
                callback(null, dontDie, true);
            }
        ],
        
        callback);
    };
};