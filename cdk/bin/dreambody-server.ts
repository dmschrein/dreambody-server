#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { DreambodyServerStack } from "../lib/dreambody-server-stack";

const app = new cdk.App();

// Get stage from context or default to 'dev'
const stage = app.node.tryGetContext("stage") || "dev";
console.log(`Deploying to ${stage} environment`);

// Get AWS account and region from context or environment variables
const account = app.node.tryGetContext("account");
const region = app.node.tryGetContext("region") || "us-west-2";

console.log(`Using AWS account: ${account || "default"}, region: ${region}`);

// Define stage-specific configurations
const stageConfigs: Record<string, any> = {
  dev: {
    tableSuffix: "Dev",
    apiName: "DreambodyApi-Dev",
    removalPolicy: cdk.RemovalPolicy.DESTROY, // Safe to remove resources in dev
    apiKeyExpiryDays: 365,
  },
  staging: {
    tableSuffix: "Staging",
    apiName: "DreambodyApi-Staging",
    removalPolicy: cdk.RemovalPolicy.RETAIN,
    apiKeyExpiryDays: 90,
  },
  prod: {
    tableSuffix: "Prod",
    apiName: "DreambodyApi-Prod",
    removalPolicy: cdk.RemovalPolicy.RETAIN, // Keep resources in production
    apiKeyExpiryDays: 30,
  },
};

const config = stageConfigs[stage] || stageConfigs.dev;

// Create stack with stage-specific name and config
new DreambodyServerStack(app, `DreambodyServerStack-${stage}`, {
  env: account
    ? {
        account: account,
        region: region,
      }
    : undefined,
  stage,
  config,
  tags: {
    Environment: stage,
    Project: "DreamBody",
    DeployedBy: "CDK",
  },
});
