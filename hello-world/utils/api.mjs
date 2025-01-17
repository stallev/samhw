
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NodeGeocoder = require('node-geocoder');
import axios from 'axios';
import sharp from 'sharp';
import logger from './logger.mjs';
import { invalidStreetArresses, pageFetchingHeaders, imageFetchingHeaders } from '../data/constants.mjs';

const PIXEL_LIMIT = 100000000;

sharp.cache(false);

const options = {
  provider: 'google',
  apiKey: '',
};

export async function getLatAndLot(address, opportunity) {
  try {
    let geoCoder = NodeGeocoder(options);
    const [{ latitude, longitude }] = await geoCoder.geocode(address);
    if (latitude && longitude) {
      return { lat: latitude, lon: longitude };
    }
  } catch (error) {
    if (opportunity) {
      logger.logGeocodingError(opportunity, error);
    }
    return null;
  }
}

const getTimeout = (url) => {
  if (url.includes('cloudinary.com') || url.includes('amazonaws.com')) {
    return 15000;
  }
  return 20000;
}

export async function getImageBuffer(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https:${url}`;

    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: getTimeout(fullUrl),
      headers: imageFetchingHeaders
    });

    const metadata = await sharp(Buffer.from(response.data, 'binary'), {
      failOnError: false
    }).metadata();

    if (!metadata) {
      console.error('Unable to get image metadata');
      return null;
    }

    console.log('Processing image:', {
      originalWidth: metadata.width,
      originalHeight: metadata.height,
      format: metadata.format,
      size: response.data.length
    });

    const totalPixels = (metadata.width || 0) * (metadata.height || 0);
    if (totalPixels > PIXEL_LIMIT) {
      console.warn(`Large image detected (${totalPixels} pixels). Attempting preliminary resize...`);

      const scale = Math.sqrt(PIXEL_LIMIT / totalPixels);
      const preliminaryWidth = Math.floor(metadata.width * scale);
      const preliminaryHeight = Math.floor(metadata.height * scale);

      const preliminaryBuffer = await sharp(Buffer.from(response.data, 'binary'), {
        failOnError: false,
        limitInputPixels: false
      })
        .resize(preliminaryWidth, preliminaryHeight)
        .toBuffer();

      const pipeline = sharp(preliminaryBuffer, {
        failOnError: false,
        limitInputPixels: PIXEL_LIMIT
      });

      const finalMetadata = await pipeline.metadata();
      const targetWidth = Math.min(finalMetadata.width || 0, 900);

      return await pipeline
        .resize({
          width: targetWidth,
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({
          quality: 80,
          effort: 4,
          mixed: true
        })
        .toBuffer();
    }

    const pipeline = sharp(Buffer.from(response.data, 'binary'), {
      failOnError: false,
      limitInputPixels: PIXEL_LIMIT
    });

    const targetWidth = Math.min(metadata.width || 0, 900);

    const optimizedBuffer = await pipeline
      .resize({
        width: targetWidth,
        withoutEnlargement: true,
        fit: 'inside'
      })
      .webp({
        quality: 80,
        effort: 4,
        mixed: true
      })
      .toBuffer();

    const finalMetadata = await sharp(optimizedBuffer).metadata();
    console.log('Image processed successfully:', {
      finalWidth: finalMetadata.width,
      finalHeight: finalMetadata.height,
      finalSize: optimizedBuffer.length,
      compressionRatio: (response.data.length / optimizedBuffer.length).toFixed(2)
    });

    return optimizedBuffer;
  } catch (error) {
    console.error('Error processing image:', {
      url: url,
      error: error.message,
      stack: error.stack,
      response: error.response ? {
        status: error.response.status,
        headers: error.response.headers
      } : 'No response'
    });
    return null;
  }
}

async function fetchVolunteerOpportunitiesPage(location, pageNumber) {
  const response = await axios({
    method: 'post',
    url: 'https://www.volunteermatch.org/s/srp/search',
    headers: pageFetchingHeaders,
    data: {
      query: `query {
        searchSRP(input:{
          returnVirtualAndOnSiteOpps: true
          location: "${location}"
          virtual: false
          categories: []
          skills: []
          radius: "20"
          greatFor: []
          timeslots: []
          specialFlag: ""
          keywords: []
          pageNumber: ${pageNumber}
          sortCriteria: null
          numberOfResults: 25
        }){
          numberOfResults
          resultsSize
          originalResultSize
          cityLocation
          srpOpportunities{
            detail {
              id
              location {
                city
                country
                postalCode
                region
                street1
                street2
                virtual
              }
              title
              plaintextDescription
              imageUrl
            }
          }
        }
      }`
    }
  });

  const localOpps = response.data.data.searchSRP.srpOpportunities
    .filter((item) => {
      const street1 = item?.detail?.location?.street1;
      return typeof street1 === 'string' && street1.length > 4;
    })
    .filter((opp) => {
      const street1 = opp.detail.location.street1;
      return invalidStreetArresses.every((invalid) => !street1.includes(invalid));
    });

  const pageData = {
    ...response.data.data.searchSRP,
    srpOpportunities: localOpps,
  };

  return pageData;
}

export async function fetchVolunteerOpportunities(location) {
  try {
    const firstPageData = await fetchVolunteerOpportunitiesPage(location, 1);

    const totalResults = firstPageData?.resultsSize;
    const cityLocation = firstPageData.cityLocation;

    let allOpportunities = [...firstPageData.srpOpportunities];

    const totalPages = Math.ceil(totalResults / 25);

    console.log(`Total results: ${totalResults}, Pages to fetch: ${totalPages}`);

    if (totalPages > 1) {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      for (let page = 2; page <= totalPages; page++) {
        console.log(`Fetching page ${page} of ${totalPages}. State is ${location}`);
        await delay(1000 + Math.random() * 5000);

        try {
          const pageData = await fetchVolunteerOpportunitiesPage(location, page);
          allOpportunities = [...allOpportunities, ...pageData.srpOpportunities];
        } catch (error) {
          logger.logFetchError(page, location, error);
          continue;
        }
      }
    }

    return {
      cityLocation,
      opportunities: allOpportunities
    };

  } catch (error) {
    logger.logFetchError(1, location, error);
    throw error;
  }
}
