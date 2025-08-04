import { describe, test, expect, beforeEach } from "vitest";
import * as cdk from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import { Template } from "aws-cdk-lib/assertions";
import { DreambodyApiStack } from "../dreambody-api-stack";

describe("DreambodyApiStack", () => {
  // Create a test app and standalone stack for testing
  let app: cdk.App;
  let stack: cdk.Stack;
  let apiStack: DreambodyApiStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new cdk.Stack(app, "TestStack");

    // Create an event bus to pass to the API stack
    const eventBus = new events.EventBus(stack, "TestEventBus", {
      eventBusName: "test-event-bus",
    });

    // For testing, create the API stack directly (not as a nested stack)
    apiStack = new DreambodyApiStack(stack, "TestApiStack", {
      stage: "test",
      tableSuffix: "Test",
      apiName: "TestApi",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      apiKeyExpiryDays: 7,
      eventBus: eventBus,
    });

    // Generate CloudFormation template for assertions
    template = Template.fromStack(stack);
  });

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
