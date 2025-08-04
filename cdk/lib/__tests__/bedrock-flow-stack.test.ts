import { describe, test, expect, beforeEach } from "vitest";
import * as cdk from "aws-cdk-lib";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import * as events from "aws-cdk-lib/aws-events";
import * as path from "path";
import { Template } from "aws-cdk-lib/assertions";
import { BedrockFlowStack } from "../bedrock-flow-stack";

describe("BedrockFlowStack", () => {
  let stack: cdk.Stack;
  let template: Template;

  beforeEach(() => {
    const app = new cdk.App();
    stack = new cdk.Stack(app, "ParentStack");

    // Create mock dependencies
    const api = new appsync.GraphqlApi(stack, "MockApi", {
      name: "MockApi",
      schema: appsync.Schema.fromAsset(
        path.join(__dirname, "..", "..", "graphql", "schema.graphql")
      ),
    });

    const eventBus = new events.EventBus(stack, "MockEventBus", {
      eventBusName: "MockEventBus",
    });

    // Create the BedrockFlowStack
    new BedrockFlowStack(stack, "TestBedrockStack", {
      stage: "test",
      api,
      eventBus,
    });

    template = Template.fromStack(stack);
  });

  test("Lambda function is created", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "lambda/bedrock-flow/invoke-dreambody-prompt-flow-v1.handler",
      Runtime: "nodejs22.x",
    });
  });

  test("SSM parameters are created with proper naming convention", () => {
    const paramNames = [
      "/dreambody-server/test/dreambodyV1/flowIdentifier",
      "/dreambody-server/test/dreambodyV1/flowAliasIdentifier",
      "/dreambody-server/test/dreambodyV1/startNodeName",
      "/dreambody-server/test/dreambodyV1/endNodeOutputName",
    ];

    // Check each parameter exists
    paramNames.forEach((paramName) => {
      template.hasResourceProperties("AWS::SSM::Parameter", {
        Name: paramName,
      });
    });
  });

  test("Lambda function has IAM permissions for SSM", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: expect.arrayContaining([
              "ssm:GetParameter",
              "ssm:GetParameters",
            ]),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });

  test("Lambda function has IAM permissions for Bedrock", () => {
    template.hasResourceProperties("AWS::IAM::Policy", {
      PolicyDocument: {
        Statement: expect.arrayContaining([
          expect.objectContaining({
            Action: expect.arrayContaining([
              "bedrock:InvokeFlow",
              "bedrock:InvokeModel",
              "bedrock:ListFoundationModels",
            ]),
            Effect: "Allow",
          }),
        ]),
      },
    });
  });

  test("AppSync resolver is created for generateUserPlansWithFlow mutation", () => {
    // Check that a resolver exists for the mutation
    template.hasResourceProperties("AWS::AppSync::Resolver", {
      FieldName: "generateUserPlansWithFlow",
      TypeName: "Mutation",
    });
  });
});
