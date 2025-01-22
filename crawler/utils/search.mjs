import { sendDataToDynamoDB, filterExistingOpportunities, getAllIdsFromDynamoDB } from './db.mjs';
import { fetchVolunteerOpportunities } from './api.mjs';
import { transformOpportunities } from './opportunityTransformer.mjs';
import logger from './logger.mjs';

export async function volunteerSearchByState(location ) {
  const sourceSitePostfix = 'vlmtch';

  try {
    const allRequestsIds = await getAllIdsFromDynamoDB();

    const { opportunities } = await fetchVolunteerOpportunities(location);

    const newOpportunities = filterExistingOpportunities(allRequestsIds, opportunities, sourceSitePostfix);

    logger.updateStats(opportunities.length, newOpportunities.length);

    if (!newOpportunities.length) {
      console.log('No new volunteer oppotunities');
      return;
    }

    const batchSize = 25;
    const batchesCount = Math.ceil(newOpportunities?.length / batchSize);
    const totalBatchedData = [];

    for (let i = 0; i < batchesCount; i++) {
      totalBatchedData.push(newOpportunities.slice(i * batchSize, i * batchSize + batchSize))
    }

    for await (const chunk of totalBatchedData) {
      try {
        const validDataToSave = await transformOpportunities(chunk, sourceSitePostfix);
        await sendDataToDynamoDB(validDataToSave);
        console.log(`Processed batch of size: ${chunk.length}`);
      } catch (batchError) {
        logger.logGeneralExecutionError(batchError);
        console.error('Error processing batch:', batchError);
      }
    }

    const reportData = await logger.saveReport(location);

    return reportData;
  } catch (error) {
    logger.logGeneralExecutionError(error);
    console.error('Error in volunteerSearchByState:', error);

    const reportData = await logger.saveReport(location);

    return reportData;
  }
}
