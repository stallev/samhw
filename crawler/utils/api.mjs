
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const NodeGeocoder = require('node-geocoder');
import axios from 'axios';
import { crawlerLogger } from './logger.mjs';
import { invalidStreetArresses, pageFetchingHeaders, imageFetchingHeaders } from '../data/constants.mjs';

export async function getLatAndLot(geoProviderCreds, address, opportunity) {
  try {
    let geoCoder = NodeGeocoder(geoProviderCreds);

    const [{ latitude, longitude }] = await geoCoder.geocode(address);
    if (latitude && longitude) {
      return { lat: latitude, lon: longitude };
    }
  } catch (error) {
    if (opportunity) {
      crawlerLogger.logGeocodingError(opportunity, error);
    }
    return null;
  }
}

export async function getImageBuffer(url) {
  try {
    const fullUrl = url.startsWith('http') ? url : `https:${url}`;

    const response = await axios.get(fullUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
      headers: imageFetchingHeaders
    });
    return Buffer.from(response.data, 'binary');
  } catch (error) {
    console.error('Error fetching image:', error.message);
    console.error('Error details:', error.response ? error.response.status : 'No response');

    return [];
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
          categories: []
          skills: []
          radius: "region"
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
              categories
              title
              plaintextDescription
              imageUrl
            }
          }
        }
      }`
    }
  });

  const rejectedOppCategories = [
    'gayLesbianBiTrans',
    'politics',
  ];

  const localOpps = response.data.data.searchSRP.srpOpportunities
    .filter((el) => el?.detail.categories.every(category => !rejectedOppCategories.includes(category)))
    .filter((item) => {
      const street1 = item?.detail?.location?.street1;
      return typeof street1 === 'string' && street1.length > 4;
    })
    .filter((opp) => {
      const street1 = opp.detail.location.street1;
      return invalidStreetArresses.every((invalid) => !street1.includes(invalid)) && /^\d/.test(street1);
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
    const regionName = firstPageData?.srpOpportunities[0]?.detail.location.region;

    crawlerLogger.logRegion(regionName);

    let allOpportunities = [...firstPageData.srpOpportunities];

    const totalPages = Math.ceil(totalResults / 25);

    console.log(`Total results: ${totalResults}, Pages to fetch: ${totalPages}`);

    if (totalPages > 1) {
      const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      for (let page = 2; page <= totalPages; page++) {
        await delay(1000 + Math.random() * 5000);

        try {
          const pageData = await fetchVolunteerOpportunitiesPage(location, page);
          allOpportunities = [...allOpportunities, ...pageData.srpOpportunities];
        } catch (error) {
          crawlerLogger.logFetchError(page, location, error);
          continue;
        }
      }
    }

    return {
      cityLocation,
      opportunities: allOpportunities
    };

  } catch (error) {
    crawlerLogger.logFetchError(1, location, error);
    throw error;
  }
}
