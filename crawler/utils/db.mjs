import { DynamoDBClient, PutItemCommand, BatchWriteItemCommand, ScanCommand, DeleteItemCommand, QueryCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { crawlerLogger, deleteExpiredLogger } from './logger.mjs';
import { ID_POSTFIX } from '../data/constants.mjs';

const dynamoClient = new DynamoDBClient({ region: process.env.MY_AWS_REGION });

const DYNAMO_DB_TABLE = process.env.DYNAMO_DB_TABLE;

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
    console.error('Error getting all IDs from DynamoDB:', JSON.stringify(error, null, 2));
    throw error;
  }
}

export async function saveDataToDynamoDB(tableName, data) {
  try {
    const cleanData = removeUndefined(data);

    if (cleanData.photos) {
      console.log('Photos before marshalling:', cleanData.photos);
      if (!Array.isArray(cleanData.photos)) {
        cleanData.photos = [cleanData.photos];
      }
    }

    const marshalled = marshall(cleanData, {
      removeUndefinedValues: true,
      convertEmptyValues: true,
      convertClassInstanceToMap: true
    });
    const command = new PutItemCommand({
      TableName: tableName,
      Item: marshalled
    });

    const response = await dynamoClient.send(command);

    crawlerLogger.increaseSuccessfullDbUploads(1);
    return response;
  } catch (error) {
    crawlerLogger.logDynamoDbError(error, data);
    console.error('Error saving to DynamoDB:', JSON.stringify(error, null, 2));
    throw error;
  }
}

async function batchSaveDataToDynamoDB(tableName, items) {
  try {
    const results = [];
    let successfullItemsCount = 0;

    const batchWithCleanedPhotos = items.map(item => {
      const cleanItem = removeUndefined(item);

      cleanItem.photos = cleanItem?.photos?.bucket
        ? Array.isArray(cleanItem.photos) ? cleanItem.photos : [cleanItem.photos]
        : [];
      return cleanItem;
    });

    const writeRequests = batchWithCleanedPhotos.map(item => ({
      PutRequest: {
        Item: marshall(item, {
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

    const processedItemsCount = writeRequests.length - (response.UnprocessedItems?.[tableName]?.length || 0);
    successfullItemsCount += processedItemsCount;

    if (response.UnprocessedItems && Object.keys(response.UnprocessedItems).length > 0) {
      const retryCommand = new BatchWriteItemCommand({
        RequestItems: response.UnprocessedItems
      });
      const retryResponse = await dynamoClient.send(retryCommand);
      results.push(retryResponse);

      const retriedItemsCount = retryResponse?.UnprocessedItems?.[tableName]?.length || 0;
      successfullItemsCount += processedItemsCount - retriedItemsCount;
    }
    
    return { results, successfullItemsCount };
  } catch (error) {
    console.error('Error in batch save to DynamoDB:', JSON.stringify(error, null, 2));
    crawlerLogger.logDynamoDbError(error);

    return { results: [], successfullItemsCount: 0, error };
  }
}

export async function sendDataToDynamoDB(data) {
  try {
    if (data?.length > 1) {
      try {
        const { successfullItemsCount } = await batchSaveDataToDynamoDB(DYNAMO_DB_TABLE, data);

        crawlerLogger.increaseSuccessfullDbUploads(successfullItemsCount);
      } catch (error) {
        console.error('Batch save failed, but continuing execution:', JSON.stringify(error, null, 2));
        crawlerLogger.logDynamoDbError(error);
      }
    } else {
      try {
        await saveDataToDynamoDB(DYNAMO_DB_TABLE, data[0] || data);

        crawlerLogger.increaseSuccessfullDbUploads(1);
      } catch (error) {
        console.error('Single item save failed, but continuing execution:', JSON.stringify(error, null, 2));
        crawlerLogger.logDynamoDbError(error, data);
      }
    }
  } catch (error) {
    console.error('Unexpected error in sendDataToDynamoDB:', error);
  }
}

export async function findExpiredOpportunities() {
  try {
    const now = new Date().toISOString();
    const expiredOpportunities = [];
    let lastEvaluatedKey = null;

    do {
      const scanParams = {
        TableName: DYNAMO_DB_TABLE,
        // FilterExpression: 'contains(id, :postfix) AND dueDate < :now',
        // ExpressionAttributeValues: {
        //   ':postfix': { S: ID_POSTFIX },
        //   ':now': { S: now }
        // },
        FilterExpression: 'contains(id, :postfix)',
        ExpressionAttributeValues: {
          ':postfix': { S: ID_POSTFIX }
        },
        ProjectionExpression: 'id, photos, dueDate',
        ExclusiveStartKey: lastEvaluatedKey
      };

      const command = new ScanCommand(scanParams);
      const response = await dynamoClient.send(command);

      if (response.Items) {
        expiredOpportunities.push(...response.Items.map(item => unmarshall(item)));
      }

      lastEvaluatedKey = response.LastEvaluatedKey;
    } while (lastEvaluatedKey);

    return expiredOpportunities;
  } catch (error) {
    deleteExpiredLogger.logScanRequestsError(error);
  }
}

export async function deleteDynamoDBItem(id) {
  const deleteParams = {
    TableName: DYNAMO_DB_TABLE,
    Key: {
      id: { S: id }
    }
  };

  try {
    await dynamoClient.send(new DeleteItemCommand(deleteParams));

    deleteExpiredLogger.incrementDeletedRequests();
  } catch (error) {
    deleteExpiredLogger.logDynamoDbError(error, id);
  }
}

export function filterExistingOpportunities(dbIdsArr, opportunities, postfix) {
  return opportunities.filter(item => !dbIdsArr.includes(`${item.detail.id}${postfix}`));
}
