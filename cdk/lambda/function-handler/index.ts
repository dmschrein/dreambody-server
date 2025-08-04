import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
  PutCommand,
  UpdateCommand,
} from "@aws-sdk/lib-dynamodb";
import { AppSyncResolverEvent } from "aws-lambda";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables set in the CDK stack
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || "";
const QUIZ_RESPONSES_TABLE = process.env.QUIZ_RESPONSES_TABLE || "";
const EXERCISE_PLANS_TABLE = process.env.EXERCISE_PLANS_TABLE || "";
const DIET_PLANS_TABLE = process.env.DIET_PLANS_TABLE || "";

// Interfaces for our data models
interface UserProfile {
  userId: string;
  name?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
  createdAt?: string;
  updatedAt?: string;
}

interface QuizResponse {
  userId: string;
  questionId: string;
  questionText?: string;
  responseData?: string;
  stepNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}

// Input types matching GraphQL schema
interface UserProfileInput {
  userId: string;
  name?: string;
  age?: number;
  gender?: string;
  height?: number;
  weight?: number;
}

interface QuizResponseInput {
  userId: string;
  questionId: string;
  questionText?: string;
  responseData?: string;
  stepNumber?: number;
}

// GraphQL field arguments
interface GetUserProfileArgs {
  userId: string;
}

interface GetQuizResponsesArgs {
  userId: string;
}

interface CreateUserProfileArgs {
  input: UserProfileInput;
}

interface UpdateUserProfileArgs {
  input: UserProfileInput;
}

interface SaveQuizResponseArgs {
  input: QuizResponseInput;
}

/**
 * Main handler function for all AppSync resolvers
 */
export const handler = async (
  event: AppSyncResolverEvent<any>
): Promise<any> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  const { fieldName } = event.info;
  const args = event.arguments;

  try {
    // Route the request based on the GraphQL field being resolved
    switch (fieldName) {
      // Queries
      case "getUserProfile":
        return await getUserProfile(args.userId);
      case "getQuizResponses":
        return await getQuizResponses(args.userId);
      case "getExercisePlan":
        return await getExercisePlan(args.userId, args.planId);
      case "getDietPlan":
        return await getDietPlan(args.userId, args.planId);
      case "getUserPlans":
        return await getUserPlans(args.userId);

      // Mutations
      case "createUserProfile":
        return await createUserProfile(args.input);
      case "updateUserProfile":
        return await updateUserProfile(args.input);
      case "saveQuizResponse":
        return await saveQuizResponse(args.input);

      default:
        throw new Error(`Unrecognized field name: ${fieldName}`);
    }
  } catch (error) {
    console.error(`Error processing ${fieldName}:`, error);
    throw error;
  }
};

/**
 * Gets a user profile by ID
 */
async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const command = new GetCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { userId },
  });

  const response = await docClient.send(command);
  return (response.Item as UserProfile) || null;
}

/**
 * Gets all quiz responses for a user
 */
async function getQuizResponses(userId: string): Promise<QuizResponse[]> {
  const command = new QueryCommand({
    TableName: QUIZ_RESPONSES_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });

  const response = await docClient.send(command);
  return (response.Items || []) as QuizResponse[];
}

/**
 * Creates a new user profile
 */
async function createUserProfile(
  input: UserProfileInput
): Promise<UserProfile> {
  const timestamp = new Date().toISOString();
  const item: UserProfile = {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const command = new PutCommand({
    TableName: USER_PROFILES_TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(userId)",
  });

  await docClient.send(command);
  return item;
}

/**
 * Updates an existing user profile
 */
async function updateUserProfile(
  input: UserProfileInput
): Promise<UserProfile> {
  const timestamp = new Date().toISOString();
  const { userId, ...updateData } = input;

  // Build update expression dynamically based on provided fields
  const updateExpressions: string[] = [];
  const expressionAttributeNames: Record<string, string> = {};
  const expressionAttributeValues: Record<string, any> = {
    ":updatedAt": timestamp,
  };

  // Always update the updatedAt timestamp
  updateExpressions.push("#updatedAt = :updatedAt");
  expressionAttributeNames["#updatedAt"] = "updatedAt";

  // Add each provided field to the update expression
  Object.entries(updateData).forEach(([key, value]) => {
    if (value !== undefined) {
      const expressionKey = `:${key}`;
      updateExpressions.push(`#${key} = ${expressionKey}`);
      expressionAttributeNames[`#${key}`] = key;
      expressionAttributeValues[expressionKey] = value;
    }
  });

  const command = new UpdateCommand({
    TableName: USER_PROFILES_TABLE,
    Key: { userId },
    UpdateExpression: `SET ${updateExpressions.join(", ")}`,
    ExpressionAttributeNames: expressionAttributeNames,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  });

  const response = await docClient.send(command);
  return response.Attributes as UserProfile;
}

/**
 * Saves a quiz response
 */
async function saveQuizResponse(
  input: QuizResponseInput
): Promise<QuizResponse> {
  const timestamp = new Date().toISOString();
  const item: QuizResponse = {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const command = new PutCommand({
    TableName: QUIZ_RESPONSES_TABLE,
    Item: item,
  });

  await docClient.send(command);
  return item;
}

/**
 * Gets an exercise plan for a user
 */
async function getExercisePlan(userId: string, planId?: string): Promise<any> {
  if (planId) {
    // Get a specific plan
    const command = new GetCommand({
      TableName: EXERCISE_PLANS_TABLE,
      Key: { userId, planId },
    });
    const response = await docClient.send(command);
    return response.Item;
  } else {
    // Get the latest plan
    const command = new QueryCommand({
      TableName: EXERCISE_PLANS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // Descending order (newest first)
      Limit: 1,
    });
    const response = await docClient.send(command);
    return response.Items?.[0] || null;
  }
}

/**
 * Gets a diet plan for a user
 */
async function getDietPlan(userId: string, planId?: string): Promise<any> {
  if (planId) {
    // Get a specific plan
    const command = new GetCommand({
      TableName: DIET_PLANS_TABLE,
      Key: { userId, planId },
    });
    const response = await docClient.send(command);
    return response.Item;
  } else {
    // Get the latest plan
    const command = new QueryCommand({
      TableName: DIET_PLANS_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      ScanIndexForward: false, // Descending order (newest first)
      Limit: 1,
    });
    const response = await docClient.send(command);
    return response.Items?.[0] || null;
  }
}

/**
 * Gets all plans for a user
 */
async function getUserPlans(userId: string): Promise<any> {
  // Get exercise plans
  const exercisePlansCommand = new QueryCommand({
    TableName: EXERCISE_PLANS_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });
  const exercisePlansResponse = await docClient.send(exercisePlansCommand);

  // Get diet plans
  const dietPlansCommand = new QueryCommand({
    TableName: DIET_PLANS_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  });
  const dietPlansResponse = await docClient.send(dietPlansCommand);

  return {
    exercisePlans: exercisePlansResponse.Items || [],
    dietPlans: dietPlansResponse.Items || [],
  };
}
