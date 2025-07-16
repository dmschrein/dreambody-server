#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import "source-map-support/register";
import { DreambodyApiStack } from "../lib/dreambody-api-stack";

const app = new cdk.App();

new DreambodyApiStack(app, "DreambodyApiStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || "us-east-1",
  },
  description:
    "Dreambody API stack for storing user profiles and quiz responses",
});

app.synth();
