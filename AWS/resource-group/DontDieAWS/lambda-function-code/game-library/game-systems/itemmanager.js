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
var cloudCanvasSettings = require("../../CloudCanvas/settings.js");

var staticDataModule = require("../util/staticdata.js");
var items = new staticDataModule.StaticData("items.csv");

exports.CreateSystem = function () {
    return new this.ItemManager();
}

// Simple game system that holds onto item data and provides a way to get item data
exports.ItemManager = function ()
{
    this.name = "itemManager";

    this.Init = function (dontDie, callback) {
        items.WaitForLoad(dontDie, callback);
    };
    
    this.GetItem = function (dontDie, itemName, callback) {
        var item = items.data[itemName];
        var error = item == null ? "Item not found" : null;
        callback(error, dontDie, item);
    };
    
    this.Finish = function (dontDie, callback) {
        callback(null, dontDie);
    };
}
