export const invalidStreetArresses = [
  'Multiple',
  'Various',
  'Near',
  'near',
  'Area',
  'Anywhere',
  'home',
  'Home',
  'Your',
  'P.O.',
  'Box ',
  'County',
  'All over',
  'In and Around',
  'Anywhere in',
  'locations',
  'Your home',
  'PO ',
  'Downtown',
  'locations',
  '__',
  'All',
  'Virtual',
  'Email',
  'various ',
];

export const rejectedOppCategories = [
  'gayLesbianBiTrans',
  'politics',
];

export const categoryMatchData = {
  enviromental: {
    matchesCategories: [
      'environment',
      'disasterRelief'
    ],
    categoryName: 'category.Enviromental',
  },
  animal: {
    matchesCategories: [
      'animals'
    ],
    categoryName: 'category.Animal',
  },
  sports: {
    matchesCategories: [
      'sportsAndRecreation'
    ],
    categoryName: 'category.Sports.Recreation',
  },
  culture: {
    matchesCategories: [
      'artsAndCulture',
      'mediaAndBroadcasting',
      'religion',
      'educationAndLiteracy'
    ],
    categoryName: 'category.Culture',
  },
  humanServices: {
    matchesCategories: [
      'immigrantsAndRefugees',
      'healthAndMedicine',
      'employment',
      'hunger',
      'homelessAndHousing',
      'justiceAndLegal',
      'crisisSupport',
      'disabled',
      'seniors',
      'women',
      'veteransAndMilitaryFamilies',
      'childrenAndYouth',
      'advocacyAndHumanRights',
      'raceAndEthnicity'
    ],
    categoryName: 'category.Human.Services',
  },
};

export const pageFetchingHeaders = {
  'accept': 'application/json',
  'content-type': 'application/json',
  'origin': 'https://www.volunteermatch.org',
  'referer': 'https://www.volunteermatch.org/search',
  'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
};

export const imageFetchingHeaders = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
};

export const ID_POSTFIX = 'vlmtch';

export const BATCH_SIZE = 25;

export const DUE_DATE_DAYS_COUNT = 30;
