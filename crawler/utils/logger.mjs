export class deleteExpiredLoggerClass {
  constructor() {
    this.stats = {
      startTime: Date.now(),
      deletedRequests: 0,
      deletedImages: 0,
      errors: {
        scanRequestsErrors: [],
        dynamoDbErrors: [],
        s3BucketErrors: [],
        generalExecutionErrors: [],
      }
    }
  }

  incrementDeletedRequests() {
    this.stats.deletedRequests++;
  };

  incrementDeletedImages() {
    this.stats.deletedImages++;
  };

  logDynamoDbError(error, id) {
    const errorDetails = {
      requestId: id,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.dynamoDbErrors.push(errorDetails);
    console.error('DynamoDB Delete Item Error:', JSON.stringify(errorDetails, null, 2));
  };

  logS3BucketError(error, key) {
    const errorDetails = {
      key,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.dynamoDbErrors.push(errorDetails);
    console.error('Image Processing Error:', JSON.stringify(errorDetails, null, 2));
  };

  logScanRequestsError(error) {
    const errorDetails = {
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.scanRequestsErrors.push(errorDetails);
    console.error('DynamoDB Scan Requests Error:', JSON.stringify(errorDetails, null, 2));
  };
  
  getReport() {
    const endTime = Date.now();
    const executionTime = (endTime - this.stats.startTime) / 1000;

    const report = {
      executionTime,
      deletedRequests: this.stats.deletedRequests,
      deletedImages: this.stats.deletedImages,
      errors: {
        scanRequestsErrors: this.stats.errors.scanRequestsErrors,
        dynamoDbErrors: this.stats.errors.dynamoDbErrors,
        s3BucketErrors: this.stats.errors.s3BucketErrors,
        generalExecutionErrors: this.stats.errors.generalExecutionErrors,
      }
    };

    console.log('report of the expired requests cleaning', JSON.stringify(report, null, 2));
  }

  logGeneralExecutionError(error) {
    this.stats.errors.generalExecutionErrors.push(error);
    console.error('general Execution Error:', JSON.stringify(errorDetails, null, 2));
  }
}

class crawlerLoggerClass {
  constructor() {
    this.stats = {
      region: '',
      startTime: Date.now(),
      totalSuitableOpportunitiesCount: 0,
      newOpportunities: 0,
      requestsSuccessfullyUploaded: 0,
      summaryRequestsPhotosSize: 0,
      errors: {
        fetchErrors: [],
        geocodingErrors: [],
        fetchingApiKeyErrors: [],
        imageProcessingErrors: [],
        imageUploadingErrors: [],
        dynamoDbErrors: [],
        generalExecutionErrors: [],
      }
    };
  }

  logRegion(region) {
    this.stats.region = region;
  }

  logFetchError(page, location, error) {
    const errorDetails = {
      page,
      location,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    if (error.response) {
      errorDetails.statusCode = error.response.status;
      errorDetails.statusText = error.response.statusText;
    }

    this.stats.errors.fetchErrors.push(errorDetails);
    console.error('Fetch Error:', JSON.stringify(errorDetails, null, 2));
  }

  logGeocodingError(opportunity, error) {
    const errorDetails = {
      opportunityId: opportunity.detail.id,
      opportunityTitle: opportunity.detail.title,
      address: opportunity.detail.location,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.geocodingErrors.push(errorDetails);
    console.error('Geocoding Error:', JSON.stringify(errorDetails, null, 2));
  }

  logImageProcessingError(opportunity, imageUrl, error) {
    const errorDetails = {
      opportunityId: opportunity.detail.id,
      opportunityTitle: opportunity.detail.title,
      imageUrl,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.imageProcessingErrors.push(errorDetails);
    console.error('Image Processing Error:', JSON.stringify(errorDetails, null, 2));
  }

  logImageUploadingError(opportunity, error) {
    const errorDetails = {
      opportunityId: opportunity.detail.id,
      opportunityTitle: opportunity.detail.title,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.imageUploadingErrors.push(errorDetails);
    console.error('Image Uploading Error:', JSON.stringify(errorDetails, null, 2));
  }

  logDynamoDbError(error, data = 'batchItems') {
    const errorDetails = {
      processedData: data,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.dynamoDbErrors.push(errorDetails);
    console.error('DynamoDB Error:', JSON.stringify(errorDetails, null, 2));
  }

  updateStats(totalOpps, newOpps) {
    this.stats.totalSuitableOpportunitiesCount = totalOpps;
    this.stats.newOpportunities = newOpps;
  }

  increaseSuccessfullDbUploads(items) {
    this.stats.requestsSuccessfullyUploaded += items;
  }

  increaseSummaryRequestsPhotosSizeBytes(value) {
    this.stats.summaryRequestsPhotosSize += value;
  }

  logExecutionTime(secondsCount) {
    this.stats.executionTime = secondsCount;
  }

  logFetchingApiKeysError(errorDetails) {
    this.stats.errors.fetchingApiKeyErrors.push(errorDetails);
  }

  logGeneralExecutionError(error) {
    this.stats.errors.generalExecutionErrors.push(error);
  }

  saveReport() {
    const endTime = Date.now();
    const executionTime = (endTime - this.stats.startTime) / 1000;

    const report = {
      region: this.stats.region,
      executionTime,
      startTime: new Date(this.stats.startTime).toISOString(),
      endTime: new Date(endTime).toISOString(),
      statistics: {
        totalSuitableOpportunitiesCount: this.stats.totalSuitableOpportunitiesCount,
        newOpportunities: this.stats.newOpportunities,
        requestsSuccessfullyUploaded: this.stats.requestsSuccessfullyUploaded,
      },
      errors: this.stats.errors
    };

    console.log('report of the requests crawling', JSON.stringify(report, null, 2));
  }
};

export const crawlerLogger = new crawlerLoggerClass();
export const deleteExpiredLogger = new deleteExpiredLoggerClass();