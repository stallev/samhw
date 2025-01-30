import { sendDataToDynamoDB, filterExistingOpportunities, getAllIdsFromDynamoDB } from './db.mjs';
import { fetchVolunteerOpportunities } from './api.mjs';
import { transformOpportunities } from './opportunityTransformer.mjs';
import logger from './logger.mjs';
import { ID_POSTFIX, BATCH_SIZE } from '../data/constants.mjs';

export async function volunteerSearchByState(location ) {
  try {
    const allRequestsIds = await getAllIdsFromDynamoDB();

    const { opportunities } = await fetchVolunteerOpportunities(location);

    const newOpportunities = filterExistingOpportunities(allRequestsIds, opportunities, ID_POSTFIX);

    logger.updateStats(opportunities.length, newOpportunities.length);

    if (!newOpportunities.length) {
      console.log('No new volunteer oppotunities');
      return;
    }
    
    const batchesCount = Math.ceil(newOpportunities?.length / BATCH_SIZE);
    const totalBatchedData = [];

    for (let i = 0; i < batchesCount; i++) {
      totalBatchedData.push(newOpportunities.slice(i * BATCH_SIZE, i * BATCH_SIZE + BATCH_SIZE))
    }

    for await (const chunk of totalBatchedData) {
      try {
        const validDataToSave = await transformOpportunities(chunk, ID_POSTFIX);
        await sendDataToDynamoDB(validDataToSave);
        
      } catch (batchError) {
        logger.logGeneralExecutionError(batchError);
        console.error('Error processing batch:', batchError);
      }
    }

    const reportData = await logger.saveReport();

    console.log('execution report ', reportData);

    return reportData;
  } catch (error) {
    logger.logGeneralExecutionError(error);
    console.error('Error in volunteerSearchByState:', error);

    const reportData = await logger.saveReport();

    console.log('execution report ', reportData);

    return reportData;
  }
}
