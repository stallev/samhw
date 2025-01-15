import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mime = require('mime-types');
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { getImageBuffer } from './api.mjs';
import logger from './logger.mjs';
import imageQueue from './imageQueue.mjs';
import { logMemoryUsage } from './memoryMonitor.mjs';
import { AWS_USER_CONFIG } from './../config.mjs';

const s3Client = new S3Client(AWS_USER_CONFIG);

async function uploadFileToS3(bucket, buffer, originalUrl, opportunity) {
  if (!buffer) {
    console.error('No buffer provided for upload');
    return {
      success: false,
      error: 'No image buffer'
    };
  }

  try {
    const name = uuidv4();
    const fileName = `${name}.webp`;
    
    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: 'image/webp',
      ACL: 'public-read',
      Metadata: {
        originalUrl,
        uploadedAt: new Date().toISOString(),
        optimized: 'true'
      }
    });
    
    await s3Client.send(command);
    console.log('Successfully uploaded ', fileName);
    
    return {
      objectBucketCreds: {
        bucket,
        region: process.env.REGION || 'us-east-1',
        key: fileName
      }
    };
  } catch (error) {
    logger.logImageUploadingError(opportunity, error);
    
    console.error('Error uploading file to S3:', {
      message: error.message,
      code: error.Code || error.code,
      requestId: error.RequestId || error.requestId
    });
    return {
      success: false,
      error: error.message
    };
  }
}

export async function uploadImageToS3(url, opportunity) {
  try {
    const imageBuffer = await getImageBuffer(url);
    
    if (!imageBuffer) {
      logger.logImageProcessingError(opportunity, url, new Error('Failed to get image buffer'));
      return [];
    }

    const bucketName = 'test-s3-crawler-allev';
    const uploadResult = await uploadFileToS3(bucketName, imageBuffer, url, opportunity);

    return uploadResult.objectBucketCreds?.bucket ? [uploadResult.objectBucketCreds] : [];
  } catch (error) {
    logger.logImageProcessingError(opportunity, url, error);
    return [];
  }
}
