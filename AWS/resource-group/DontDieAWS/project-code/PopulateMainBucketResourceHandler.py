#
# All or portions of this file Copyright (c) Amazon.com, Inc. or its affiliates or
# its licensors.
#
# For complete copyright and license terms please see the LICENSE at the root of this
# distribution (the "License"). All use of this software is governed by the License,
# or, if provided, by the license below or the license accompanying this file. Do not
# remove or modify any license notices. This file is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
#
import properties
import custom_resource_response
import boto3
import discovery_utils

static_data_folder = "static-data/"

bucket_data = dict()

bucket_data[static_data_folder + 'achievements.csv'] = """Name,CompletionCriteria,Description,ItemReward,CompletionText
Survival,player.LastScore >= 15,Survive for 15 seconds to get the Fancy Ship,FancyShip,Fancy Ship acquired!"""

bucket_data[static_data_folder + 'dailygift.csv'] = """Date,EndDate,GiftType1,GiftName1
12/6/2015,1/1/3015,mission,ShieldMission"""

bucket_data[static_data_folder + 'items.csv'] = """Name,Persist,Icon
Shield,false,levels/samples/dont_die/textures/spaceship_shield_01.dds
FancyShip,true,levels/samples/dont_die/textures/fancy_ship.dds"""

bucket_data[static_data_folder + 'messageoftheday.csv'] = """Date,EndDate,Message,Color
12/6/2015,1/1/2031,Message of the Day!,3"""

bucket_data[static_data_folder + 'missions.csv'] = """Name,CompletionText,Description,ItemReward,NumberOfGamesReq
ShieldMission,Shield acquired!,Complete 1 game to get the shield!,Shield,1"""

bucket_data[static_data_folder + 'gameproperties.csv'] = """GameProperty,Value
Ship Speed,20
Asteroid Min Size,8
Asteroid Max Size,15"""

bucket_data['highscores'] = '{ "scores": [ ] }'

def handler(event, context):  

    props = properties.load(event, {
        'MainBucket': properties.String()
        })
        
    s3 = boto3.client('s3')   
        
    if event['RequestType'] == 'Create':
        for file_name in bucket_data:
            s3.put_object(Bucket=props.MainBucket, Key=file_name, Body=bucket_data[file_name])     
    elif event['RequestType'] == 'Delete':
        for file_name in bucket_data:
            s3.delete_object(Bucket=props.MainBucket, Key=file_name)
            
    physical_id = 'CloudCanvas:PopulateMainBucket:{stack_name}'.format(stack_name=discovery_utils.get_stack_name_from_stack_arn(event['StackId']))
            
    return custom_resource_response.succeed(event, context, {}, physical_id)