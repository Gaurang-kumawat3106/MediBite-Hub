let cachedToken = "";

export async function getCSRFToken(): Promise<string> {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/app/csrf/`, {
      method: "GET",
      headers: { "Accept": "application/json" },
      credentials: "include"
    });
    const contentType = res.headers.get("content-type");
    if (!res.ok || !contentType || !contentType.includes("application/json")) {
      const text = await res.text();
      console.error("Non-JSON response from server during getCSRFToken:", text.substring(0, 1000));
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
