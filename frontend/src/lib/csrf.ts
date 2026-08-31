import { getApiUrl } from "./utils";

let cachedToken = "";

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : "";
}

export function getSessionKeyHeader(): Record<string, string> {
  if (typeof window !== "undefined") {
    const key = localStorage.getItem("bb_session_key");
    if (key) {
      return {
        "X-Session-Key": key,
        "Authorization": `Bearer ${key}`
      };
    }
  }
  return {};
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
      headers: {
        "Accept": "application/json",
        ...getSessionKeyHeader()
      },
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
  let token = "";
  try {
    token = await getCSRFToken();
  } catch (e) {
    console.warn("CSRF token fetch bypassed:", e);
  }

  const headers = new Headers(options.headers || {});
  if (token) {
    headers.set("X-CSRFToken", token);
  }
  const sessionHeaders = getSessionKeyHeader();
  Object.entries(sessionHeaders).forEach(([k, v]) => {
    if (!headers.has(k)) {
      headers.set(k, v);
    }
  });

  const requestOptions: RequestInit = {
    ...options,
    headers,
    credentials: options.credentials || "include",
  };

  try {
    return await fetch(url, requestOptions);
  } catch (err) {
    // Retry once if first attempt failed due to transient network glitch
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      console.warn("Retrying fetch request after transient error...", url);
      await new Promise((r) => setTimeout(r, 400));
      return await fetch(url, requestOptions);
    }
    throw err;
  }
}

