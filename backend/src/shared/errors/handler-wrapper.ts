import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { HttpError } from './http-error';

type HandlerFn = (...args: unknown[]) => Promise<APIGatewayProxyResultV2>;

/**
 * Wraps a Lambda handler to catch errors and return consistent responses.
 */
export function withErrorHandler(fn: HandlerFn): HandlerFn {
  return async (...args: unknown[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof HttpError) {
        return respond(err.statusCode, { error: err.message });
      }
      console.error('Unhandled error:', err);
      return respond(500, { error: 'Internal server error' });
    }
  };
}

export function respond(
  statusCode: number,
  body: unknown,
  headers: Record<string, string> = {},
): APIGatewayProxyResultV2 {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN ?? '*',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type',
      ...headers,
    },
    body: JSON.stringify(body),
  };
}
