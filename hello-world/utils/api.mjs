
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NodeGeocoder = require('node-geocoder');
import axios from 'axios';
import Jimp from 'jimp';
import stream from 'stream';
import { promisify } from 'util';
import logger from './logger.mjs';
import { logMemoryUsage, attemptGarbageCollection, trackPeakMemory } from './memoryMonitor.mjs';
import { invalidStreetArresses, pageFetchingHeaders, imageFetchingHeaders } from '../data/constants.mjs';

const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // Уменьшаем до 5MB
const PIXEL_LIMIT = 4000000; // Примерно 2000x2000 пикселей
const MAX_WIDTH = 900;
const DEFAULT_QUALITY = 70; // Уменьшаем качество для меньшего размера

const options = {
  provider: 'google',
  apiKey: '',
};

// const pipeline = promisify(stream.pipeline);

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

export async function getImageBuffer(imageUrl, maxWidth = MAX_WIDTH, quality = DEFAULT_QUALITY) {
  try {
    // Предварительная проверка размера
    const headResponse = await axios.head(imageUrl, {
      timeout: getTimeout(imageUrl),
      headers: imageFetchingHeaders
    });
    
    const contentLength = parseInt(headResponse.headers['content-length'], 10);
    if (contentLength > MAX_IMAGE_SIZE) {
      throw new Error(`Image size ${contentLength} bytes exceeds maximum allowed size of ${MAX_IMAGE_SIZE} bytes`);
    }

    // Загружаем изображение чанками
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: getTimeout(imageUrl),
      maxContentLength: MAX_IMAGE_SIZE,
      headers: {
        ...imageFetchingHeaders,
        'Range': 'bytes=0-' + MAX_IMAGE_SIZE
      }
    });

    let image;
    try {
      const buffer = Buffer.from(response.data);
      image = await Jimp.read(buffer);
      // Освобождаем память
      buffer.fill(0);
      global.gc && global.gc();
    } catch (error) {
      throw new Error(`Failed to process image: ${error.message}`);
    }

    const { width, height } = image.bitmap;
    const pixelCount = width * height;
    
    if (pixelCount > PIXEL_LIMIT) {
      // Для больших изображений сначала уменьшаем размер
      const scale = Math.sqrt(PIXEL_LIMIT / pixelCount);
      const newWidth = Math.floor(width * scale);
      const newHeight = Math.floor(height * scale);
      image.resize(newWidth, newHeight);
    }

    // Применяем максимальную ширину, если нужно
    if (image.bitmap.width > maxWidth) {
      const newHeight = Math.round((maxWidth / image.bitmap.width) * image.bitmap.height);
      image.resize(maxWidth, newHeight);
    }

    // Оптимизируем качество
    image.quality(quality);

    // Получаем буфер и сразу освобождаем память изображения
    const result = {
      imageBuffer: await image.getBufferAsync(Jimp.MIME_JPEG),
      contentType: Jimp.MIME_JPEG,
    };

    // Явно освобождаем ресурсы
    image.bitmap.data = null;
    image = null;
    global.gc && global.gc();

    return result;
  } catch (error) {
    const enhancedError = new Error(`Failed to process image from ${imageUrl}: ${error.message}`);
    enhancedError.originalError = error;
    throw enhancedError;
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