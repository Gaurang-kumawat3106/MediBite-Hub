import { getApiUrl } from "./utils";

let cachedToken = "";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : "";
}

export async function getCSRFToken(): Promise<string> {
  const cookieToken = getCookie("csrftoken");
  if (cookieToken) {
    cachedToken = cookieToken;
    return cookieToken;
  }
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch(`${getApiUrl()}/app/csrf/`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "include"
    });
    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType || !contentType.includes("application/json")) {
      return "";
    }
    const data = await res.json();
    if (data.csrfToken) {
      cachedToken = data.csrfToken;
      return cachedToken;
    }
  } catch (error) {
    console.error("Failed to fetch CSRF token", error);
  }
  return "";
}

export async function fetchWithCSRF(url: string, options: RequestInit = {}) {
  const token = await getCSRFToken();
  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("X-CSRFToken", token);
  }
  return fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });
}
