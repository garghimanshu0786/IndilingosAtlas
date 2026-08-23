import { FAST2, type ScenarioKey } from "./fast2";
import { getDistrict } from "./district";

export type { ScenarioKey };
export type { Fast2Scenario as StreetScenario } from "./fast2";

export type City = {
  id: string;
  name: string;
  country: string;
  iso: number;
  native: string;
  language: string;
  locale: string;
  lat: number;
  lng: number;
  blurb: string;
};

export const STREETS = FAST2;

export const CITIES: City[] = [
  {
    id: "delhi",
    name: "Delhi",
    country: "INDIA",
    iso: 356,
    native: "भारत · दिल्ली",
    language: "Hindi",
    locale: "hi-IN",
    lat: 28.6139,
    lng: 77.209,
    blurb: "A live day district. Walk to the tapri, the mandi, the auto, the clinic.",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    country: "JAPAN",
    iso: 392,
    native: "日本 · 東京",
    language: "Japanese",
    locale: "ja-JP",
    lat: 35.6762,
    lng: 139.6503,
    blurb: "A live day district. Walk to the yatai, the konbini, the koban, the kissaten.",
  },
  {
    id: "seoul",
    name: "Seoul",
    country: "KOREA",
    iso: 410,
    native: "한국 · 서울",
    language: "Korean",
    locale: "ko-KR",
    lat: 37.5665,
    lng: 126.978,
    blurb: "Night market alleys. Korean streets are generated next.",
  },
  {
    id: "paris",
    name: "Paris",
    country: "FRANCE",
    iso: 250,
    native: "France · Paris",
    language: "French",
    locale: "fr-FR",
    lat: 48.8566,
    lng: 2.3522,
    blurb: "A café counter after rain. French streets are generated next.",
  },
  {
    id: "cdmx",
    name: "Mexico City",
    country: "MEXICO",
    iso: 484,
    native: "México · CDMX",
    language: "Spanish",
    locale: "es-MX",
    lat: 19.4326,
    lng: -99.1332,
    blurb: "A market stall under string lights. Spanish streets are generated next.",
  },
  {
    id: "cairo",
    name: "Cairo",
    country: "EGYPT",
    iso: 818,
    native: "مصر · القاهرة",
    language: "Arabic",
    locale: "ar-EG",
    lat: 30.0444,
    lng: 31.2357,
    blurb: "A taxi at the corniche. Arabic streets are generated next.",
  },
  {
    id: "rome",
    name: "Rome",
    country: "ITALY",
    iso: 380,
    native: "Italia · Roma",
    language: "Italian",
    locale: "it-IT",
    lat: 41.9028,
    lng: 12.4964,
    blurb: "A trattoria doorway. Italian streets are generated next.",
  },
];

export function cityById(id: string): City | undefined {
  return CITIES.find((city) => city.id === id);
}

export function cityIsLive(cityId: string): boolean {
  return Boolean(getDistrict(cityId));
}

export function liveDistrictId(cityId: string): string | null {
  return cityIsLive(cityId) ? cityId : null;
}

export function liveSceneId(cityId: string, scenarioKey: ScenarioKey): string | null {
  if (!cityIsLive(cityId)) return null;
  return `${cityId}:${scenarioKey}`;
}

export function streetLabel(cityId: string, key: ScenarioKey): string {
  const place = getDistrict(cityId)?.encounters.find((item) => item.key === key);
  if (place) return FAST2.find((item) => item.key === key)?.label ?? key;
  return FAST2.find((item) => item.key === key)?.label ?? key;
}
