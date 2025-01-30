import { volunteerSearchByState } from "./utils/search.mjs";
import { findExpiredOpportunities } from "./utils/db.mjs";
import { processExpiredOpportunities } from "./utils/cleanupExpiredOpportunities.mjs";

export const volunteerCrawlerHandler = async (event, context) => {
  try {
    let location = '17101';

    if (event.location) {
      location = event.location;
    }

    const report = await volunteerSearchByState(location);

    return {
      status: 'success',
      report
    };

  } catch (err) {
    console.error(err);
    return {
      status: 'error',
      error: err.message
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
      message: `Cleaned up ${expiredOpportunities.length} expired opportunities`
    };
  } catch (error) {
    console.error('Error in expired opportunities cleanup:', error);
    return {
      status: 'error',
      error: error.message
    };
  }
};
