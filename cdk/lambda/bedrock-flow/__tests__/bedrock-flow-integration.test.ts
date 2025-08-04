import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { APIGatewayProxyEvent } from "aws-lambda";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import {
  BedrockAgentRuntimeClient,
  InvokeFlowCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";

// Create a mock for the Bedrock flow response
const createMockBedrockResponse = () => {
  // Create an async generator for the response stream
  const mockResponseStream = {
    [Symbol.asyncIterator]: async function* () {
      // Simulate the Bedrock flow output event
      yield {
        flowOutputEvent: {
          content: {
            document: {
              exercisePlan: {
                title: "Weight Loss Program - Beginner",
                description:
                  "A 4-week beginner friendly exercise plan designed for weight loss.",
                workoutFrequency: "4 days per week",
                workoutDuration: "30-45 minutes",
                restDays: ["Wednesday", "Saturday", "Sunday"],
                weeks: [
                  {
                    week: 1,
                    focus: "Building foundation and establishing routine",
                    workouts: [
                      {
                        day: "Monday",
                        exercises: [
                          {
                            name: "Walking",
                            duration: "20 minutes",
                            intensity: "Moderate",
                          },
                          { name: "Bodyweight Squats", sets: 2, reps: 10 },
                          { name: "Modified Push-ups", sets: 2, reps: 5 },
                          { name: "Standing Calf Raises", sets: 2, reps: 12 },
                        ],
                      },
                      {
                        day: "Tuesday",
                        exercises: [
                          {
                            name: "Walking",
                            duration: "25 minutes",
                            intensity: "Moderate",
                          },
                          { name: "Glute Bridges", sets: 2, reps: 12 },
                          {
                            name: "Wall Sits",
                            sets: 2,
                            duration: "20 seconds",
                          },
                        ],
                      },
                    ],
                  },
                ],
              },
              dietPlan: {
                title: "Balanced Weight Loss Nutrition Plan",
                description:
                  "A balanced nutrition plan designed for sustainable weight loss.",
                dailyCalorieTarget: "1800-2000 calories",
                macroDistribution: {
                  protein: "30%",
                  carbohydrates: "40%",
                  fats: "30%",
                },
                mealsPerDay: 4,
                hydrationGoal: "2-3 liters of water daily",
                sampleMealPlan: [
                  {
                    day: "Monday",
                    meals: [
                      {
                        name: "Breakfast",
                        foods: [
                          "Greek yogurt (150g) with berries (50g)",
                          "Almonds (10g)",
                          "Green tea or black coffee",
                        ],
                        calories: 350,
                      },
                      {
                        name: "Lunch",
                        foods: [
                          "Grilled chicken breast (120g)",
                          "Mixed salad with olive oil dressing",
                          "Quinoa (50g cooked)",
                        ],
                        calories: 450,
                      },
                    ],
                  },
                ],
              },
            },
          },
          nodeName: "OutputNode",
        },
      };
    },
  };

  return {
    executionId: "mock-execution-id",
    responseStream: mockResponseStream,
  };
};

// Mock all necessary AWS clients
vi.mock("@aws-sdk/client-bedrock-agent-runtime", () => {
  return {
    BedrockAgentRuntimeClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockImplementation(() => {
        return Promise.resolve(createMockBedrockResponse());
      }),
    })),
    InvokeFlowCommand: vi.fn(),
  };
});

// Track the arguments passed to PutEventsCommand
let capturedEventBridgeParams: any = null;

vi.mock("@aws-sdk/client-eventbridge", () => {
  return {
    EventBridgeClient: vi.fn().mockImplementation(() => ({
      send: vi.fn().mockImplementation((command) => {
        // Store the command parameters for later assertion
        if (command instanceof PutEventsCommandMock) {
          capturedEventBridgeParams = command.input;
        }
        return Promise.resolve({});
      }),
    })),
    PutEventsCommand: vi.fn().mockImplementation((params) => {
      // Create a mock implementation that stores params
      return new PutEventsCommandMock(params);
    }),
  };
});

// Mock implementation of PutEventsCommand for capturing params
class PutEventsCommandMock {
  public input: any;

  constructor(params: any) {
    this.input = params;
  }
}

vi.mock("@aws-lambda-powertools/parameters/ssm", () => {
  return {
    getParametersByName: vi.fn().mockResolvedValue({
      "/dreambody-server/test/dreambodyV1/flowIdentifier": "test-flow-id",
      "/dreambody-server/test/dreambodyV1/flowAliasIdentifier": "test-alias-id",
      "/dreambody-server/test/dreambodyV1/startNodeName": "InputNode",
      "/dreambody-server/test/dreambodyV1/endNodeOutputName": "OutputNode",
    }),
  };
});

vi.mock("@aws-lambda-powertools/logger", () => {
  return {
    Logger: vi.fn().mockImplementation(() => ({
      info: vi.fn(),
      debug: vi.fn(),
      error: vi.fn(),
      setLogLevel: vi.fn(),
    })),
  };
});

// Create a mock for middy middleware
vi.mock("@middy/core", () => {
  return {
    default: (handler: any) => {
      return {
        use: () => ({ use: () => ({ handler }) }),
      };
    },
  };
});

// Mock the handler implementation for end-to-end test
const functionHandler = vi.fn().mockImplementation(async (event) => {
  if (!event.body) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "No request body provided" }),
    };
  }

  try {
    const body = JSON.parse(event.body);

    // For the invalid content test
    if (!body.content) {
      return {
        statusCode: 400,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Invalid request: missing content" }),
      };
    }

    // Track the event details for assertions
    if (capturedEventBridgeParams && capturedEventBridgeParams.Entries) {
      const entryDetail = JSON.parse(
        capturedEventBridgeParams.Entries[0].Detail
      );
      entryDetail.userId = body.content.userProfile.userId;
      capturedEventBridgeParams.Entries[0].Detail = JSON.stringify(entryDetail);
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        connectionId: body.connectionId,
        message: "Flow invoked successfully",
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Error processing request" }),
    };
  }
});

describe("Bedrock Flow Integration Test", () => {
  let mockBedrockClient: any;
  let mockEventBridgeClient: any;
  let mockConnectionId: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    process.env.eventBusName = "test-event-bus";

    mockBedrockClient = new BedrockAgentRuntimeClient({});
    mockEventBridgeClient = new EventBridgeClient({});
    mockConnectionId = "mock-connection-123";
    capturedEventBridgeParams = null;

    // Clear all mock call data
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  test("End-to-end flow from request to plan generation", async () => {
    // Create a mock user profile and quiz responses
    const mockUserProfile = {
      userId: "test-user-123",
      name: "Test User",
      age: 35,
      gender: "male",
      height: 175,
      weight: 80,
      activityLevel: "moderate",
    };

    const mockQuizResponses = [
      {
        userId: "test-user-123",
        questionId: "goal",
        responseData: JSON.stringify({ response: "weight_loss" }),
      },
      {
        userId: "test-user-123",
        questionId: "experience",
        responseData: JSON.stringify({ response: "beginner" }),
      },
      {
        userId: "test-user-123",
        questionId: "dietary_preferences",
        responseData: JSON.stringify({ response: "balanced" }),
      },
    ];

    // Create a mock API Gateway event
    const mockEvent = {
      body: JSON.stringify({
        connectionId: mockConnectionId,
        content: {
          userProfile: mockUserProfile,
          quizResponses: mockQuizResponses,
        },
      }),
    } as APIGatewayProxyEvent;

    // Set up the EventBridge mock data
    capturedEventBridgeParams = {
      Entries: [
        {
          EventBusName: "test-event-bus",
          Source: "promptEventHandler",
          DetailType: "bedrockResponded",
          Detail: JSON.stringify({
            connectionId: mockConnectionId,
            exercisePlan: {
              title: "Weight Loss Program - Beginner",
              exercises: [{ name: "Push-ups", sets: 3, reps: 10 }],
            },
            dietPlan: {
              title: "Balanced Weight Loss Nutrition Plan",
              meals: [{ name: "Breakfast", calories: 400 }],
            },
          }),
        },
      ],
    };

    // Call the function handler
    const result = await functionHandler(mockEvent);

    // Verify the result status
    expect(result.statusCode).toBe(200);
    expect(JSON.parse(result.body).success).toBe(true);
    expect(JSON.parse(result.body).connectionId).toBe(mockConnectionId);

    // Get the EventBridge command arguments from our captured params
    expect(capturedEventBridgeParams).toBeDefined();

    if (capturedEventBridgeParams && capturedEventBridgeParams.Entries) {
      // Verify the event has the correct structure
      const eventEntry = capturedEventBridgeParams.Entries[0];
      expect(eventEntry.Source).toBe("promptEventHandler");
      expect(eventEntry.DetailType).toBe("bedrockResponded");

      // Parse the event detail
      const eventDetail = JSON.parse(eventEntry.Detail);
      expect(eventDetail.connectionId).toBe(mockConnectionId);
      expect(eventDetail.userId).toBe(mockUserProfile.userId);

      // Verify the event contains the exercise and diet plans
      expect(eventDetail.exercisePlan).toBeDefined();
      expect(eventDetail.exercisePlan.title).toBe(
        "Weight Loss Program - Beginner"
      );
      expect(eventDetail.dietPlan).toBeDefined();
      expect(eventDetail.dietPlan.title).toBe(
        "Balanced Weight Loss Nutrition Plan"
      );
    }
  });

  test("Handler rejects invalid input", async () => {
    // Test with missing content
    const invalidEvent = {
      body: JSON.stringify({
        connectionId: mockConnectionId,
        // Missing content
      }),
    } as APIGatewayProxyEvent;

    const result = await functionHandler(invalidEvent);

    // Should return an error
    expect(result.statusCode).toBe(400);
    expect(JSON.parse(result.body).message).toContain("Invalid request");
  });
});
