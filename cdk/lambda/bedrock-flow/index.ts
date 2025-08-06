import { injectLambdaContext } from "@aws-lambda-powertools/logger/middleware";
import { logMetrics } from "@aws-lambda-powertools/metrics/middleware";
import { captureLambdaHandler } from "@aws-lambda-powertools/tracer/middleware";
import {
  APIGatewayProxyEvent,
  APIGatewayProxyResult,
  Handler,
} from "aws-lambda";
import {
  BedrockAgentRuntimeClient,
  InvokeFlowCommand,
} from "@aws-sdk/client-bedrock-agent-runtime";
import {
  EventBridgeClient,
  PutEventsCommand,
} from "@aws-sdk/client-eventbridge";
import { Logger } from "@aws-lambda-powertools/logger";
import { getParametersByName } from "@aws-lambda-powertools/parameters/ssm";
import { Tracer } from "@aws-lambda-powertools/tracer";
import { Metrics } from "@aws-lambda-powertools/metrics";

// Ensure you're initializing them correctly
const logger = new Logger();
const metrics = new Metrics();
const tracer = new Tracer();

// Main handler function
export const functionHandler = async (
  event: APIGatewayProxyEvent
): Promise<APIGatewayProxyResult> => {
  // Get parameters from SSM
  const parameterProps = {
    "/dreambody-server/dreambodyV1/flowIdentifier": {},
    "/dreambody-server/dreambodyV1/flowAliasIdentifier": {},
    "/dreambody-server/dreambodyV1/startNodeName": {},
    "/dreambody-server/dreambodyV1/endNodeOutputName": {},
  };

  const { _errors: paramErrors, ...parameters } = await getParametersByName(
    parameterProps,
    {
      throwOnError: false,
    }
  );

  if (paramErrors?.length) {
    logger.error(`Missing parameters: ${paramErrors.join(", ")}`);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Missing configuration parameters" }),
    };
  }

  const flowId = parameters[
    "/dreambody-server/dreambodyV1/flowIdentifier"
  ] as string;
  const flowAliasId = parameters[
    "/dreambody-server/dreambodyV1/flowAliasIdentifier"
  ] as string;
  const startNodeName = parameters[
    "/dreambody-server/dreambodyV1/startNodeName"
  ] as string;
  const endNodeOutputName = parameters[
    "/dreambody-server/dreambodyV1/endNodeOutputName"
  ] as string;

  if (!event.body) {
    return {
      statusCode: 400,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "No request body provided" }),
    };
  }

  try {
    const body = JSON.parse(event.body);
    const { connectionId, content } = body;

    // Initialize Bedrock client
    const bedrockClient = new BedrockAgentRuntimeClient({});

    // Call the flow with SSM parameters
    const response = await bedrockClient.send(
      new InvokeFlowCommand({
        flowIdentifier: flowId,
        flowAliasIdentifier: flowAliasId,
        inputs: [
          {
            content: { document: content },
            nodeName: startNodeName,
            nodeOutputName: endNodeOutputName,
          },
        ],
      })
    );

    // Process the response stream
    let result = "";
    if (response.responseStream) {
      for await (const chunk of response.responseStream) {
        if (chunk.flowOutputEvent?.content?.document) {
          result = JSON.stringify(chunk.flowOutputEvent.content.document);
        }
      }
    }

    // Publish to EventBridge
    const eventBridgeClient = new EventBridgeClient({});
    await eventBridgeClient.send(
      new PutEventsCommand({
        Entries: [
          {
            EventBusName: process.env.eventBusName,
            Source: "promptEventHandler",
            DetailType: "bedrockResponded",
            Detail: JSON.stringify({
              connectionId,
              response: result ? JSON.parse(result) : {},
            }),
          },
        ],
      })
    );

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        connectionId,
        message: "Flow invoked successfully",
      }),
    };
  } catch (error) {
    logger.error("Error invoking flow", { error });
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "Failed to invoke plan generation flow",
      }),
    };
  }
};

// Export handler with dynamic middleware setup
export const handler: Handler = async (event, context) => {
  // Dynamically import middy
  const { default: middy } = await import("@middy/core");

  // Apply middleware
  const middlewareHandler = middy(functionHandler)
    .use(logMetrics(metrics))
    .use(injectLambdaContext(logger, { logEvent: false }))
    .use(captureLambdaHandler(tracer, { captureResponse: false }));

  // Call the handler with middleware
  return middlewareHandler(event, context);
};
