/** ISO-3166 alpha-2 → display name, for the countries a parenting site sees. */
export const COUNTRY_NAMES: Record<string, string> = {
  US: "United States", GB: "United Kingdom", CA: "Canada", AU: "Australia",
  IE: "Ireland", NZ: "New Zealand", ZA: "South Africa", IN: "India",
  PK: "Pakistan", BD: "Bangladesh", LK: "Sri Lanka", PH: "Philippines",
  SG: "Singapore", MY: "Malaysia", ID: "Indonesia", HK: "Hong Kong",
  AE: "UAE", SA: "Saudi Arabia", QA: "Qatar", KW: "Kuwait", EG: "Egypt",
  DE: "Germany", FR: "France", NL: "Netherlands", BE: "Belgium",
  ES: "Spain", IT: "Italy", PT: "Portugal", PL: "Poland", CH: "Switzerland",
  AT: "Austria", SE: "Sweden", NO: "Norway", DK: "Denmark", FI: "Finland",
  CZ: "Czechia", RO: "Romania", GR: "Greece", TR: "Türkiye", UA: "Ukraine",
  BR: "Brazil", MX: "Mexico", AR: "Argentina", CL: "Chile", CO: "Colombia",
  JP: "Japan", KR: "South Korea", CN: "China", TW: "Taiwan", TH: "Thailand",
  VN: "Vietnam", NG: "Nigeria", KE: "Kenya", GH: "Ghana", IL: "Israel",
};

export const countryName = (code?: string | null) =>
  (code && COUNTRY_NAMES[code]) || code || "Unknown";
