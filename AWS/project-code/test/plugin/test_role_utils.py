import unittest

class Test_test_role_utils(unittest.TestCase):

    # @unittest.skip("integration test disabled")
    def test_integration_create_update_delete_role(self):
        
        with mock.patch.object(discovery_utils,'ResourceGroupInfo') as mock_ResourceGroupInfo:

            mock_ResourceGroupInfo.return_value.resource_group_name = 'TestGroup'
            mock_ResourceGroupInfo.return_value.deployment = mock.MagicMock()
            mock_ResourceGroupInfo.return_value.deployment.deployment_name = 'TestDeployment'
            mock_ResourceGroupInfo.return_value.deployment.project = mock.MagicMock()
            mock_ResourceGroupInfo.return_value.deployment.project.project_name = 'TestProject'

            stack_arn = self._create_role_test_stack()
            try:

                resource_uuid = uuid.uuid4()
                
                created_role_arn = lambda_configuration._create_role(stack_arn, 'TestFunction', resource_uuid)
                self._validate_role(created_role_arn, stack_arn)

                updated_role_arn = lambda_configuration._update_role(stack_arn, 'TestFunction', resource_uuid)
                self.assertEquals(created_role_arn, updated_role_arn)
                self._validate_role(updated_role_arn, stack_arn)

                lambda_configuration._delete_role(resource_uuid)
                self._validate_role_deleted(created_role_arn)

            finally:

                self._delete_role_test_stack(stack_arn)


    def _create_role_test_stack(self):

        cf = boto3.client('cloudformation', region_name=TEST_REGION)

        stack_name = 'lmbr-aws-update-role-test-' + str(int(time() * 1000))

        print 'creating stack', stack_name

        res = cf.create_stack(
            StackName = stack_name,
            TemplateBody = self.ROLE_TEST_STACK_TEMPLATE,
            Capabilities = [ 'CAPABILITY_IAM' ])

        stack_arn = res['StackId']

        print 'CreateStack', res

        while True:
            sleep(5)
            res = cf.describe_stacks(StackName=stack_arn)
            print 'Checking', res
            if res['Stacks'][0]['StackStatus'] != 'CREATE_IN_PROGRESS':
                break

        self.assertEquals(res['Stacks'][0]['StackStatus'], 'CREATE_COMPLETE')

        return stack_arn


    def _delete_role_test_stack(self, stack_arn):
        print 'deleting stack', stack_arn
        cf = boto3.client('cloudformation', region_name=TEST_REGION)
        cf.delete_stack(StackName=stack_arn)


    def _validate_role(self, role_arn, stack_arn):

        iam = boto3.client('iam')
        print 'role_arn', role_arn
        res = iam.get_role(RoleName=self._get_role_name_from_role_arn(role_arn))
        print 'res', res
        role = res['Role']
        self.assertEquals(role['Path'], '/TestProject/TestDeployment/TestGroup/TestFunction/')

        cf = boto3.client('cloudformation', region_name=TEST_REGION)
        res = cf.describe_stack_resources(StackName=stack_arn)
        print res
        resources = res['StackResources']

        expected_statement = {
            'TestTableAccess': {
                'Sid': 'TestTableAccess',
                'Effect': 'Allow',
                'Action': [ 'dynamodb:PutItem' ],
                'Resource': self._get_resource_arn(stack_arn, resources, 'TestTable')
            },
            'TestFunctionAccess': {
                'Sid': 'TestFunctionAccess',
                'Effect': 'Allow',
                'Action': [ 'lambda:InvokeFunction' ],
                'Resource': self._get_resource_arn(stack_arn, resources, 'TestFunction')
            },
            'TestQueueAccess': {
                'Sid': 'TestQueueAccess',
                'Effect': 'Allow',
                'Action':  [ 'sqs:SendMessage' ],
                'Resource': self._get_resource_arn(stack_arn, resources, 'TestQueue')
            },
            'TestTopicAccess': {
                'Sid': 'TestTopicAccess',
                'Effect': 'Allow',
                'Action': [ 'sns:Subscribe' ],
                'Resource': self._get_resource_arn(stack_arn, resources, 'TestTopic')
            },
            'TestBucketAccess': {
                'Sid': 'TestBucketAccess',
                'Effect': 'Allow',
                'Action': [ 's3:GetObject', 's3:PutObject' ],
                'Resource': self._get_resource_arn(stack_arn, resources, 'TestBucket') + "TestSuffix"
            },
            'WriteLogs': {
                'Sid': 'WriteLogs',
                'Action': ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'], 
                'Resource': 'arn:aws:logs:*:*:*', 
                'Effect': 'Allow'
            }
        }

        res = iam.get_role_policy(RoleName=self._get_role_name_from_role_arn(role_arn), PolicyName='FunctionAccess')
        print res
        actual_policy = res['PolicyDocument']

        count = 0
        for actual_statement in actual_policy['Statement']:
            self.assertEquals(actual_statement, expected_statement.get(actual_statement['Sid'], None))
            count += 1

        self.assertEquals(count, 6)

    
    def _get_resource_arn(self, stack_arn, resources, name):

        arn = None

        for resource in resources:
            if resource['LogicalResourceId'] == name:
                arn = self._make_resource_arn(stack_arn, resource['ResourceType'], resource['PhysicalResourceId'])

        self.assertIsNotNone(arn)

        return arn


    RESOURCE_ARN_PATTERNS = {
        'AWS::DynamoDB::Table': 'arn:aws:dynamodb:{region}:{account_id}:table/{resource_name}',
        'AWS::Lambda::Function': 'arn:aws:lambda:{region}:{account_id}:function:{resource_name}',
        'AWS::SQS::Queue': 'arn:aws:sqs:{region}:{account_id}:{resource_name}',
        'AWS::SNS::Topic': 'arn:aws:sns:{region}:{account_id}:{resource_name}',
        'AWS::S3::Bucket': 'arn:aws:s3:::{resource_name}'
    }


    def _make_resource_arn(self, stack_arn, resource_type, resource_name):
    
        pattern = self.RESOURCE_ARN_PATTERNS.get(resource_type, None)
        self.assertIsNotNone(pattern)

        return pattern.format(
            region=TEST_REGION,
            account_id=self._get_account_id_from_stack_arn(stack_arn),
            resource_name=resource_name)


    def _get_account_id_from_stack_arn(self, stack_arn):
        # arn:aws:cloudformation:REGION:ACCOUNT:stack/STACK/UUID
        return stack_arn.split(':')[4]


    def _get_role_name_from_role_arn(self, role_arn):
        # arn:aws:cloudformation:REGION:ACCOUNT:stack/STACK/UUID
        return role_arn.split('/')[-1]


    def _validate_role_deleted(self, role_arn):
        iam = boto3.client('iam')
        try:
            iam.get_role(RoleName=self._get_role_name_from_role_arn(role_arn))
            self.assertTrue(False)
        except ClientError as e:
            self.assertEquals(e.response["Error"]["Code"], "NoSuchEntity")


    ROLE_TEST_STACK_TEMPLATE = '''{
            "AWSTemplateFormatVersion": "2010-09-09",

            "Resources": {

                "TestTable": {
                    "Type": "AWS::DynamoDB::Table",
                    "Properties": {
                        "AttributeDefinitions": [
                            {
                                "AttributeName": "PlayerId",
                                "AttributeType": "S"
                            }
                        ],
                        "KeySchema": [
                            {
                                "AttributeName": "PlayerId",
                                "KeyType": "HASH"
                            }
                        ],
                        "ProvisionedThroughput": {
                            "ReadCapacityUnits": "1",
                            "WriteCapacityUnits": "1"
                        }
                    },
                    "Metadata": {
                        "CloudCanvas": {
                            "FunctionAccess": [
                                {
                                    "FunctionName": "TestFunction",
                                    "Action": "dynamodb:PutItem"
                                }
                            ]
                        }
                    }
                },

                "TestFunctionRole": {
                    "Type": "AWS::IAM::Role",
                    "Properties": {
                        "AssumeRolePolicyDocument": {
                            "Version": "2012-10-17",
                            "Statement": [
                                {
                                    "Effect": "Allow",
                                    "Action": "sts:AssumeRole",
                                    "Principal": {
                                        "Service": "lambda.amazonaws.com"
                                    }
                                }
                            ]
                        },
                        "Policies": [
                            {
                                "PolicyName": "Execution",
                                "PolicyDocument": {
                                    "Version": "2012-10-17",
                                    "Statement": [
                                        {
                                            "Action": [
                                                "logs:CreateLogGroup",
                                                "logs:CreateLogStream",
                                                "logs:PutLogEvents"
                                            ],
                                            "Effect": "Allow",
                                            "Resource": "arn:aws:logs:*:*:*"
                                        }
                                    ]
                                }
                            }
                        ]
                    }
                },

                "TestFunction": {
                    "Type": "AWS::Lambda::Function",
                    "Properties": {
                        "Description": "Implements the custom resources used in this project's templates.",
                        "Handler": "index.handler",
                        "Role": { "Fn::GetAtt": [ "TestFunctionRole", "Arn" ] },
                        "Runtime": "nodejs",
                        "Code": {
                            "ZipFile": "exports.handler = function(event, context) { return 'Test'; }"
                        }
                    },
                    "Metadata": {
                        "CloudCanvas": {
                            "FunctionAccess": {
                                "FunctionName": "TestFunction",
                                "Action": "lambda:InvokeFunction"
                            }
                        }
                    }
                },

                "TestQueue": {
                    "Type": "AWS::SQS::Queue",
                    "Properties": {
                    },
                    "Metadata": {
                        "CloudCanvas": {
                            "FunctionAccess": [
                                {
                                    "FunctionName": "TestFunction",
                                    "Action": [ "sqs:SendMessage" ]
                                }
                            ]
                        }
                    }
                },
            
                "TestTopic": {
                    "Type": "AWS::SNS::Topic",
                    "Properties": {
                    },
                    "Metadata": {
                        "CloudCanvas": {
                            "FunctionAccess": [
                                {
                                    "FunctionName": "TestFunction",
                                    "Action": "sns:Subscribe"
                                }
                            ]
                        }
                    }
                },

                "TestBucket": {
                    "Type": "AWS::S3::Bucket",
                    "Properties": {
                    },
                    "Metadata": {
                        "CloudCanvas": {
                            "FunctionAccess": [
                                {
                                    "FunctionName": "TestFunction",
                                    "Action": [ "s3:GetObject", "s3:PutObject" ],
                                    "ResourceSuffix": "TestSuffix"
                                }
                            ]
                        }
                    }
                }

            }

        }'''

if __name__ == '__main__':
    unittest.main()
