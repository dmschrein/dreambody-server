// AppSync/DynamoDB stack
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import * as events from "aws-cdk-lib/aws-events";
import { DreambodyApiStack } from "./dreambody-api-stack";
import { BedrockFlowStack } from "./bedrock-flow-stack";

// Extend the StackProps interface to include our custom properties
interface DreambodyStackProps extends cdk.StackProps {
  stage?: string;
  config?: any;
}

export class DreambodyServerStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: DreambodyStackProps) {
    super(scope, id, props);

    const stage = props?.stage || "dev";
    const config = props?.config || {};

    // Create EventBridge event bus (moved from API stack)
    const eventBus = new events.EventBus(this, "DreambodyEventBus", {
      eventBusName: `DreambodyEventBus-${stage}`,
    });

    // Create the API stack with stage-specific configuration
    const apiStack = new DreambodyApiStack(this, "ApiStack", {
      stage,
      tableSuffix: config.tableSuffix || "",
      apiName: config.apiName || "DreambodyApi",
      removalPolicy: config.removalPolicy || cdk.RemovalPolicy.DESTROY,
      apiKeyExpiryDays: config.apiKeyExpiryDays || 365,
      eventBus, // Pass the event bus to the API stack
    });

    // Create the Bedrock Flow stack
    const bedrockFlowStack = new BedrockFlowStack(this, "BedrockFlowStack", {
      stage,
      api: apiStack.api,
      eventBus,
    });
  }
}
