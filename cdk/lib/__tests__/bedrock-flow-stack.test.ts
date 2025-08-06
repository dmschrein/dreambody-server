import { describe, test, expect, beforeEach } from "vitest";
import * as cdk from "aws-cdk-lib";
import { GraphqlApi, SchemaFile } from "@aws-cdk/aws-appsync-alpha";
import * as events from "aws-cdk-lib/aws-events";
import * as path from "path";
import { Template } from "aws-cdk-lib/assertions";
import { BedrockFlowStack } from "../bedrock-flow-stack";

describe("BedrockFlowStack", () => {
  let app: cdk.App;
  let stack: cdk.Stack;
  let bedrockStack: BedrockFlowStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    // For testing purposes, create a standalone stack rather than a nested stack
    stack = new cdk.Stack(app, "TestStack");

    // Create mock dependencies
    const api = new GraphqlApi(stack, "MockApi", {
      name: "MockApi",
      schema: SchemaFile.fromAsset(
        path.join(__dirname, "..", "..", "graphql", "schema.graphql")
      ),
    });

    const eventBus = new events.EventBus(stack, "MockEventBus", {
      eventBusName: "MockEventBus",
    });

    // Create the BedrockFlowStack directly in the stack (not as a nested stack)
    // This is just for testing purposes
    bedrockStack = new BedrockFlowStack(stack, "TestBedrockStack", {
      stage: "test",
      api,
      eventBus,
    });

    template = Template.fromStack(stack);
  });

  test("Lambda function is created", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Handler: "index.handler",
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
    // Update to match how IAM policy statements are structured in the template
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
    // Update to match how IAM policy statements are structured in the template
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
