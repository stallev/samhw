import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mime = require('mime-types');
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { getImageBuffer } from './api.mjs';
import logger from './logger.mjs';

const s3Client = new S3Client({ region: process.env.AWS_REGION || 'us-east-1' });

async function uploadFileToS3(bucket, buffer, originalUrl, opportunity) {
  try {
    const name = uuidv4();

    const contentType = mime.lookup(originalUrl) || 'image/jpeg';
    const fileExtension = mime.extension(contentType) || 'jpg';
    const fileName = `public/${name}.${fileExtension}`;

    const command = new PutObjectCommand({
      Bucket: bucket,
      Key: fileName,
      Body: buffer,
      ContentType: contentType || 'application/octet-stream',
      ACL: 'public-read',
      Metadata: {
        originalUrl: originalUrl,
        uploadedAt: new Date().toISOString()
      }
    });
    
    await s3Client.send(command);
    const objectBucketCreds = {
      bucket,
      region: process.env.AWS_REGION || 'us-east-1',
      key: fileName
    };
    console.log(`Successfully uploaded file: ${fileName}`);

    return {
      objectBucketCreds
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

    const bucketName = process.env.S3_BUCKET_NAME || 'test-s3-crawler-allev';
    const uploadResult = await uploadFileToS3(bucketName, imageBuffer, url, opportunity);

    return uploadResult.objectBucketCreds?.bucket ? [uploadResult.objectBucketCreds] : [];
  } catch (error) {
    logger.logImageProcessingError(opportunity, url, error);
    return [];
  }
}