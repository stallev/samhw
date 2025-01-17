import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand, ScanCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import logger from './logger.mjs';

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });

const DYNAMO_DB_TABLE = process.env.DYNAMO_DB_TABLE || 'testCrawlerTable';

function removeUndefined(obj) {
  return Object.fromEntries(
    Object.entries(obj)
      .filter(([_, value]) => value !== undefined)
      .map(([key, value]) => [
        key,
        value && typeof value === 'object' ? removeUndefined(value) : value
      ])
  );
}

export async function getAllIdsFromDynamoDB() {
  try {
    const ids = [];
    let lastEvaluatedKey = null;

    do {
      const params = {
        TableName: DYNAMO_DB_TABLE,
        ProjectionExpression: "id",
        ExclusiveStartKey: lastEvaluatedKey
      };

      const command = new ScanCommand(params);
      const response = await dynamoClient.send(command);

      if (response.Items) {
        ids.push(...response.Items.map(item => unmarshall(item).id));
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);
    console.log('Help requests count before crawling is ', ids?.length);

    return ids;
  } catch (error) {
    console.error('Error getting all IDs from DynamoDB:', error);
    throw error;
  }
}

export async function saveDataToDynamoDB(tableName, data) {
  try {
    const cleanData = removeUndefined(data);
    const marshalled = marshall(cleanData, {
      removeUndefinedValues: true,
      convertEmptyValues: true
    });

    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshalled
    });
    const response = await dynamoClient.send(command);

    logger.increaseSuccessfullDbUploads(1);

    return response;
  } catch (error) {
    logger.logDynamoDbError(data, error);
    
    console.error('Error saving to DynamoDB:', error);
    throw error;
  }
}

async function batchSaveDataToDynamoDB(tableName, items) {
  try {
    const batchSize = 25;
    const results = [];
    let successfullItemsCount = 0;

    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize);
      
      const writeRequests = batch.map(item => ({
        PutRequest: {
          Item: marshall(removeUndefined(item), {
            removeUndefinedValues: true,
            convertEmptyValues: true
          })
        }
      }));

      const command = new BatchWriteItemCommand({
        RequestItems: {
          [tableName]: writeRequests
        }
      });

      const response = await dynamoClient.send(command);
      results.push(response);
      
      const processedItemsCount = writeRequests.length - 
        (response.UnprocessedItems?.[tableName]?.length || 0);
      successfullItemsCount += processedItemsCount;
      
      console.log('Successfull uploaded requests ', successfullItemsCount);
      
      if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
        const retryCommand = new BatchWriteItemCommand({
          RequestItems: response.UnprocessedItems
        });
        const retryResponse = await dynamoClient.send(retryCommand);
        results.push(retryResponse);

        const retriedItemsCount = retryResponse?.UnprocessedItems?.[tableName]?.length || 0;
        successfullItemsCount += processedItemsCount - retriedItemsCount;
      }
      
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`Total successfully saved items: ${successfullItemsCount}`);
    return { results, successfullItemsCount };
  } catch (error) {
    console.error('Error in batch save to DynamoDB:', error);
    throw error;
  }
}

export async function sendDataToDynamoDB(data) {
  try {
    let savedRequestsCount;
    
    if (data?.length > 1) {
      const { successfullItemsCount } = await batchSaveDataToDynamoDB(DYNAMO_DB_TABLE, data);
      savedRequestsCount = successfullItemsCount;

      logger.increaseSuccessfullDbUploads(successfullItemsCount);

      console.log(`Successfully saved ${successfullItemsCount} items to DynamoDB`);
    } else {
      await saveDataToDynamoDB(DYNAMO_DB_TABLE, data);

      logger.increaseSuccessfullDbUploads(1);
      
      console.log('Successfully saved item to DynamoDB');
    }
    
  } catch (error) {
    console.error('Error in sendDataToDynamoDB:', error);
    throw error;
  }
}

export function filterExistingOpportunities(dbIdsArr, opportunities, postfix) {
  return opportunities.filter(item => !dbIdsArr.includes(`${item.detail.id}${postfix}`));
}