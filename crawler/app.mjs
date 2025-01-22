import { volunteerSearchByState } from "./utils/search.mjs";

export const lambdaHandler = async (event, context) => {
  try {
    let location = '11205';

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