import { INDILINGO_API_KEY_ENV, INDILINGO_API_URL_ENV } from "./constants";

export { INDILINGO_API_KEY_ENV, INDILINGO_API_URL_ENV };

export function indilingoApiUrl(): string {
  const url = process.env[INDILINGO_API_URL_ENV]?.trim();
  if (!url) throw new Error(`${INDILINGO_API_URL_ENV} is missing on the server.`);
  return url.replace(/\/$/, "");
}

export function indilingoApiKey(): string | undefined {
  return process.env[INDILINGO_API_KEY_ENV]?.trim() || undefined;
}

export function indilingoHeaders(json = false): HeadersInit {
  const headers: Record<string, string> = {};
  if (json) headers["Content-Type"] = "application/json";
  const key = indilingoApiKey();
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

export async function indilingoFetch(path: string, init?: RequestInit): Promise<Response> {
  const url = `${indilingoApiUrl()}${path.startsWith("/") ? path : `/${path}`}`;
  return fetch(url, {
    ...init,
    headers: {
      ...indilingoHeaders(Boolean(init?.body)),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
}
