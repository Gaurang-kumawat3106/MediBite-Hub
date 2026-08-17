type CacheItem<T> = {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheItem<any>>();
const CACHE_TTL = 4 * 1000; // 4 seconds fresh TTL with fast SWR

export const prefetchAPI = (url: string) => {
  if (cache.has(url)) return;

  const promise = fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include"
  })
    .then(async res => {
      if (res.status === 401 || res.status === 403) return null;
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) return null;
      return res.json();
    })
    .then(data => {
      if (data && data.success) {
        cache.set(url, { data, timestamp: Date.now() });
      } else {
        cache.delete(url);
      }
      return data;
    })
    .catch(() => {
      cache.delete(url);
      return null;
    });

  cache.set(url, { data: null, timestamp: 0, promise });
};

export const fetchWithCache = async <T,>(url: string, forceRevalidate = false): Promise<T> => {
  const item = cache.get(url);
  
  if (item && !forceRevalidate) {
    if (item.promise) return item.promise;
    if (Date.now() - item.timestamp < CACHE_TTL) {
      return item.data;
    }
  }

  const promise = fetch(url, {
    headers: { Accept: "application/json" },
    credentials: "include"
  })
    .then(async res => {
      if (res.status === 401) {
        if (typeof window !== "undefined" && 
            !window.location.pathname.startsWith("/login") && 
            !window.location.pathname.startsWith("/register")) {
          window.location.href = "/login";
        }
        return { success: false, error: "Unauthorized", login_required: true } as any;
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { success: false, error: `Server returned non-JSON response (${res.status})` } as any;
      }
      return res.json();
    })
    .then(data => {
      if (data && data.success) {
        cache.set(url, { data, timestamp: Date.now() });
      } else {
        cache.delete(url);
      }
      return data;
    })
    .catch(err => {
      cache.delete(url);
      console.warn("fetchWithCache network warning:", err);
      return { success: false, error: err?.message || "Network connection issue." } as any;
    });

  cache.set(url, { data: null, timestamp: 0, promise });
  return promise;
};

export const invalidateCache = (url: string) => {
  cache.delete(url);
};

export const invalidateAllCache = () => {
  cache.clear();
};

export const invalidateMatchingCache = (pattern: string | RegExp) => {
  for (const key of cache.keys()) {
    if (typeof pattern === "string" ? key.includes(pattern) : pattern.test(key)) {
      cache.delete(key);
    }
  }
};

export const invalidateOrderCaches = () => {
  invalidateMatchingCache("/app/outlet/orders");
  invalidateMatchingCache("/app/outlet/home");
  invalidateMatchingCache("/app/customer/orders");
  invalidateMatchingCache("/app/customer/token");
  invalidateMatchingCache("/app/cart");
};
