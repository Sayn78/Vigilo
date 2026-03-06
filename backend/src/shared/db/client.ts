import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

// Singleton to reuse across warm Lambda invocations
const ddbClient = new DynamoDBClient({});

export const ddb = DynamoDBDocumentClient.from(ddbClient, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertEmptyValues: false,
  },
});

export const MAIN_TABLE = process.env.MAIN_TABLE_NAME ?? 'status-page-main';
export const CHECKS_TABLE = process.env.CHECKS_TABLE_NAME ?? 'status-page-checks';
