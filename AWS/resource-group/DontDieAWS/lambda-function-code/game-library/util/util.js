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

// All of the times in our data are treated as Pacific Time--this is so that designers don't have to
// think in terms of GMT.
var kPacificTimeZoneOffset = -8;
var kTimeZoneOffset = kPacificTimeZoneOffset;

// 3rd Party libraries
var async = require("async");

// AWS objects
var aws = require("aws-sdk");
aws.config.update({ logger : process.stdout });
var dynamoDoc = new aws.DynamoDB.DocumentClient();
var s3 = new aws.S3();

exports.s3 = s3;
exports.dynamoDoc = dynamoDoc;

// Checks to see if there is cognito identity data on the given context object
exports.IsIdentityValid = function (context) {
    return context.identity != null && context.identity.cognitoIdentityId != null;
}

// Calculates a date in PST
exports.GetCorrectedDate = function (includeTime) {
    
    var todaysDate = new Date();
    todaysDate = new Date(todaysDate.getUTCFullYear(), 
                          todaysDate.getUTCMonth(), 
                          todaysDate.getUTCDate(),
                          todaysDate.getUTCHours(),
                          todaysDate.getUTCMinutes(),
                          todaysDate.getUTCSeconds());
    
    todaysDate.setHours(todaysDate.getHours() + kTimeZoneOffset);
    
    if (includeTime == false) {
        todaysDate.setHours(0);
        todaysDate.setMinutes(0);
        todaysDate.setSeconds(0);
    }

    return todaysDate;
}

// Calculate a string from a date with appropriate padding with 0's 
// so that each string has the same number of digits
exports.GetFormattedDate = function (includeTime) {

    var currentDate = this.GetCorrectedDate(includeTime);
    var day = currentDate.getDate();
    var month = currentDate.getMonth() + 1;
    var year = currentDate.getFullYear();
    var result = '';
    
    if (day < 10) {
        day = '0' + day;
    }
    
    if (month < 10) {
        month = '0' + month;
    }
    
    var result = month + '-' + day + '-' + year;
    
    if (includeTime) {
        var hours = currentDate.getHours();
        var mins = currentDate.getMinutes();
        var secs = currentDate.getSeconds(); 

        if (hours < 10) {
            hours = '0' + hours;
        }
        
        if (mins < 10) {
            mins = '0' + mins;
        }
        
        if (secs < 10) {
            secs = '0' + secs;
        }

        result += ' ' + hours + ':' + mins + ':' + secs;
    }

    return result;
};

// Calculate the time delta in seconds between the two times
exports.GetElapsedTimeInSeconds = function (startTime, endTime) {
    var currentTime = new Date(endTime);
    var oldTime = new Date(startTime);
    var elapsed = currentTime - oldTime;
    
    return elapsed / 1000;
};

// Calculate the time delta in minutes between the two times
exports.GetElapsedTimeInMinutes = function (startTime, endTime) {
    return this.GetElapsedTimeInSeconds(startTime,endTime) / 60;
};

// Gets the specified dynamo item, and will also cache it on the dontDie game object
// for later use, but only for a particular execution of the Lambda--the cache is not
// shared between concurrently executing instances of the Lambda.
exports.GetDynamoItem = function(dontDie, tableName, keyName, keyValue, attributes, callback)
{
    // If we don't have a cache, create one.
    if (dontDie.getDynamoItemCache == null) {
        dontDie.getDynamoItemCache = {};
    }
    // If we do have a cache try to look up the specified record
    else {
        var tableCache = dontDie.getDynamoItemCache[tableName];

        if(tableCache != null)
        {
            var item = tableCache[keyValue];
            
            if (item != null) {
                return callback(null, dontDie, item);
            }
        }
    }
    
    // If it wasn't found in the cache, then we request the record from Dynamo
    var getItem = {};
    getItem.TableName = tableName;
    getItem.Key = {};
    getItem.Key[keyName] = keyValue;
    getItem.AttributesToGet = attributes;
        
    dynamoDoc.get(getItem, function (err, data) {
        if (err) {
            console.log(err);
            callback(err, dontDie);
            return;
        }
        
        // Cache the found record
        var tableCache = dontDie.getDynamoItemCache[tableName];
        
        if (tableCache == null) {
            tableCache = {};
            dontDie.getDynamoItemCache[tableName] = tableCache;
        }
        
        tableCache[keyValue] = data.Item;
        
        // Return that record back via the callback
        callback(null, dontDie, data.Item);
    });
}

// Saves an thing in the fields object that is referenced in the dirtyFields object into the specified Dynamo record
exports.SaveDynamoItem = function (dontDie, tableName, keyName, keyValue, fields, dirtyFields, callback) {
    
    // If there aren't any dirty fields, then there is nothing to update
    if (Object.keys(dirtyFields).length == 0) {
        return callback(null, dontDie);
    }
    
    var updateRequest = {};
    updateRequest.TableName = tableName;
    updateRequest.Key = {};
    updateRequest.Key[keyName] = keyValue;
    
    updateRequest.ExpressionAttributeValues = {};
    
    var updateExpression = "set";
    
    // Build an update expression from the given dirtyFields object
    for (var property in dirtyFields) {
        if (dirtyFields.hasOwnProperty(property)) {
            updateExpression += " " + property + " = :" + property + ",";
            updateRequest.ExpressionAttributeValues[":" + property] = fields[property];
        }
    }
    
    updateRequest.UpdateExpression = updateExpression.substring(0, updateExpression.length - 1);

    dynamoDoc.update(updateRequest, function (err, data) {
        return callback(err, dontDie);
    });
};

exports.ParseCSVData = function (dontDie, string_data, callback) {
    var i = 0;
    var csv_data = [];

    while (i < string_data.length) {
        i = this.ParseCSVLine(dontDie, string_data, i, csv_data);
    }
    
    callback(dontDie, null, csv_data);
};

exports.ParseCSVLine = function (dontDie, string_data, start, csv_data) {

    var i = start;
    var attributes = [];
    var quoteCount = 0;
    var attribute = "";

    while (i < string_data.length) {
        
        var c = string_data.charAt(i);
        
        if (c == '\n') {
            ++i;
            break;
        }
        else if (c == '"') {
            ++quoteCount;
            
            // First quote just denotes the beginning of this value, so skip it
            if (quoteCount > 1) {
                
                // Every even quote (not counting the first quote which just denotes the beginning of the value) 
                // is a quote that has been escaped, and is one that we want to keep
                if (((quoteCount-1) & 1) == 0) {
                    attribute += "\"";
                }
            }
        }
        else if (c == ',') {
            // If our quote count is even, then this comma is not within quotes,
            // and therefore marks the end of this value
            if ((quoteCount & 1) == 0) {
                attributes.push(attribute);
                attribute = "";
                quoteCount = 0;
            }
            else {
                attribute += c;
            }
        }
        else if (c != '\r') {
            attribute += c;
        }

        ++i;
    }
    
    attributes.push(attribute);
    csv_data.push(attributes);
    return i;
};

// Loads a CSV file from an S3 Bucket and parses it
exports.LoadCSVFromS3 = function (dontDie, bucket, key, callback) {
    
    var getCSVRequest = {};
    getCSVRequest.Bucket = bucket;
    getCSVRequest.Key = key;
    
    var util = this;

    async.waterfall(
        [
            function (callback) {
                s3.getObject(getCSVRequest, function (err, data) {
                    callback(err, dontDie, data);
                });
            },
            function (dontDie, data, callback)
            {
                var csvData = new Buffer(data.Body, "binary").toString();

                util.ParseCSVData(dontDie, csvData, function (dontDie, err, parsedData) 
                {
                    callback(err, dontDie, parsedData);
                });  
            }
        ],

    function (err, dontDie, data) {
        callback(err, dontDie, data);
    });
};