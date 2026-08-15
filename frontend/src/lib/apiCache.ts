type CacheItem<T> = {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheItem<any>>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const prefetchAPI = (url: string) => {
  if (cache.has(url)) return;

  const promise = fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include"
  })
    .then(async res => {
      if (res.status === 401 || res.status === 403) throw new Error("Unauthorized");
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) throw new Error("Not JSON");
      return res.json();
    })
    .then(data => {
      if (data.success) {
        cache.set(url, { data, timestamp: Date.now() });
      } else {
        cache.delete(url);
      }
      return data;
    })
    .catch(err => {
      cache.delete(url);
      throw err;
    });

  cache.set(url, { data: null, timestamp: 0, promise });
};

export const fetchWithCache = async <T,>(url: string, forceRevalidate = false): Promise<T> => {
  const item = cache.get(url);
  
  if (item && !forceRevalidate) {
    if (item.promise) return item.promise;
    if (Date.now() - item.timestamp < CACHE_TTL) {
      prefetchAPI(url);
      return item.data;
    }
  }

  const promise = fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include"
  })
    .then(async res => {
      if (res.status === 401 || res.status === 403) {
         window.location.href = "/login";
         throw new Error("Unauthorized");
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
         window.location.href = "/login";
         throw new Error("Not JSON");
      }
      return res.json();
    })
    .then(data => {
      if (data.success) {
        cache.set(url, { data, timestamp: Date.now() });
      } else {
        cache.delete(url);
      }
      return data;
    })
    .catch(err => {
      cache.delete(url);
      throw err;
    });

  cache.set(url, { data: null, timestamp: 0, promise });
  return promise;
};

export const invalidateCache = (url: string) => {
  cache.delete(url);
};
