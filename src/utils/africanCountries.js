/** African countries (aligned with `countries` table) + demonyms for people.nationality. */

export const AFRICAN_COUNTRIES = [
  { name: 'Algeria', demonym: 'Algerian' },
  { name: 'Angola', demonym: 'Angolan' },
  { name: 'Benin', demonym: 'Beninese' },
  { name: 'Botswana', demonym: 'Motswana' },
  { name: 'Burkina Faso', demonym: 'Burkinabe' },
  { name: 'Burundi', demonym: 'Burundian' },
  { name: 'Cabo Verde', demonym: 'Cabo Verdean' },
  { name: 'Cameroon', demonym: 'Cameroonian' },
  { name: 'Central African Republic', demonym: 'Central African' },
  { name: 'Chad', demonym: 'Chadian' },
  { name: 'Comoros', demonym: 'Comoran' },
  { name: 'Congo', demonym: 'Congolese' },
  { name: 'Congo (DRC)', demonym: 'Congolese (DRC)' },
  { name: 'Djibouti', demonym: 'Djiboutian' },
  { name: 'Egypt', demonym: 'Egyptian' },
  { name: 'Equatorial Guinea', demonym: 'Equatorial Guinean' },
  { name: 'Eritrea', demonym: 'Eritrean' },
  { name: 'Eswatini', demonym: 'Swazi' },
  { name: 'Ethiopia', demonym: 'Ethiopian' },
  { name: 'Gabon', demonym: 'Gabonese' },
  { name: 'Gambia', demonym: 'Gambian' },
  { name: 'Ghana', demonym: 'Ghanaian' },
  { name: 'Guinea', demonym: 'Guinean' },
  { name: 'Guinea-Bissau', demonym: 'Bissau-Guinean' },
  { name: 'Ivory Coast', demonym: 'Ivorian' },
  { name: 'Kenya', demonym: 'Kenyan' },
  { name: 'Lesotho', demonym: 'Mosotho' },
  { name: 'Liberia', demonym: 'Liberian' },
  { name: 'Libya', demonym: 'Libyan' },
  { name: 'Madagascar', demonym: 'Malagasy' },
  { name: 'Malawi', demonym: 'Malawian' },
  { name: 'Mali', demonym: 'Malian' },
  { name: 'Mauritania', demonym: 'Mauritanian' },
  { name: 'Mauritius', demonym: 'Mauritian' },
  { name: 'Morocco', demonym: 'Moroccan' },
  { name: 'Mozambique', demonym: 'Mozambican' },
  { name: 'Namibia', demonym: 'Namibian' },
  { name: 'Niger', demonym: 'Nigerien' },
  { name: 'Nigeria', demonym: 'Nigerian' },
  { name: 'Rwanda', demonym: 'Rwandan' },
  { name: 'Sao Tome and Principe', demonym: 'Sao Tomean' },
  { name: 'Senegal', demonym: 'Senegalese' },
  { name: 'Seychelles', demonym: 'Seychellois' },
  { name: 'Sierra Leone', demonym: 'Sierra Leonean' },
  { name: 'Somalia', demonym: 'Somali' },
  { name: 'South Africa', demonym: 'South African' },
  { name: 'South Sudan', demonym: 'South Sudanese' },
  { name: 'Sudan', demonym: 'Sudanese' },
  { name: 'Tanzania', demonym: 'Tanzanian' },
  { name: 'Togo', demonym: 'Togolese' },
  { name: 'Tunisia', demonym: 'Tunisian' },
  { name: 'Uganda', demonym: 'Ugandan' },
  { name: 'Zambia', demonym: 'Zambian' },
  { name: 'Zimbabwe', demonym: 'Zimbabwean' },
];

export const AFRICAN_COUNTRY_NAMES = AFRICAN_COUNTRIES.map((c) => c.name);
export const AFRICAN_NATIONALITIES = AFRICAN_COUNTRIES.map((c) => c.demonym);

const byName = new Map(AFRICAN_COUNTRIES.map((c) => [c.name.toLowerCase(), c]));
const byDemonym = new Map(AFRICAN_COUNTRIES.map((c) => [c.demonym.toLowerCase(), c]));

/** Resolve free-text nationality or country name → country entry. */
export function resolveAfricanCountry(value) {
  if (!value) return null;
  const key = String(value).trim().toLowerCase();
  return byName.get(key) || byDemonym.get(key) || null;
}

export function nationalityToCountryName(nationality) {
  return resolveAfricanCountry(nationality)?.name || null;
}

export function countryToDemonym(countryName) {
  return resolveAfricanCountry(countryName)?.demonym || null;
}
