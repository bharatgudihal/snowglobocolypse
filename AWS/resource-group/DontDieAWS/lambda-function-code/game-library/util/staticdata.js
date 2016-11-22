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

var util = require("./util.js");
var cloudCanvasSettings = require("../../CloudCanvas/settings.js");

// How long the WaitForLoad function waits before re-checking the data to see if it's loaded
var kWaitInterval = 10;

// S3 bucket that contains all of the static data
var kStaticDataBucket = cloudCanvasSettings.MainBucket;

// Folder in the S3 bucket where the static data is located
var kStaticDataFolder = "static-data/";

// This class handles loading CSV data from S3 that is intended to be shared across Lambda instances.
// When created, the object will load the specified file from S3, and systems that rely on that data
// can call WaitForLoad to delay until the data is ready.
exports.StaticData = function (file, onload) {
    
    this.file = file;

    // Waits until the data has been loaded
    this.WaitForLoad = function (dontDie, callback) {
        
        // If loading is now finished...
        if (this.loadingFinished) {
            
            // Cache the error since it may get wiped in the call to _Reset
            var error = this.loadError;
            
            // If there was an error, we reset our state
            if (error != null) {
                this._Reset();
            }

            return callback(error, dontDie);
        }
        
        // Wait for specified interval before rechecking if the data is loaded
        var staticData = this;
        setTimeout(function (dontDie, callback) { staticData.WaitForLoad(dontDie, callback); }, kWaitInterval, dontDie, callback);
    };
    
    // For csv data that has a Date and EndDate field, this function will do a binary search for the given date
    this.BinarySearchByDate = function (date) {
        
        // If we don't have any data not counting the header row, early out
        if (this.rawData.length <= 1) {
            return null;
        }

        var start = 1;
        var end = this.rawData.length - 1;
        var result = null;

        while (start <= end) {
            var pos = start + ~~((end - start) / 2);

            var csvRow = this.rawData[pos];
            var rowItem = this.data[ csvRow[0] ];
            var startDate = new Date(rowItem.Date);
            var endDate = null;
            
            // If we didn't specify an end date, take the start date and put it at the end of that day
            if (rowItem.EndDate == "") {
                endDate = new Date(startDate);
                endDate.setHours(23);
                endDate.setMinutes(59);
                endDate.setSeconds(59);
            }
            else {
                endDate = new Date(rowItem.EndDate);
            }
            
            if (date < startDate) {
                end = pos-1;
            }
            else if (date > endDate) {
                start = pos+1;
            }
            else {
                result = rowItem;
                break;
            }
        }

        return result;
    };
    
    // Resets all state for the static data
    this._Reset = function () {
        this.rawData = null;
        this.data = null;
        this.loadError = null;
        this.loadingFinished = false;
    };
    
    // Loads the data from S3 and parses out easy to use records
    this._Load = function ()
    {
        this._Reset();
        
        var staticData = this;
        
        util.LoadCSVFromS3(null, cloudCanvasSettings.MainBucket, kStaticDataFolder + file, function (err, dontDie, rawData) {
            staticData.rawData = rawData;
            staticData.data = {};
            staticData.loadError = err;
            
            if (err == null) {
                
                // Go through all of the CSV rows, skipping the header row
                for (var i = 1; i < rawData.length; ++i) {
                    var record = {};
                    
                    // Go through each header column, creating a record that has a key for each column name that maps
                    // to values in the current row
                    for (var j = 0; j < rawData[0].length; ++j) {
                        record[ rawData[0][j] ] = rawData[i][j];
                    }
                    
                    // Treat the first column as a primary key, creating a look up table by that value
                    staticData.data[ rawData[i][0] ] = record;
                }
            }
            
            if (onload != null) {
                onload(staticData);
            }
            
            staticData.loadingFinished = true;
        });
    }
    
    // Immediately load the given file
    this._Load();
};