import { sendDataToDynamoDB, filterExistingOpportunities, getAllIdsFromDynamoDB } from './db.mjs';
import { fetchVolunteerOpportunities } from './api.mjs';
import { transformOpportunities } from './opportunityTransformer.mjs';
import { crawlerLogger } from './logger.mjs';;
import { ID_POSTFIX, BATCH_SIZE } from '../data/constants.mjs';

export async function volunteerSearchByState(location ) {
  try {
    const { success, ids: allRequestsIds} = await getAllIdsFromDynamoDB();

    if(!success) {
      return;
    }

    const { opportunities } = await fetchVolunteerOpportunities(location);

    const newOpportunities = filterExistingOpportunities(allRequestsIds, opportunities, ID_POSTFIX);

    crawlerLogger.updateStats(opportunities.length, newOpportunities.length);

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
        crawlerLogger.logGeneralExecutionError(batchError);
        console.error('Error processing batch:', JSON.stringify(batchError, null, 2));
      }
    }
  } catch (error) {
    crawlerLogger.logGeneralExecutionError(error);
    console.error('Error in volunteerSearchByState:', JSON.stringify(error, null, 2));
  }
}
