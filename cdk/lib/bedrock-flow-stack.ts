import * as cdk from "aws-cdk-lib";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as ssm from "aws-cdk-lib/aws-ssm";
import * as events from "aws-cdk-lib/aws-events";
import { GraphqlApi, SchemaFile } from "@aws-cdk/aws-appsync-alpha";
import { NodejsFunction, OutputFormat } from "aws-cdk-lib/aws-lambda-nodejs";
import * as path from "path";
import { Construct } from "constructs";

interface BedrockFlowStackProps extends cdk.NestedStackProps {
  stage: string;
  api: GraphqlApi;
  eventBus: events.EventBus;
}

export class BedrockFlowStack extends cdk.NestedStack {
  public readonly flowInvokerFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: BedrockFlowStackProps) {
    super(scope, id);

    const { stage, api, eventBus } = props;

    // Create the Flow Invoker Lambda function
    this.flowInvokerFunction = new NodejsFunction(
      this,
      "BedrockFlowInvokerFunction",
      {
        runtime: lambda.Runtime.NODEJS_22_X,
        entry: path.join(__dirname, "..", "lambda", "bedrock-flow", "index.ts"),
        handler: "handler",
        memorySize: 1024,
        timeout: cdk.Duration.seconds(60),
        environment: {
          eventBusName: eventBus.eventBusName,
          LOG_LEVEL: "DEBUG",
        },
        bundling: {
          externalModules: ["aws-sdk"],
          format: OutputFormat.ESM,
          minify: true,
          sourceMap: true,
          target: "node22",
        },
      }
    );

    // Create SSM parameters for Bedrock flows
    // Note: For parameters that already exist, you'll need to update them manually
    // or delete them before deployment
    const parameterPrefix = `/dreambody-server/${stage}/dreambodyV1`;

    new ssm.StringParameter(this, "FlowIdentifier", {
      parameterName: `${parameterPrefix}/flowIdentifier`,
      stringValue: "flow-identifier-placeholder",
      description: "Bedrock flow identifier",
    });

    new ssm.StringParameter(this, "FlowAliasIdentifier", {
      parameterName: `${parameterPrefix}/flowAliasIdentifier`,
      stringValue: "flow-alias-identifier-placeholder",
      description: "Bedrock flow alias identifier",
    });

    new ssm.StringParameter(this, "StartNodeName", {
      parameterName: `${parameterPrefix}/startNodeName`,
      stringValue: "InputNode",
      description: "Bedrock flow start node name",
    });

    new ssm.StringParameter(this, "EndNodeOutputName", {
      parameterName: `${parameterPrefix}/endNodeOutputName`,
      stringValue: "OutputNode",
      description: "Bedrock flow end node output name",
    });

    // Grant SSM permissions
    this.flowInvokerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter", "ssm:GetParameters"],
        resources: [
          `arn:aws:ssm:${this.region}:${this.account}:parameter${parameterPrefix}/*`,
        ],
      })
    );

    // Grant EventBridge permissions
    this.flowInvokerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["events:PutEvents"],
        resources: [eventBus.eventBusArn],
      })
    );

    // Grant Bedrock permissions
    this.flowInvokerFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: [
          "bedrock:InvokeFlow",
          "bedrock:InvokeModel",
          "bedrock:ListFoundationModels",
        ],
        resources: ["*"],
      })
    );

    // Add the Lambda data source to AppSync
    const flowInvokerDataSource = api.addLambdaDataSource(
      "FlowInvokerDataSource",
      this.flowInvokerFunction
    );

    // Create resolver for the mutation
    flowInvokerDataSource.createResolver("GenerateUserPlansWithFlowResolver", {
      typeName: "Mutation",
      fieldName: "generateUserPlansWithFlow",
    });
  }
}
