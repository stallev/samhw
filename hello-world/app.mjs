/**
 *
 * Event doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html#api-gateway-simple-proxy-for-lambda-input-format
 * @param {Object} event - API Gateway Lambda Proxy Input Format
 *
 * Context doc: https://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-context.html 
 * @param {Object} context
 *
 * Return doc: https://docs.aws.amazon.com/apigateway/latest/developerguide/set-up-lambda-proxy-integrations.html
 * @returns {Object} object - API Gateway Lambda Proxy Output Format
 * 
 */

import { sendDataToDynamoDB, filterExistingOpportunities, getAllIdsFromDynamoDB } from './utils/db.mjs';
import { fetchVolunteerOpportunities } from './utils/api.mjs';
import { transformOpportunities } from './utils/opportunityTransformer.mjs';
import logger from './utils/logger.mjs';

const initLocation = '93721';

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

export const lambdaHandler = async (event, context) => {
  try {
    const report = await volunteerSearchByState();

    return {
      'statusCode': 200,
      'body': JSON.stringify({
        message: 'hello world',
        report,
      })
    }
  } catch (err) {
    console.log(err);
    return err;
  }
};
