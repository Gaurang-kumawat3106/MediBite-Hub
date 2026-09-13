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

export async function getCSRFToken(forceRefresh = false): Promise<string> {
  if (!forceRefresh) {
    const cookieToken = getCookie("csrftoken");
    if (cookieToken) {
      cachedToken = cookieToken;
      return cookieToken;
    }
  }
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
      return cachedToken || getCookie("csrftoken");
    }
    const data = await res.json();
    if (data.csrfToken) {
      cachedToken = data.csrfToken;
      return cachedToken;
    }
  } catch (error) {
    console.error("Failed to fetch CSRF token", error);
  }
  return cachedToken || getCookie("csrftoken");
}

export async function fetchWithCSRF(url: string, options: RequestInit = {}) {
  let token = await getCSRFToken();

  const makeRequest = async (tokenToUse: string) => {
    const headers = new Headers(options.headers || {});
    if (tokenToUse) {
      headers.set("X-CSRFToken", tokenToUse);
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

    return await fetch(url, requestOptions);
  };

  try {
    let res = await makeRequest(token);

    // If request failed with 403 CSRF verification error, force-refresh CSRF token and retry once
    if (res.status === 403) {
      const cloned = res.clone();
      try {
        const json = await cloned.json();
        if (json.csrf_failed || (json.error && json.error.toLowerCase().includes("csrf"))) {
          console.warn("CSRF token verification failed in request. Refreshing token and retrying...", url);
          const freshToken = await getCSRFToken(true);
          if (freshToken) {
            res = await makeRequest(freshToken);
          }
        }
      } catch {
        // Ignore JSON clone parsing errors
      }
    }

    return res;
  } catch (err) {
    // Retry once if first attempt failed due to transient network glitch
    if (err instanceof TypeError && err.message.toLowerCase().includes("fetch")) {
      console.warn("Retrying fetch request after transient error...", url);
      await new Promise((r) => setTimeout(r, 400));
      return await makeRequest(token);
    }
    throw err;
  }
}

