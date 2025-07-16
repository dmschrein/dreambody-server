import * as appsync from "@aws-cdk/aws-appsync-alpha";
import * as cdk from "aws-cdk-lib";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { Construct } from "constructs";

export class DreambodyApiStack extends cdk.Stack {
  public readonly graphqlUrl: cdk.CfnOutput;
  public readonly apiKey: cdk.CfnOutput;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Create the AppSync API
    const api = new appsync.GraphqlApi(this, "DreambodyAPI", {
      name: "dreambody-api",
      schema: appsync.Schema.fromAsset("graphql/schema.graphql"),
      authorizationConfig: {
        defaultAuthorization: {
          authorizationType: appsync.AuthorizationType.API_KEY,
          apiKeyConfig: {
            expires: cdk.Expiration.after(cdk.Duration.days(365)),
          },
        },
      },
      xrayEnabled: true,
    });

    // Create the DynamoDB table for user profiles
    const userProfileTable = new dynamodb.Table(this, "UserProfileTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development!
    });

    // Create the DynamoDB table for quiz responses
    const quizResponseTable = new dynamodb.Table(this, "QuizResponseTable", {
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      partitionKey: {
        name: "userId",
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: "questionId",
        type: dynamodb.AttributeType.STRING,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY, // Only for development!
    });

    // Create a Lambda function for resolvers
    const resolverFunction = new lambda.Function(this, "ResolverFunction", {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: "index.handler",
      code: lambda.Code.fromAsset("lambda"),
      memorySize: 1024,
      timeout: cdk.Duration.seconds(30),
      environment: {
        USER_PROFILE_TABLE: userProfileTable.tableName,
        QUIZ_RESPONSE_TABLE: quizResponseTable.tableName,
      },
    });

    // Grant permissions to the Lambda function
    userProfileTable.grantReadWriteData(resolverFunction);
    quizResponseTable.grantReadWriteData(resolverFunction);

    // Create the Lambda data source
    const lambdaDataSource = api.addLambdaDataSource(
      "LambdaDataSource",
      resolverFunction
    );

    // Create resolvers for the operations
    lambdaDataSource.createResolver({
      typeName: "Query",
      fieldName: "getUserProfile",
    });

    lambdaDataSource.createResolver({
      typeName: "Query",
      fieldName: "getQuizResponses",
    });

    lambdaDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "createUserProfile",
    });

    lambdaDataSource.createResolver({
      typeName: "Mutation",
      fieldName: "saveQuizResponse",
    });

    // Output the GraphQL endpoint and API key for client-side configuration
    this.graphqlUrl = new cdk.CfnOutput(this, "GraphQLAPIURL", {
      value: api.graphqlUrl,
    });

    this.apiKey = new cdk.CfnOutput(this, "GraphQLAPIKey", {
      value: api.apiKey || "",
    });
  }
}
