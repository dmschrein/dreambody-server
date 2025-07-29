// AppSync/DynamoDB stack
import * as cdk from "aws-cdk-lib";
import { Construct } from "constructs";
import { DreambodyApiStack } from "./dreambody-api-stack";

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

    // Create the API stack with stage-specific configuration
    const apiStack = new DreambodyApiStack(this, "ApiStack", {
      stage,
      tableSuffix: config.tableSuffix || "",
      apiName: config.apiName || "DreambodyApi",
      removalPolicy: config.removalPolicy || cdk.RemovalPolicy.DESTROY,
      apiKeyExpiryDays: config.apiKeyExpiryDays || 365,
    });

    // Add any other stacks or resources as needed
  }
}
