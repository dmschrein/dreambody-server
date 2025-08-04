import { Logger } from "@aws-lambda-powertools/logger";

export function setLoggingLevel(logger: Logger): void {
  const logLevel = process.env.LOG_LEVEL || "INFO";
  logger.setLogLevel(logLevel as any);
}
