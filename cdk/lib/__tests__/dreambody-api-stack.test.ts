import { describe, test, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import { Template } from "aws-cdk-lib/assertions";
import { DreambodyApiStack } from "../dreambody-api-stack";

describe("DreambodyApiStack", () => {
  // Create a parent stack to attach the nested stack to
  const app = new cdk.App();
  const parentStack = new cdk.Stack(app, "TestParentStack");

  // Create an event bus to pass to the API stack
  const eventBus = new events.EventBus(parentStack, "TestEventBus", {
    eventBusName: "test-event-bus",
  });

  // Create the API stack as a nested stack
  const apiStack = new DreambodyApiStack(parentStack, "TestApiStack", {
    stage: "test",
    tableSuffix: "Test",
    apiName: "TestApi",
    removalPolicy: cdk.RemovalPolicy.DESTROY,
    apiKeyExpiryDays: 7,
    eventBus: eventBus,
  });

  // Generate CloudFormation template for assertions
  const template = Template.fromStack(parentStack);

  test("AppSync API is created", () => {
    template.hasResourceProperties("AWS::AppSync::GraphQLApi", {
      Name: "TestApi",
    });
  });

  test("DynamoDB tables are created with correct names", () => {
    // Check for UserProfiles table
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "UserProfilesTest",
    });

    // Check for QuizResponses table
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "QuizResponsesTest",
    });

    // Check for ExercisePlans table
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "ExercisePlansTest",
    });

    // Check for DietPlans table
    template.hasResourceProperties("AWS::DynamoDB::Table", {
      TableName: "DietPlansTest",
    });
  });

  test("Lambda functions are created with proper Node.js runtime", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Runtime: "nodejs22.x",
    });
  });

  test("Lambda functions have environment variables set", () => {
    template.hasResourceProperties("AWS::Lambda::Function", {
      Environment: {
        Variables: {
          STAGE: "test",
        },
      },
    });
  });

  test("EventBridge rule is created for Bedrock events", () => {
    template.hasResourceProperties("AWS::Events::Rule", {
      EventPattern: {
        source: ["promptEventHandler"],
        "detail-type": ["bedrockResponded"],
      },
    });
  });
});
