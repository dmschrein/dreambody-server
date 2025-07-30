import * as cdk from "aws-cdk-lib";
import * as appsync from "@aws-cdk/aws-appsync-alpha";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as path from "path";
import { Construct } from "constructs";
import { RemovalPolicy } from "aws-cdk-lib";
import * as fs from "fs";
import * as iam from "aws-cdk-lib/aws-iam";

// Define props interface for the API stack
interface DreambodyApiStackProps extends cdk.NestedStackProps {
  stage?: string;
  tableSuffix?: string;
  apiName?: string;
  removalPolicy?: RemovalPolicy;
  apiKeyExpiryDays?: number;
}

export class DreambodyApiStack extends cdk.NestedStack {
  public readonly api: appsync.GraphqlApi;
  public readonly userProfilesTable: dynamodb.Table;
  public readonly quizResponsesTable: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: DreambodyApiStackProps) {
    super(scope, id, props);

    // Extract configuration or use defaults
    const stage = props?.stage || "dev";
    const tableSuffix = props?.tableSuffix || "";
    const apiName = props?.apiName || "DreambodyApi";
    const removalPolicy = props?.removalPolicy || RemovalPolicy.DESTROY;
    const apiKeyExpiryDays = props?.apiKeyExpiryDays || 365;

    // Create AppSync API
    this.api = new appsync.GraphqlApi(this, "DreambodyApi", {
      name: apiName,
      schema: appsync.SchemaFile.fromAsset(
        path.join(__dirname, "..", "graphql", "schema.graphql")
      ),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            name: `${apiName}Key`,
            description: `API Key for ${apiName}`,
            expires: cdk.Expiration.after(cdk.Duration.days(apiKeyExpiryDays)),
          },
        },
      },
      logConfig: {
        fieldLogLevel: appsync.FieldLogLevel.ALL,
      },
      xrayEnabled: true,
    });

    // Create DynamoDB Tables
    this.userProfilesTable = new dynamodb.Table(this, "UserProfiles", {
      tableName: `UserProfiles${tableSuffix}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      removalPolicy: removalPolicy,
    });

    this.quizResponsesTable = new dynamodb.Table(this, "QuizResponses", {
      tableName: `QuizResponses${tableSuffix}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "questionId", type: dynamodb.AttributeType.STRING },
      removalPolicy: removalPolicy,
    });

    // Create new tables for exercise and diet plans
    const exercisePlansTable = new dynamodb.Table(this, "ExercisePlans", {
      tableName: `ExercisePlans${tableSuffix}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "planId", type: dynamodb.AttributeType.STRING },
      removalPolicy: removalPolicy,
    });

    const dietPlansTable = new dynamodb.Table(this, "DietPlans", {
      tableName: `DietPlans${tableSuffix}`,
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: { name: "userId", type: dynamodb.AttributeType.STRING },
      sortKey: { name: "planId", type: dynamodb.AttributeType.STRING },
      removalPolicy: removalPolicy,
    });

    // Create a Lambda function for resolvers
    const resolverFunction = new lambda.Function(this, "ResolverFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "dist/index.handler", // Updated to use the TypeScript build output
      code: lambda.Code.fromAsset(path.join(__dirname, "..", "lambda")),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30), // Increased timeout for AI operations
      environment: {
        USER_PROFILES_TABLE: this.userProfilesTable.tableName,
        QUIZ_RESPONSES_TABLE: this.quizResponsesTable.tableName,
        EXERCISE_PLANS_TABLE: exercisePlansTable.tableName,
        DIET_PLANS_TABLE: dietPlansTable.tableName,
        BEDROCK_MODEL_ID: "anthropic.claude-3-sonnet-20240229-v1:0",
        STAGE: stage,
      },
    });

    // Grant the Lambda function read/write access to the tables
    this.userProfilesTable.grantReadWriteData(resolverFunction);
    this.quizResponsesTable.grantReadWriteData(resolverFunction);
    exercisePlansTable.grantReadWriteData(resolverFunction);
    dietPlansTable.grantReadWriteData(resolverFunction);

    // Grant the Lambda function permissions to invoke Bedrock models
    resolverFunction.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["bedrock:InvokeModel"],
        resources: ["*"], // For simplicity. In production, scope this to specific models
      })
    );

    // Create a Lambda data source
    const lambdaDataSource = this.api.addLambdaDataSource(
      "LambdaDataSource",
      resolverFunction
    );

    // Add resolvers for each Query and Mutation
    lambdaDataSource.createResolver("GetUserProfileResolver", {
      typeName: "Query",
      fieldName: "getUserProfile",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    lambdaDataSource.createResolver("GetQuizResponsesResolver", {
      typeName: "Query",
      fieldName: "getQuizResponses",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    lambdaDataSource.createResolver("CreateUserProfileResolver", {
      typeName: "Mutation",
      fieldName: "createUserProfile",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    lambdaDataSource.createResolver("UpdateUserProfileResolver", {
      typeName: "Mutation",
      fieldName: "updateUserProfile",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    lambdaDataSource.createResolver("SaveQuizResponseResolver", {
      typeName: "Mutation",
      fieldName: "saveQuizResponse",
      requestMappingTemplate: appsync.MappingTemplate.lambdaRequest(),
      responseMappingTemplate: appsync.MappingTemplate.lambdaResult(),
    });

    // Output the API URL and API Key
    new cdk.CfnOutput(this, "GraphQLApiURL", {
      value: this.api.graphqlUrl,
    });

    new cdk.CfnOutput(this, "GraphQLApiKey", {
      value: this.api.apiKey || "",
    });
  }
}
