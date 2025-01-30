import { deleteDynamoDBItem } from './db.mjs';
import { deleteS3Object } from './s3.mjs';
import { BATCH_SIZE } from '../data/constants.mjs';

export async function processExpiredOpportunities(opportunities) {
  const batches = [];

  for (let i = 0; i < opportunities.length; i += BATCH_SIZE) {
    batches.push(opportunities.slice(i, i + BATCH_SIZE));
  }

  for (const batch of batches) {
    await Promise.all(batch.map(async (opportunity) => {
      if (opportunity.photos) {
        await Promise.all(
          opportunity.photos.map(photoData => deleteS3Object(photoData))
        );
      }
      await deleteDynamoDBItem(opportunity.id);
    }));
  }
}
