// Lambda function to process Bedrock response events and save plans to DynamoDB
import { EventBridgeEvent } from "aws-lambda";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const EXERCISE_PLANS_TABLE = process.env.EXERCISE_PLANS_TABLE || "";
const DIET_PLANS_TABLE = process.env.DIET_PLANS_TABLE || "";

// Bedrock response event structure
interface BedrockResponseDetail {
  connectionId: string;
  response: {
    exercisePlan?: any;
    dietPlan?: any;
  };
}

interface BedrockResponseEvent {
  source: string;
  "detail-type": string;
  detail: BedrockResponseDetail;
}

/**
 * Processes the Bedrock response event from EventBridge
 */
export const handler = async (
  event: EventBridgeEvent<string, any>
): Promise<void> => {
  console.log("Received event:", JSON.stringify(event, null, 2));

  try {
    const detail = event.detail as BedrockResponseDetail;
    const { connectionId, response } = detail;

    if (!response) {
      console.error("No response in the event detail");
      return;
    }

    const timestamp = new Date().toISOString();

    // Process exercise plan if present
    if (response.exercisePlan) {
      const exercisePlanItem = {
        planId: uuidv4(),
        userId: response.exercisePlan.userId || connectionId.split("-")[0], // Extract userId from connectionId if not provided
        title: response.exercisePlan.title || "Custom Exercise Plan",
        description:
          response.exercisePlan.description ||
          "Generated with Bedrock prompt flows",
        exercises: response.exercisePlan.exercises || [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const exerciseCommand = new PutCommand({
        TableName: EXERCISE_PLANS_TABLE,
        Item: exercisePlanItem,
      });

      await docClient.send(exerciseCommand);
      console.log("Exercise plan saved:", exercisePlanItem.planId);
    }

    // Process diet plan if present
    if (response.dietPlan) {
      const dietPlanItem = {
        planId: uuidv4(),
        userId: response.dietPlan.userId || connectionId.split("-")[0], // Extract userId from connectionId if not provided
        title: response.dietPlan.title || "Custom Diet Plan",
        description:
          response.dietPlan.description ||
          "Generated with Bedrock prompt flows",
        dailyCalories: response.dietPlan.dailyCalories,
        meals: response.dietPlan.meals || [],
        dietaryRestrictions: response.dietPlan.dietaryRestrictions || [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const dietCommand = new PutCommand({
        TableName: DIET_PLANS_TABLE,
        Item: dietPlanItem,
      });

      await docClient.send(dietCommand);
      console.log("Diet plan saved:", dietPlanItem.planId);
    }
  } catch (error) {
    console.error("Error processing event:", error);
    throw error;
  }
};
