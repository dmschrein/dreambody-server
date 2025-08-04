# DreamBody Server

Backend server for the DreamBody application using AWS CDK, AppSync, Lambda, and Bedrock.

## Testing

This project uses [Vitest](https://vitest.dev/) for unit and integration testing. All Jest dependencies have been removed in favor of Vitest.

### Running Tests

- Run all tests: `npm test`
- Run tests in watch mode: `npm run test:watch`
- Run tests with UI: `npm run test:ui`

### Specialized Test Commands

- Test Lambda function handler: `npm run test -- cdk/lambda/function-handler/__tests__/index.test.ts`
- Test Bedrock Flow Lambda: `npm run test -- cdk/lambda/bedrock-flow/__tests__/invoke-dreambody-prompt-flow-v1.test.ts`
- Test Bedrock Flow integration: `npm run test -- cdk/lambda/bedrock-flow/__tests__/bedrock-flow-integration.test.ts`
- Test Event Processor: `npm run test -- cdk/lambda/event-processor/__tests__/event-processor.test.ts`

### Test Structure

- **Unit Tests**: Located in `__tests__` directories adjacent to the code they test
- **Integration Tests**: Test the complete flow from API request to EventBridge processing

## Deployment

First run the pre-deployment checks:

```
npm run preDeploy
```

Then deploy with:

```
cdk deploy
```
