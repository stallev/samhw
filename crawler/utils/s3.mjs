import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const mime = require('mime-types');
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { getImageBuffer } from './api.mjs';
import { crawlerLogger, deleteExpiredLogger } from './logger.mjs';

const s3Client = new S3Client({ region: process.env.MY_AWS_REGION });

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
    
    const photoData = {
      bucket,
      region: process.env.MY_AWS_REGION,
      key: `${name}.${fileExtension}`
    };

    return {
      success: true,
      photoData
    };
  } catch (error) {
    crawlerLogger.logImageUploadingError(opportunity, error);

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

export async function deleteS3Object(photoData) {
  if (!photoData?.bucket || !photoData?.key) return;

  const deleteParams = {
    Bucket: photoData.bucket,
    Key: `public/${photoData.key}`
  };

  try {
    await s3Client.send(new DeleteObjectCommand(deleteParams));

    deleteExpiredLogger.incrementDeletedImages();
  } catch (error) {
    deleteExpiredLogger.logS3BucketError(error, photoData?.key)
  }
}

export async function uploadImageToS3(url, opportunity) {
  try {
    const imageBuffer = await getImageBuffer(url);
    
    if (!imageBuffer) {
      crawlerLogger.logImageProcessingError(opportunity, url, new Error('Failed to get image buffer'));
      return [];
    }

    const bucketName = process.env.S3_BUCKET_NAME;
    const uploadResult = await uploadFileToS3(bucketName, imageBuffer, url, opportunity);
    
    const result = uploadResult.success ? uploadResult.photoData : [];
    
    return result;
  } catch (error) {
    crawlerLogger.logImageProcessingError(opportunity, url, error);

    return [];
  }
}