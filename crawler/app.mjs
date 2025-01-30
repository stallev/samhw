import { volunteerSearchByState } from "./utils/search.mjs";
import { findExpiredOpportunities } from "./utils/db.mjs";
import { processExpiredOpportunities } from "./utils/cleanupExpiredOpportunities.mjs";
import { crawlerLogger, deleteExpiredLogger } from "./utils/logger.mjs";

export const volunteerCrawlerHandler = async (event, context) => {
  try {
    let location = '72201';

    if (event.location) {
      location = event.location;
    }

    await volunteerSearchByState(location);

    return {
      status: 'success',
      message: `Added ${crawlerLogger.stats.requestsSuccessfullyUploaded} requests`
    };

  } catch (error) {
    console.error(error);

    return {
      status: 'error',
      error: error.message
    };
  }
};

export const cleanupExpiredOpportunitiesHandler = async () => {
  try {
    const expiredOpportunities = await findExpiredOpportunities();
    
    if (expiredOpportunities.length === 0) {
      console.log('No expired opportunities found');
      return {
        status: 'success',
        message: 'No expired opportunities to clean up'
      };
    }

    await processExpiredOpportunities(expiredOpportunities);

    return {
      status: 'success',
      message: `Cleaned up ${deleteExpiredLogger.stats.deletedRequests} expired opportunities`
    };
  } catch (error) {
    console.error('Error in expired opportunities cleanup:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
};
