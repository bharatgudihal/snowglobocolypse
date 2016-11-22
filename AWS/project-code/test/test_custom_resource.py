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
# $Revision: #7 $

import unittest
import mock
import os
import sys

import custom_resource

import DeploymentConfigurationResourceHandler
import ResourceGroupConfigurationResourceHandler
import AccessResourceHandler
import PlayerAccessResourceHandler
import LambdaConfigurationResourceHandler

test_handler_calls = []

class TestCustomResource(unittest.TestCase):

    def test_handler_dispatches_DeploymentConfiguration(self):
        
        event = {
            'ResourceType': 'Custom::DeploymentConfiguration'
        }

        context = {
        }

        with mock.patch.object(DeploymentConfigurationResourceHandler, 'handler') as mock_handler:
            custom_resource.handler(event, context)
            mock_handler.assert_called_with(event, context)


    def test_handler_dispatches_ResourceGroupConfiguration(self):
        
        event = {
            'ResourceType': 'Custom::ResourceGroupConfiguration'
        }

        context = {
        }

        with mock.patch.object(ResourceGroupConfigurationResourceHandler, 'handler') as mock_handler:
            custom_resource.handler(event, context)
            mock_handler.assert_called_with(event, context)


    def test_handler_dispatches_Access(self):
        
        event = {
            'ResourceType': 'Custom::Access'
        }

        context = {
        }

        with mock.patch.object(AccessResourceHandler, 'handler') as mock_handler:
            custom_resource.handler(event, context)
            mock_handler.assert_called_with(event, context)


    def test_handler_dispatches_PlayerAccess(self):
        
        event = {
            'ResourceType': 'Custom::PlayerAccess'
        }

        context = {
        }

        with mock.patch.object(PlayerAccessResourceHandler, 'handler') as mock_handler:
            custom_resource.handler(event, context)
            mock_handler.assert_called_with(event, context)


    def test_handler_dispatches_LambdaConfiguration(self):
        
        event = {
            'ResourceType': 'Custom::LambdaConfiguration'
        }

        context = {
        }

        with mock.patch.object(LambdaConfigurationResourceHandler, 'handler') as mock_handler:
            custom_resource.handler(event, context)
            mock_handler.assert_called_with(event, context)

    def test_handler_dispatches_resource_group_provided_resource_handler(self):

        test_resource_group_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), 'plugin'))

        with mock.patch.object(custom_resource, 'PLUGIN_DIRECTORY_PATH', new = test_resource_group_dir):

            event = {
                'ResourceType': 'Custom::Test'
            }

            context = {
            }

            # We don't load the TestPlugin module so as to not interfere with
            # the loading process we are testing. Instead that module will load this
            # test module and call the test_handler_called method, which we will verify.
            #
            # We call it twice so we can verify that the module is not being reloaded on
            # every request.

            custom_resource.handler(event, context)
            custom_resource.handler(event, context)

            global test_handler_calls
            self.assertEqual(test_handler_calls, [ 1, 2 ])

def test_handler_called(call_count):
    global test_handler_calls
    test_handler_calls.append(call_count)

