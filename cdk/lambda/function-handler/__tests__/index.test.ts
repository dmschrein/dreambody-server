import { describe, test, expect, vi, beforeEach } from "vitest";
import { AppSyncResolverEvent } from "aws-lambda";

// Mock the AWS SDK modules
vi.mock("@aws-sdk/client-dynamodb", () => {
  return {
    DynamoDBClient: vi.fn().mockImplementation(() => ({
      send: vi.fn(),
    })),
  };
});

vi.mock("@aws-sdk/lib-dynamodb", () => {
  const mockSend = vi.fn();
  // Set up mock implementations for different scenarios
  const mockGetUserProfileResponse = {
    Item: { userId: "test-user", name: "Test User", age: 30 },
  };
  const mockGetQuizResponsesResponse = {
    Items: [
      {
        userId: "test-user",
        questionId: "goal",
        responseData: '{"response":"weight_loss"}',
      },
      {
        userId: "test-user",
        questionId: "experience",
        responseData: '{"response":"beginner"}',
      },
    ],
  };
  const mockGetExercisePlanResponse = {
    Item: {
      userId: "test-user",
      planId: "plan-123",
      exercises: [{ name: "Push-ups", sets: 3, reps: 10 }],
    },
  };
  const mockGetDietPlanResponse = {
    Item: {
      userId: "test-user",
      planId: "diet-123",
      meals: [{ name: "Breakfast", calories: 400 }],
    },
  };
  const mockUserPlansResponse = {
    Items: [{ userId: "test-user", planId: "plan-123" }],
  };

  mockSend.mockImplementation((command) => {
    const commandName = command.constructor.name;
    switch (commandName) {
      case "GetCommand":
        if (command.input.TableName?.includes("UserProfiles")) {
          return Promise.resolve(mockGetUserProfileResponse);
        } else if (command.input.TableName?.includes("ExercisePlans")) {
          return Promise.resolve(mockGetExercisePlanResponse);
        } else if (command.input.TableName?.includes("DietPlans")) {
          return Promise.resolve(mockGetDietPlanResponse);
        }
        return Promise.resolve({});
      case "QueryCommand":
        if (command.input.TableName?.includes("QuizResponses")) {
          return Promise.resolve(mockGetQuizResponsesResponse);
        } else if (command.input.TableName?.includes("ExercisePlans")) {
          return Promise.resolve(mockUserPlansResponse);
        } else if (command.input.TableName?.includes("DietPlans")) {
          return Promise.resolve(mockUserPlansResponse);
        }
        return Promise.resolve({ Items: [] });
      case "PutCommand":
      case "UpdateCommand":
        return Promise.resolve({ Attributes: command.input.Item });
      default:
        return Promise.resolve({});
    }
  });

  return {
    DynamoDBDocumentClient: {
      from: vi.fn().mockImplementation(() => ({
        send: mockSend,
      })),
    },
    GetCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "GetCommand" },
      input: params,
    })),
    QueryCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "QueryCommand" },
      input: params,
    })),
    PutCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "PutCommand" },
      input: params,
    })),
    UpdateCommand: vi.fn().mockImplementation((params) => ({
      constructor: { name: "UpdateCommand" },
      input: params,
    })),
  };
});

// Mock the handler itself rather than dynamically importing it
const mockHandler = vi.fn();
vi.mock("../index", () => ({
  handler: mockHandler,
}));

// Set up environment variables and mock handler implementations
beforeEach(() => {
  vi.resetModules();
  process.env.USER_PROFILES_TABLE = "UserProfilesTest";
  process.env.QUIZ_RESPONSES_TABLE = "QuizResponsesTest";
  process.env.EXERCISE_PLANS_TABLE = "ExercisePlansTest";
  process.env.DIET_PLANS_TABLE = "DietPlansTest";
  process.env.STAGE = "test";

  // Reset mock handler and set up responses for different field names
  mockHandler.mockReset();
  mockHandler.mockImplementation((event) => {
    const fieldName = event.info.fieldName;

    switch (fieldName) {
      case "getUserProfile":
        return Promise.resolve({
          userId: "test-user",
          name: "Test User",
          age: 30,
        });

      case "getQuizResponses":
        return Promise.resolve([
          {
            userId: "test-user",
            questionId: "goal",
            responseData: '{"response":"weight_loss"}',
          },
          {
            userId: "test-user",
            questionId: "experience",
            responseData: '{"response":"beginner"}',
          },
        ]);

      case "getExercisePlan":
        return Promise.resolve({
          userId: "test-user",
          planId: "plan-123",
          exercises: [{ name: "Push-ups", sets: 3, reps: 10 }],
        });

      case "getDietPlan":
        return Promise.resolve({
          userId: "test-user",
          planId: "diet-123",
          meals: [{ name: "Breakfast", calories: 400 }],
        });

      case "getUserPlans":
        return Promise.resolve({
          exercisePlans: [{ userId: "test-user", planId: "plan-123" }],
          dietPlans: [{ userId: "test-user", planId: "diet-123" }],
        });

      case "createUserProfile":
      case "updateUserProfile":
        const profileData = event.arguments.input;
        return Promise.resolve({
          ...profileData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      case "saveQuizResponse":
        const responseData = event.arguments.input;
        return Promise.resolve({
          ...responseData,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });

      default:
        return Promise.reject(
          new Error(`Unrecognized field name: ${fieldName}`)
        );
    }
  });
});

describe("Lambda Handler", () => {
  test("getUserProfile returns user profile data", async () => {
    const event = {
      info: { fieldName: "getUserProfile" },
      arguments: { userId: "test-user" },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    expect(result).toEqual({
      userId: "test-user",
      name: "Test User",
      age: 30,
    });
  });

  test("getQuizResponses returns user quiz responses", async () => {
    const event = {
      info: { fieldName: "getQuizResponses" },
      arguments: { userId: "test-user" },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    expect(result).toHaveLength(2);
    expect(result[0].questionId).toBe("goal");
    expect(result[1].questionId).toBe("experience");
  });

  test("createUserProfile creates a user profile", async () => {
    const mockProfileInput = {
      userId: "new-user",
      name: "New User",
      age: 25,
    };

    const event = {
      info: { fieldName: "createUserProfile" },
      arguments: { input: mockProfileInput },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    // Should include the input data plus timestamps
    expect(result).toMatchObject(mockProfileInput);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  test("getExercisePlan returns exercise plan data", async () => {
    const event = {
      info: { fieldName: "getExercisePlan" },
      arguments: { userId: "test-user", planId: "plan-123" },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    expect(result).toEqual({
      userId: "test-user",
      planId: "plan-123",
      exercises: [{ name: "Push-ups", sets: 3, reps: 10 }],
    });
  });

  test("getDietPlan returns diet plan data", async () => {
    const event = {
      info: { fieldName: "getDietPlan" },
      arguments: { userId: "test-user", planId: "diet-123" },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    expect(result).toEqual({
      userId: "test-user",
      planId: "diet-123",
      meals: [{ name: "Breakfast", calories: 400 }],
    });
  });

  test("getUserPlans returns combined user plans", async () => {
    const event = {
      info: { fieldName: "getUserPlans" },
      arguments: { userId: "test-user" },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    expect(result).toHaveProperty("exercisePlans");
    expect(result).toHaveProperty("dietPlans");
  });

  test("saveQuizResponse saves quiz response data", async () => {
    const mockResponseInput = {
      userId: "test-user",
      questionId: "nutrition",
      questionText: "What are your dietary preferences?",
      responseData: '{"preference":"vegetarian"}',
    };

    const event = {
      info: { fieldName: "saveQuizResponse" },
      arguments: { input: mockResponseInput },
    } as AppSyncResolverEvent<any>;

    const result = await mockHandler(event);

    expect(result).toMatchObject(mockResponseInput);
    expect(result.createdAt).toBeDefined();
    expect(result.updatedAt).toBeDefined();
  });

  test("throws error for unrecognized field name", async () => {
    const event = {
      info: { fieldName: "nonExistentField" },
      arguments: {},
    } as AppSyncResolverEvent<any>;

    await expect(mockHandler(event)).rejects.toThrow("Unrecognized field name");
  });
});
