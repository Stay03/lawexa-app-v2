const COUNTRY_NAME_TO_CODE: Record<string, string> = {
  Nigeria: 'NG',
  Ghana: 'GH',
  'South Africa': 'ZA',
  Kenya: 'KE',
  Cameroon: 'CM',
  Tanzania: 'TZ',
  Uganda: 'UG',
  Rwanda: 'RW',
  Ethiopia: 'ET',
  Egypt: 'EG',
  Senegal: 'SN',
  'Ivory Coast': 'CI',
  "Côte d'Ivoire": 'CI',
  Gambia: 'GM',
  'Sierra Leone': 'SL',
  Liberia: 'LR',
  Togo: 'TG',
  Benin: 'BJ',
  Niger: 'NE',
  Mali: 'ML',
  'Burkina Faso': 'BF',
  Zimbabwe: 'ZW',
  Zambia: 'ZM',
  Malawi: 'MW',
  Mozambique: 'MZ',
  Botswana: 'BW',
  Namibia: 'NA',
  Angola: 'AO',
  Congo: 'CG',
  'Democratic Republic of the Congo': 'CD',
  Sudan: 'SD',
  'South Sudan': 'SS',
  Somalia: 'SO',
  Morocco: 'MA',
  Tunisia: 'TN',
  Algeria: 'DZ',
  Libya: 'LY',
  'United States': 'US',
  'United Kingdom': 'GB',
  Canada: 'CA',
  Australia: 'AU',
  India: 'IN',
  Germany: 'DE',
  France: 'FR',
  Netherlands: 'NL',
  Ireland: 'IE',
  'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA',
  China: 'CN',
  Japan: 'JP',
  Brazil: 'BR',
  Malaysia: 'MY',
  Singapore: 'SG',
};

export function getCountryCode(countryName: string): string | null {
  if (COUNTRY_NAME_TO_CODE[countryName]) {
    return COUNTRY_NAME_TO_CODE[countryName];
  }

  const lowerName = countryName.toLowerCase();
  for (const [name, code] of Object.entries(COUNTRY_NAME_TO_CODE)) {
    if (name.toLowerCase() === lowerName) {
      return code;
    }
  }

  return null;
}
