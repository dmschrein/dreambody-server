const AWS = require("aws-sdk");
const docClient = new AWS.DynamoDB.DocumentClient();

const USER_PROFILE_TABLE = process.env.USER_PROFILE_TABLE;
const QUIZ_RESPONSE_TABLE = process.env.QUIZ_RESPONSE_TABLE;

exports.handler = async (event) => {
  console.log("Event:", JSON.stringify(event, null, 2));

  const { field, arguments: args } = event.info;

  try {
    switch (field) {
      // Queries
      case "getUserProfile":
        return await getUserProfile(args.userId);
      case "getQuizResponses":
        return await getQuizResponses(args.userId);

      // Mutations
      case "createUserProfile":
        return await createUserProfile(args.input);
      case "updateUserProfile":
        return await updateUserProfile(args.input);
      case "saveQuizResponse":
        return await saveQuizResponse(args.input);

      default:
        throw new Error(`Unknown field, unable to resolve ${field}`);
    }
  } catch (error) {
    console.error(`Error processing request: ${error}`);
    throw error;
  }
};

// Query Resolvers

async function getUserProfile(userId) {
  const params = {
    TableName: USER_PROFILE_TABLE,
    Key: {
      userId,
    },
  };

  const result = await docClient.get(params).promise();
  return result.Item;
}

async function getQuizResponses(userId) {
  const params = {
    TableName: QUIZ_RESPONSE_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": userId,
    },
  };

  const result = await docClient.query(params).promise();
  return result.Items;
}

// Mutation Resolvers

async function createUserProfile(input) {
  const timestamp = new Date().toISOString();
  const item = {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const params = {
    TableName: USER_PROFILE_TABLE,
    Item: item,
    ConditionExpression: "attribute_not_exists(userId)",
  };

  await docClient.put(params).promise();
  return item;
}

async function updateUserProfile(input) {
  const timestamp = new Date().toISOString();
  const { userId, ...attributes } = input;

  let updateExpression = "SET updatedAt = :updatedAt";
  const expressionAttributeValues = {
    ":updatedAt": timestamp,
  };

  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      updateExpression += `, ${key} = :${key}`;
      expressionAttributeValues[`:${key}`] = value;
    }
  });

  const params = {
    TableName: USER_PROFILE_TABLE,
    Key: { userId },
    UpdateExpression: updateExpression,
    ExpressionAttributeValues: expressionAttributeValues,
    ReturnValues: "ALL_NEW",
  };

  const result = await docClient.update(params).promise();
  return result.Attributes;
}

async function saveQuizResponse(input) {
  const timestamp = new Date().toISOString();
  const item = {
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const params = {
    TableName: QUIZ_RESPONSE_TABLE,
    Item: item,
  };

  await docClient.put(params).promise();
  return item;
}
