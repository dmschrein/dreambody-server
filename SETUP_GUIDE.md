# DreamBody API Setup Guide

This guide documents the steps taken to set up the DreamBody API using AWS CDK, AppSync, Lambda, and DynamoDB.

## 1. Project Structure

```
dreambody-server/
  - bin/                      # CDK app entry point
  - graphql/                  # GraphQL schema
  - lambda/                   # Lambda resolver code (TypeScript)
  - lib/                      # CDK stack definitions
```

## 2. GraphQL Schema Setup

1. Created the GraphQL schema in `graphql/schema.graphql`:

   - Defined types: `UserProfile`, `QuizResponse`
   - Defined inputs: `UserProfileInput`, `QuizResponseInput`
   - Defined queries and mutations

2. Added documentation to the schema:
   - Used triple-quote comments for type documentation
   - Added custom scalar `AWSJSON` for handling JSON data

## 3. Lambda Resolver Implementation

1. Set up TypeScript for Lambda:

   ```bash
   mkdir -p lambda
   cd lambda
   npm init -y
   npm install @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
   npm install --save-dev @types/aws-lambda @types/node typescript
   ```

2. Created TypeScript configuration:

   ```bash
   # Create tsconfig.json
   ```

3. Implemented resolvers in TypeScript:

   - Defined interfaces for data models
   - Implemented CRUD operations with AWS SDK v3
   - Set up proper error handling and logging

4. Built TypeScript code:
   ```bash
   cd lambda && npm run build && cd ..
   ```

## 4. CDK Infrastructure Setup

1. Created stack structure:

   - Main server stack (`DreambodyServerStack`)
   - Nested API stack (`DreambodyApiStack`)

2. Implemented multi-environment support:

   - Added stage-specific configurations (dev, staging, prod)
   - Used context variables for flexible deployment options
   - Applied different configurations based on environment

3. Added resources to API stack:
   - AppSync GraphQL API
   - DynamoDB tables with appropriate keys
   - Lambda function with TypeScript handlers
   - API resolvers for queries and mutations

## 5. AWS Account Configuration

1. Set up AWS SSO authentication:

   ```bash
   aws configure sso
   # Or used existing profile
   aws sso login --profile default
   ```

2. Checked AWS identity:
   ```bash
   aws sts get-caller-identity
   ```

## 6. CDK Deployment

1. Bootstrapped the CDK environment:

   ```bash
   npx cdk bootstrap aws://100484436864/us-west-1 --context account=100484436864 --context region=us-west-1
   ```

2. Synthesized CloudFormation template:

   ```bash
   npx cdk synth --context account=100484436864 --context region=us-west-1
   ```

3. Deployed the stack:
   ```bash
   npx cdk deploy --context account=100484436864 --context region=us-west-1
   ```

## 7. Accessing the Deployed API

The API details can be found:

- In the AWS Management Console → AppSync → DreambodyApi-Dev
- In CloudFormation → DreambodyServerStack-dev → Outputs tab

Key information:

- GraphQL API URL
- API Key for authentication

## 8. Testing and Usage

1. Using the API with GraphQL queries:

   ```graphql
   # Create a user profile
   mutation CreateUserProfile {
     createUserProfile(
       input: {
         userId: "user123"
         name: "John Doe"
         age: 30
         gender: "male"
         height: 175.5
         weight: 70.2
       }
     ) {
       userId
       name
       createdAt
     }
   }
   ```

2. Deploy to different environments:

   ```bash
   # Development (default)
   npx cdk deploy --context account=100484436864 --context region=us-west-1

   # Staging
   npx cdk deploy --context stage=staging --context account=100484436864 --context region=us-west-1

   # Production
   npx cdk deploy --context stage=prod --context account=100484436864 --context region=us-west-1
   ```

## 9. Next Steps

- Connect frontend application to the API
- Implement authentication with Cognito (if needed)
- Set up monitoring and alerting
- Implement CI/CD pipeline for automated deployments
