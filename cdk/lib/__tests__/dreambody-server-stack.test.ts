import { describe, test, expect, beforeEach } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DreambodyServerStack } from "../dreambody-server-stack";

describe("DreambodyServerStack", () => {
  let app: cdk.App;
  let stack: DreambodyServerStack;
  let template: Template;

  beforeEach(() => {
    app = new cdk.App();
    stack = new DreambodyServerStack(app, "TestStack", {
      env: { account: "123456789012", region: "us-west-2" },
      stage: "test",
      config: {
        tableSuffix: "Test",
        apiName: "TestApi",
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        apiKeyExpiryDays: 7,
      },
    });
    template = Template.fromStack(stack);
  });

  test("EventBus is created", () => {
    template.hasResourceProperties("AWS::Events::EventBus", {
      Name: "DreambodyEventBus-test",
    });
  });

  test("Contains nested stacks", () => {
    // One for ApiStack, one for BedrockFlowStack
    template.resourceCountIs("AWS::CloudFormation::Stack", 2);
  });

  // No need to test for specific outputs, as they come from nested stacks
  // that aren't properly represented in the parent stack's template
});
