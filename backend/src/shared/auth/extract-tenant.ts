import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';

/**
 * Extracts the tenantId from the Cognito JWT claims.
 * This is the security pivot — tenantId comes only from the validated JWT,
 * never from request body or path parameters.
 */
export function extractTenantId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const tenantId = event.requestContext.authorizer.jwt.claims['custom:tenantId'];
  if (!tenantId || typeof tenantId !== 'string') {
    throw new HttpError(401, 'Missing tenantId claim in token');
  }
  return tenantId;
}

export function extractUserId(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const sub = event.requestContext.authorizer.jwt.claims['sub'];
  if (!sub || typeof sub !== 'string') {
    throw new HttpError(401, 'Missing sub claim in token');
  }
  return sub;
}

export function extractUserEmail(event: APIGatewayProxyEventV2WithJWTAuthorizer): string {
  const email = event.requestContext.authorizer.jwt.claims['email'];
  return typeof email === 'string' ? email : '';
}

// Import here to avoid circular deps — inline definition
import { HttpError } from '../errors/http-error';
