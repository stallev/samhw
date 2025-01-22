
function getFormattedDate(timestampValue) {
  const date = new Date(timestampValue);

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours} ${minutes} ${seconds}`;
};

class Logger {
  constructor() {
    this.stats = {
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
    console.error('Fetch Error:', errorDetails);
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
    console.error('Geocoding Error:', errorDetails);
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
    console.error('Image Processing Error:', errorDetails);
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
    console.error('Image Uploading Error:', errorDetails);
  }

  logDynamoDbError(data, error) {
    const errorDetails = {
      processedData: data,
      errorType: error.name,
      errorMessage: error.message,
      timestamp: new Date().toISOString()
    };

    this.stats.errors.dynamoDbErrors.push(errorDetails);
    console.error('DynamoDB Error:', errorDetails);
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

  async saveReport(location) {
    const endTime = Date.now();
    const executionTime = (endTime - this.stats.startTime) / 1000;

    const report = {
      location,
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

    return report;
  }
}

export default new Logger();
