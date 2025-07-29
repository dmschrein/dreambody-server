# DreamBody Server

This project is a serverless backend for the DreamBody application, built using AWS AppSync, Lambda, and DynamoDB.

## Architecture

- **GraphQL API**: AWS AppSync for handling GraphQL queries and mutations
- **Database**: Amazon DynamoDB tables for storing user profiles and quiz responses
- **Lambda Functions**: For resolving GraphQL operations

## Database Schema

### UserProfiles Table

- **Partition Key**: `userId` (string)
- **Attributes**: name, age, gender, height, weight, createdAt, updatedAt

### QuizResponses Table

- **Partition Key**: `userId` (string)
- **Sort Key**: `questionId` (string)
- **Attributes**: questionText, responseData, stepNumber, createdAt, updatedAt

## Getting Started

### Prerequisites

- Node.js (v16+)
- AWS CDK CLI
- AWS Account and configured credentials

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

3. Bootstrap CDK in your AWS account (if not done before):

```bash
npx cdk bootstrap
```

### Deployment

1. Synthesize CloudFormation template:

```bash
npx cdk synth
```

2. Deploy to AWS:

```bash
npx cdk deploy
```

3. The output will include:
   - GraphQL API URL
   - API Key

## Development

- GraphQL schema is defined in `graphql/schema.graphql`
- Lambda resolver code is in `lambda/index.js`
- AWS resources are defined in `lib/dreambody-api-stack.ts`

## Usage Examples

### Query a User Profile

```graphql
query GetUserProfile {
  getUserProfile(userId: "user123") {
    userId
    name
    age
    gender
    height
    weight
  }
}
```

### Create a User Profile

```graphql
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

### Save Quiz Response

```graphql
mutation SaveQuizResponse {
  saveQuizResponse(
    input: {
      userId: "user123"
      questionId: "q1"
      questionText: "What is your fitness goal?"
      responseData: "{\"option\": \"weight_loss\"}"
      stepNumber: 1
    }
  ) {
    userId
    questionId
    createdAt
  }
}
```
