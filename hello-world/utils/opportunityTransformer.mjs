import { uploadImageToS3 } from './s3.mjs';
import { getLatAndLot } from './api.mjs';
import { logMemoryUsage, attemptGarbageCollection } from './memoryMonitor.mjs';
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
    const BATCH_SIZE = 5;

    // Обрабатываем opportunities батчами
    for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
      const batch = opportunities.slice(i, i + BATCH_SIZE);

      for (const opp of batch) {
        if (opp.detail?.id) {
          const id = `${opp.detail.id}${sourceSitePostfix}`;

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

          // Параллельно запускаем получение координат и обработку изображения
          const [imageCreds, location] = await Promise.all([
            opp.detail?.imageUrl ? uploadImageToS3(opp.detail?.imageUrl, opp) : [],
            getLatAndLot(address, opp)
          ]);

          if (!location) {
            console.log('Wrong location for id ', opp.detail?.id, ' ', 'Location value is ', location);
            continue;
          }

          const currentDate = new Date();
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

      // После каждого батча даем время на сборку мусора
      global.gc && global.gc();
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return transformedData;
  } catch (error) {
    logger.logGeneralExecutionError(error);
    console.error('Error transforming opportunities:', error);
    throw error;
  }
}