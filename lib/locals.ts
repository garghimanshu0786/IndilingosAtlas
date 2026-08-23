import { CITIES, cityById, cityIsLive, type City } from "./atlas";

export type Local = City & {
  city: string;
  sceneId: string | null;
  line: string;
  role: string;
};

export const LOCALS: Local[] = CITIES.map((place) => ({
  ...place,
  city: place.name,
  sceneId: cityIsLive(place.id) ? place.id : null,
  line: place.blurb,
  role: place.language,
}));

export function localById(id: string): Local | undefined {
  return LOCALS.find((place) => place.id === id) ?? (cityById(id) as Local | undefined);
}
