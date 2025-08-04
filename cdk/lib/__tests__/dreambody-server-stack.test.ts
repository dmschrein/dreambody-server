import { describe, test, expect } from "vitest";
import * as cdk from "aws-cdk-lib";
import { Template } from "aws-cdk-lib/assertions";
import { DreambodyServerStack } from "../dreambody-server-stack";

describe("DreambodyServerStack", () => {
  const app = new cdk.App();
  const stack = new DreambodyServerStack(app, "TestStack", {
    env: { account: "123456789012", region: "us-west-2" },
    stage: "test",
    config: {
      tableSuffix: "Test",
      apiName: "TestApi",
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      apiKeyExpiryDays: 7,
    },
  });
  const template = Template.fromStack(stack);

  test("EventBus is created", () => {
    template.hasResourceProperties("AWS::Events::EventBus", {
      Name: "DreambodyEventBus-test",
    });
  });

  test("Contains nested stacks", () => {
    // One for ApiStack, one for BedrockFlowStack
    template.resourceCountIs("AWS::CloudFormation::Stack", 2);
  });

  test("Contains stack outputs", () => {
    template.hasOutput("*", {});
  });
});
