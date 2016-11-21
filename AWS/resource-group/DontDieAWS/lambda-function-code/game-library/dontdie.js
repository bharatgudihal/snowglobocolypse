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

var systemModuleList = [
    "./game-systems/player.js",
    "./game-systems/missionmanager.js",
    "./game-systems/dailygift.js",
    "./game-systems/highscoretable.js",
    "./game-systems/itemmanager.js",
    "./game-systems/messageoftheday.js",
    "./game-systems/achievements.js"

    // Add new systems here
];

exports.util = require("./util/util.js");

// Main game class which ties together all of the game systems.  One DontDie object is intended for each
// Lambda execution (it should not be shared betweeen concurrently running lambdas).
exports.DontDie = function (lambdaContext, playerId) {
    
    this.lambdaContext = lambdaContext;
    this.playerId = playerId;
    this.systems = {};
    this.output = {};
    
    this.Start = function (callback) {
        var dontDie = this;
        var initTasks = [];
        
        // Loop through all of the modules and spin up the associated game system
        systemModuleList.forEach(function (moduleName) {
            var systemModule = require(moduleName);
            var system = systemModule.CreateSystem();
            
            dontDie.systems[ system.name ] = system;
            
            initTasks.push(system.Init.bind(system, dontDie));
        });
        
        async.parallel(initTasks, function (err, dontDies) {
            callback(err, dontDie);
        });
    };

    this.Finish = function (err) {
        
        if (err != null) {
            this.lambdaContext.fail(err);
            return;
        }
        
        var dontDie = this;
        
        // Loop through all of the systems, calling finish on each one.  The player system is a special case--we
        // always shut it down last to allow all other systems to make changes to player data while they shutdown.
        async.waterfall([
            function (callback) {
                
                var finishTasks = [];
                
                for (var systemName in dontDie.systems) {
                    
                    var system = dontDie.systems[systemName];

                    if (systemName != "player") {
                        finishTasks.push(system.Finish.bind(system, dontDie));
                    }
                }
                
                async.parallel(finishTasks, callback);
            },

            function (dontDies, callback) {
                var player = dontDie.systems.player;
                
                if (player != null) {
                    return player.Finish(dontDie, callback);
                }
                else {
                    return callback(null, dontDie);
                }
            }
        ],

        // Here we actually exit the Lambda either with success or failure
        function (err, dontDies) {
            
            if (err != null) {
                console.log(err);
                console.log("Failure!");
                dontDie.lambdaContext.fail(err);
                return;
            }

            console.log("Success!");
            dontDie.lambdaContext.succeed(dontDie.output);
        });
    }

};
