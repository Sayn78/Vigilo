import type { PostConfirmationTriggerHandler } from 'aws-lambda';
import {
  CognitoIdentityProviderClient,
  AdminUpdateUserAttributesCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { v4 as uuidv4 } from 'uuid';

const cognito = new CognitoIdentityProviderClient({});

/**
 * Fires after a user confirms their email in Cognito.
 * Generates a UUID and sets custom:tenantId on the user — immutable after this point.
 * The tenantId becomes the data isolation key for all DynamoDB operations.
 */
export const handler: PostConfirmationTriggerHandler = async (event) => {
  const tenantId = uuidv4();

  await cognito.send(
    new AdminUpdateUserAttributesCommand({
      UserPoolId: event.userPoolId,
      Username: event.userName,
      UserAttributes: [{ Name: 'custom:tenantId', Value: tenantId }],
    }),
  );

  console.log(`Assigned tenantId=${tenantId} to user=${event.request.userAttributes.email}`);
  return event;
};
