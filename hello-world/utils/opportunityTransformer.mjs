import { uploadImageToS3 } from './s3.mjs';
import { getLatAndLot } from './api.mjs';
import logger from './logger.mjs';

function formatteAddressString(address) {
  return address
    .split('\n')
    .map(line => line.trim())
    .filter(line => line)
    .join(', ');
}

export async function transformOpportunities(opportunities, sourceSitePostfix) {
  try {
    const transformedData = [];

    for (const opp of opportunities) {
      const id = `${opp.detail.id}${sourceSitePostfix}`;

      if (opp.detail?.id) {
        const address = formatteAddressString(
          `
          ${!!opp.detail.location?.street1.length ? `${opp.detail.location?.street1}` : ''}
          ${!!opp.detail.location?.street2.length ? `${opp.detail.location?.street2}` : ''}
          ${opp.detail.location.city}
          ${opp.detail.location.region}
          ${opp.detail.location.postalCode}
          ${opp.detail.location.country}
          `
        );

        const imageCreds = opp.detail?.imageUrl ? await uploadImageToS3(opp.detail?.imageUrl, opp) : [];
        // const imageCreds = [];
        const location = await getLatAndLot(address, opp);
        const currentDate = new Date();
        
        if(!location) {
          console.log('Wrong location for id ', opp.detail?.id, ' ', 'Location value is ', location);
          continue;
        }

        transformedData.push({
          id,
          title: opp.detail.title,
          description: opp.detail.plaintextDescription,
          address,
          location,
          photos: JSON.stringify(imageCreds),
          owner: 'process.env.OWNER',
          dueDate: (new Date(currentDate.setDate(currentDate.getDate() + 90))).toISOString(),
          category: 'category.Other',
          status: 'approved',
          __typename: 'HelpRequest',
          createdAt: currentDate.toISOString(),
          updatedAt: currentDate.toISOString(),
        });
      }
    }

    return transformedData;
  } catch (error) {
    logger.logGeneralExecutionError(error);
    console.error('Error transforming opportunities:', error);
    throw error;
  }
}
