export function getApiUrl(): string {
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname.startsWith("192.168.")) {
      return `${window.location.protocol}//${window.location.hostname}:8000`;
    }
  }
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
}

export function getWsUrl(path: string = "/ws/orders/"): string {
  const api = getApiUrl();
  const wsProto = api.startsWith("https") ? "wss://" : "ws://";
  const host = api.replace(/^https?:\/\//, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${wsProto}${host}${cleanPath}`;
}

export function getImageUrl(url: string | null | undefined, width: number = 360): string | null {
  if (!url) return null;
  
  // If already an absolute URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    if (url.includes("res.cloudinary.com") && url.includes("/upload/")) {
      if (!url.includes("/q_auto")) {
        const transform = width > 0 
          ? `q_auto:good,f_auto,w_${width},c_limit` 
          : `q_auto:good,f_auto`;
        return url.replace("/upload/", `/upload/${transform}/`);
      }
    }
    return url;
  }

  // Handle relative URLs
  const apiUrl = getApiUrl();
  const cleanBase = apiUrl.endsWith("/") ? apiUrl.slice(0, -1) : apiUrl;
  const cleanPath = url.startsWith("/") ? url : `/${url}`;
  
  return `${cleanBase}${cleanPath}`;
}
