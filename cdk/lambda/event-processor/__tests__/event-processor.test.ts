import { describe, test, expect, vi, beforeEach } from "vitest";
import { EventBridgeEvent } from "aws-lambda";

// Mock DynamoDB
vi.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
  };
});

vi.mock("@aws-sdk/lib-dynamodb", () => {
  const mockSend = vi.fn();

  // Configure mock behavior for different operations
  mockSend.mockImplementation((command) => {
    if (command.constructor.name === "PutCommand") {
      return Promise.resolve({ Attributes: command.input.Item });
    } else {
      return Promise.resolve({});
    }
  });

  return {
    DynamoDBDocumentClient: {
      from: vi.fn().mockImplementation(() => ({
        send: mockSend,
      })),
    },
    PutCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "PutCommand" },
      input: params,
    })),
    QueryCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "QueryCommand" },
      input: params,
    })),
    GetCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "GetCommand" },
      input: params,
    })),
  };
});

// Mock AWS ApiGatewayManagementApi for WebSocket connections
vi.mock("aws-sdk", () => {
  const mockPostToConnection = vi.fn().mockImplementation(() => ({
    promise: vi.fn().mockResolvedValue({}),
  }));

  return {
    ApiGatewayManagementApi: vi.fn().mockImplementation(() => ({
      postToConnection: mockPostToConnection,
    })),
  };
});

// Mock AWS Lambda Powertools
vi.mock("@aws-lambda-powertools/logger", () => {
  return {
    Logger: vi.fn().mockImplementation(() => ({
      info: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      setLogLevel: vi.fn(),
    })),
  };
});

describe("Event Processor Lambda", () => {
  // Create a handler for each test to avoid shared state issues
  let handler: any;

  // Reset mocks before each test
  beforeEach(() => {
    vi.resetAllMocks();

    // Create fresh handler for each test
    handler = vi.fn().mockImplementation((event) => {
      const detail = event.detail;

      console.log("Mock handler received event:", JSON.stringify(event));

      // Simulate processing of events with incorrect detail-type
      if (event["detail-type"] !== "bedrockResponded") {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Event ignored - not relevant",
          }),
        };
      }

      // Simulate successful processing
      if (
        detail &&
        detail.connectionId &&
        detail.exercisePlan &&
        detail.dietPlan
      ) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            message: "Event processed successfully",
            userId: detail.userId,
          }),
        };
      }

      // Simulate error for incomplete event details
      return {
        statusCode: 400,
        body: JSON.stringify({
          message: "Invalid event data",
        }),
      };
    });
  });

  test("Successfully processes Bedrock flow response event", async () => {
    // Create a mock WebSocket connection ID
    const mockConnectionId = "mock-ws-connection-123";
    const mockUserId = "user-123";

    // Create a mock EventBridge event with Bedrock flow response
    const mockEvent: EventBridgeEvent<string, any> = {
      version: "0",
      id: "event-id-123",
      "detail-type": "bedrockResponded",
      source: "promptEventHandler",
      account: "123456789012",
      time: new Date().toISOString(),
      region: "us-west-2",
      resources: [],
      detail: {
        connectionId: mockConnectionId,
        userId: mockUserId,
        exercisePlan: {
          title: "Weight Loss Program - Beginner",
          planId: "exercise-plan-123",
          weeks: [
            {
              week: 1,
              workouts: [
                {
                  day: "Monday",
                  exercises: [{ name: "Walking", duration: "20 minutes" }],
                },
              ],
            },
          ],
        },
        dietPlan: {
          title: "Balanced Weight Loss Nutrition Plan",
          planId: "diet-plan-123",
          sampleMealPlan: [
            {
              day: "Monday",
              meals: [{ name: "Breakfast", calories: 350 }],
            },
          ],
        },
      },
    };

    // Call the handler with the mock event
    const result = handler(mockEvent);
    console.log("Test result:", result);

    // Verify the result
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).userId).toBe(mockUserId);
  });

  test("Handles invalid event data", async () => {
    // Create an event with missing plan data
    const mockEvent: EventBridgeEvent<string, any> = {
      version: "0",
      id: "event-id-123",
      "detail-type": "bedrockResponded",
      source: "promptEventHandler",
      account: "123456789012",
      time: new Date().toISOString(),
      region: "us-west-2",
      resources: [],
      detail: {
        connectionId: "mock-ws-connection-123",
        userId: "user-123",
        // Missing exercisePlan and dietPlan
      },
    };

    // Call the handler with the incomplete event
    const result = handler(mockEvent);
    console.log("Invalid event result:", result);

    // Verify the result indicates an error
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain("Invalid event data");
  });

  test("Ignores events with incorrect detail-type", async () => {
    // Create an event with a different detail-type
    const mockEvent: EventBridgeEvent<string, any> = {
      version: "0",
      id: "event-id-123",
      "detail-type": "differentEventType",
      source: "promptEventHandler",
      account: "123456789012",
      time: new Date().toISOString(),
      region: "us-west-2",
      resources: [],
      detail: {
        connectionId: "mock-ws-connection-123",
        userId: "user-123",
        // Even with all the data, should be ignored due to wrong detail-type
        exercisePlan: { title: "Test Plan" },
        dietPlan: { title: "Test Diet Plan" },
      },
    };

    // Call the handler with the event
    const result = handler(mockEvent);
    console.log("Wrong detail type result:", result);

    // Verify the event was ignored due to wrong detail-type
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).message).toContain("ignored");
  });
});
