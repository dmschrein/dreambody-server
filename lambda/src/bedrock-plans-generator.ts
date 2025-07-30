import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  QueryCommand,
  PutCommand,
} from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";

// Initialize clients
const bedrockClient = new BedrockRuntimeClient({
  region: process.env.AWS_REGION,
});
const dynamoClient = new DynamoDBClient({});
const docClient = DynamoDBDocumentClient.from(dynamoClient);

// Environment variables
const USER_PROFILES_TABLE = process.env.USER_PROFILES_TABLE || "";
const QUIZ_RESPONSES_TABLE = process.env.QUIZ_RESPONSES_TABLE || "";
const EXERCISE_PLANS_TABLE =
  process.env.EXERCISE_PLANS_TABLE || "ExercisePlansDev";
const DIET_PLANS_TABLE = process.env.DIET_PLANS_TABLE || "DietPlansDev";
const BEDROCK_MODEL_ID =
  process.env.BEDROCK_MODEL_ID || "anthropic.claude-3-sonnet-20240229-v1:0";

// Types for generating plans
export type PlanType = "EXERCISE" | "DIET" | "BOTH";

export interface PlanGenerationInput {
  userId: string;
  planType: PlanType;
  preferences?: Record<string, any>;
}

export interface Exercise {
  name: string;
  description?: string;
  sets?: number;
  reps?: number;
  duration?: number;
  notes?: string;
}

export interface ExercisePlan {
  planId: string;
  userId: string;
  title?: string;
  description?: string;
  exercises: Exercise[];
  createdAt: string;
  updatedAt: string;
}

export interface Meal {
  name: string;
  description?: string;
  calories?: number;
  proteins?: number;
  carbs?: number;
  fats?: number;
  recipe?: string;
}

export interface DietPlan {
  planId: string;
  userId: string;
  title?: string;
  description?: string;
  dailyCalories?: number;
  meals: Meal[];
  dietaryRestrictions?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface GeneratePlansResult {
  exercisePlan?: ExercisePlan;
  dietPlan?: DietPlan;
}

export interface UserData {
  profile: any;
  quizResponses: any[];
}

/**
 * Generate exercise and diet plans based on user data and preferences
 */
export async function generateUserPlans(
  input: PlanGenerationInput
): Promise<GeneratePlansResult> {
  try {
    // Step 1: Collect user data (profile + quiz responses)
    const userData = await collectUserData(input.userId);

    const result: GeneratePlansResult = {};
    const timestamp = new Date().toISOString();

    // Step 2: Generate plans based on the requested type
    if (input.planType === "EXERCISE" || input.planType === "BOTH") {
      const exercisePlan = await generateExercisePlan(
        userData,
        input.preferences
      );

      // Save exercise plan to DynamoDB
      const exercisePlanItem: ExercisePlan = {
        planId: uuidv4(),
        userId: input.userId,
        ...exercisePlan,
        exercises: exercisePlan.exercises || [], // Default to empty array if undefined
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await saveExercisePlan(exercisePlanItem);
      result.exercisePlan = exercisePlanItem;
    }

    if (input.planType === "DIET" || input.planType === "BOTH") {
      const dietPlan = await generateDietPlan(userData, input.preferences);

      // Save diet plan to DynamoDB
      const dietPlanItem: DietPlan = {
        planId: uuidv4(),
        userId: input.userId,
        ...dietPlan,
        meals: dietPlan.meals || [], // Default to empty array if undefined
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      await saveDietPlan(dietPlanItem);
      result.dietPlan = dietPlanItem;
    }

    return result;
  } catch (error) {
    console.error("Error generating plans:", error);
    throw error;
  }
}

/**
 * Collect user profile and quiz responses
 */
async function collectUserData(userId: string): Promise<UserData> {
  try {
    // Get user profile
    const profileCommand = new QueryCommand({
      TableName: USER_PROFILES_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
      Limit: 1,
    });

    const profileResult = await docClient.send(profileCommand);
    const profile = profileResult.Items?.[0];

    if (!profile) {
      throw new Error(`User profile not found for userId: ${userId}`);
    }

    // Get quiz responses
    const responsesCommand = new QueryCommand({
      TableName: QUIZ_RESPONSES_TABLE,
      KeyConditionExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":userId": userId,
      },
    });

    const responsesResult = await docClient.send(responsesCommand);
    const quizResponses = responsesResult.Items || [];

    return {
      profile,
      quizResponses,
    };
  } catch (error) {
    console.error("Error collecting user data:", error);
    throw error;
  }
}

/**
 * Generate exercise plan using Amazon Bedrock
 */
async function generateExercisePlan(
  userData: UserData,
  preferences?: Record<string, any>
): Promise<Partial<ExercisePlan>> {
  try {
    const { profile, quizResponses } = userData;

    // Format the prompt for Bedrock
    const prompt = `
You are a professional fitness trainer designing a personalized exercise plan. 
Please create a structured workout plan based on the following information:

USER PROFILE:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Height: ${profile.height ? `${profile.height} cm` : "Not specified"}
- Weight: ${profile.weight ? `${profile.weight} kg` : "Not specified"}

QUIZ RESPONSES:
${quizResponses
  .map(
    (q) =>
      `- Question: ${
        q.questionText || q.questionId
      }\n  Response: ${formatResponse(q.responseData)}`
  )
  .join("\n")}

${
  preferences
    ? `ADDITIONAL PREFERENCES:\n${JSON.stringify(preferences, null, 2)}`
    : ""
}

Please create an exercise plan with:
1. A title for the plan
2. A brief description and overview
3. A structured list of exercises, each with:
   - Name
   - Description
   - Sets (if applicable)
   - Reps (if applicable)
   - Duration (in minutes, if applicable)
   - Any special notes or form tips

Format your response as a JSON object strictly following this structure:
{
  "title": "Plan title",
  "description": "Brief overview of the plan",
  "exercises": [
    {
      "name": "Exercise name",
      "description": "Description",
      "sets": number,
      "reps": number,
      "duration": number,
      "notes": "Special instructions"
    }
  ]
}
`;

    // Call Amazon Bedrock
    const response = await invokeBedrockModel(prompt);

    // Parse the response to extract the exercise plan
    const extractedJson = extractJsonFromResponse(response);
    return extractedJson as Partial<ExercisePlan>;
  } catch (error) {
    console.error("Error generating exercise plan:", error);
    throw error;
  }
}

/**
 * Generate diet plan using Amazon Bedrock
 */
async function generateDietPlan(
  userData: UserData,
  preferences?: Record<string, any>
): Promise<Partial<DietPlan>> {
  try {
    const { profile, quizResponses } = userData;

    // Calculate BMI if height and weight are available
    let bmi = "";
    if (profile.height && profile.weight) {
      const heightInMeters = profile.height / 100;
      const bmiValue = profile.weight / (heightInMeters * heightInMeters);
      bmi = `\nBMI: ${bmiValue.toFixed(1)}`;
    }

    // Format the prompt for Bedrock
    const prompt = `
You are a professional nutritionist designing a personalized diet plan. 
Please create a structured meal plan based on the following information:

USER PROFILE:
- Age: ${profile.age || "Not specified"}
- Gender: ${profile.gender || "Not specified"}
- Height: ${profile.height ? `${profile.height} cm` : "Not specified"}
- Weight: ${profile.weight ? `${profile.weight} kg` : "Not specified"}${bmi}

QUIZ RESPONSES:
${quizResponses
  .map(
    (q) =>
      `- Question: ${
        q.questionText || q.questionId
      }\n  Response: ${formatResponse(q.responseData)}`
  )
  .join("\n")}

${
  preferences
    ? `ADDITIONAL PREFERENCES:\n${JSON.stringify(preferences, null, 2)}`
    : ""
}

Please create a diet plan with:
1. A title for the plan
2. A brief description and overview
3. Recommended daily calories
4. List of dietary restrictions if applicable
5. A structured list of meals, each with:
   - Name
   - Description
   - Estimated calories
   - Macronutrients (proteins, carbs, fats in grams)
   - Simple recipe or preparation method

Format your response as a JSON object strictly following this structure:
{
  "title": "Plan title",
  "description": "Brief overview of the plan",
  "dailyCalories": number,
  "dietaryRestrictions": ["restriction1", "restriction2"],
  "meals": [
    {
      "name": "Meal name",
      "description": "Description",
      "calories": number,
      "proteins": number,
      "carbs": number,
      "fats": number,
      "recipe": "Simple recipe"
    }
  ]
}
`;

    // Call Amazon Bedrock
    const response = await invokeBedrockModel(prompt);

    // Parse the response to extract the diet plan
    const extractedJson = extractJsonFromResponse(response);
    return extractedJson as Partial<DietPlan>;
  } catch (error) {
    console.error("Error generating diet plan:", error);
    throw error;
  }
}

/**
 * Save exercise plan to DynamoDB
 */
async function saveExercisePlan(plan: ExercisePlan): Promise<void> {
  const command = new PutCommand({
    TableName: EXERCISE_PLANS_TABLE,
    Item: plan,
  });

  await docClient.send(command);
}

/**
 * Save diet plan to DynamoDB
 */
async function saveDietPlan(plan: DietPlan): Promise<void> {
  const command = new PutCommand({
    TableName: DIET_PLANS_TABLE,
    Item: plan,
  });

  await docClient.send(command);
}

/**
 * Call Amazon Bedrock model
 */
async function invokeBedrockModel(prompt: string): Promise<string> {
  try {
    // Prepare the request payload based on the model being used (Claude-3)
    const payload = {
      anthropic_version: "bedrock-2023-05-31",
      max_tokens: 4096,
      temperature: 0.7,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    };

    const command = new InvokeModelCommand({
      modelId: BEDROCK_MODEL_ID,
      contentType: "application/json",
      accept: "application/json",
      body: JSON.stringify(payload),
    });

    const response = await bedrockClient.send(command);

    // Parse the response
    const responseBody = new TextDecoder().decode(response.body);
    const parsedResponse = JSON.parse(responseBody);

    // Extract content from the response (format depends on the model)
    return parsedResponse.content?.[0]?.text || "";
  } catch (error) {
    console.error("Error invoking Bedrock model:", error);
    throw error;
  }
}

/**
 * Format quiz response for prompt
 */
function formatResponse(responseData: string | null | undefined): string {
  if (!responseData) return "Not provided";

  try {
    // If it's a JSON string, parse and format it
    const parsed = JSON.parse(responseData);
    return JSON.stringify(parsed, null, 2);
  } catch (e) {
    // If not valid JSON, return as is
    return responseData;
  }
}

/**
 * Extract JSON from Bedrock response
 */
function extractJsonFromResponse(response: string): any {
  try {
    // Attempt to extract valid JSON objects from the response
    const json = findValidJson(response);
    if (json) {
      return json;
    }

    // If no JSON found, throw an error
    console.warn("No JSON found in response");
    throw new Error("No JSON found in response");
  } catch (error) {
    console.error("Error extracting JSON from response:", error);
    throw new Error("Error extracting JSON from response: " + error.message);
  }
}
