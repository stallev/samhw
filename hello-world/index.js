require('dotenv').config();
import { sendDataToDynamoDB, filterExistingOpportunities, getAllIdsFromDynamoDB } from './utils/db';
import { fetchVolunteerOpportunities } from './utils/api';
import { transformOpportunities } from './utils/opportunityTransformer';
import { logger } from './utils/logger';

const initLocation = 'CA';

async function performVolunteerSearchByLocation(initLocation, allRequestsIds) {
  const sourceSitePostfix = 'vlmtch';

  try {
    const { opportunities } = await fetchVolunteerOpportunities(initLocation);

    const newOpportunities = filterExistingOpportunities(allRequestsIds, opportunities, sourceSitePostfix);

    logger.updateStats(opportunities.length, newOpportunities.length);

    const validDataToSave = await transformOpportunities(newOpportunities, sourceSitePostfix);

    if (validDataToSave.length > 0) {
      await sendDataToDynamoDB(validDataToSave);
    } else {
      console.log('No new opportunities to save');
    }
  } catch (error) {
    logger.logGeneralExecutionError(error);
    console.error('Getting requests list error:', error);
  }
}

async function volunteerSearchByState() {
  try {
    const allRequestsIds = await getAllIdsFromDynamoDB();

    await performVolunteerSearchByLocation(initLocation, allRequestsIds);

    const reportData = await logger.saveReport(initLocation);

    return reportData;
  } catch (error) {
    logger.logGeneralExecutionError(error);
    console.error('Error in volunteerSearchByState:', error);

    const reportData = await logger.saveReport(initLocation);
    
    return reportData;
  }
}

volunteerSearchByState();
