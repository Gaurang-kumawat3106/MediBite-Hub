import { getSessionKeyHeader } from "./csrf";

type CacheItem<T> = {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheItem<any>>();
const DEFAULT_TTL = 30 * 1000; // 30s fresh TTL for static/menu data
const TRANSACTIONAL_TTL = 4 * 1000; // 4s fresh TTL for live carts & active queues

function getAuthHeaders(extraHeaders: Record<string, string> = {}): Record<string, string> {
  return {
    Accept: "application/json",
    ...getSessionKeyHeader(),
    ...extraHeaders,
  };
}

export const prefetchAPI = (url: string) => {
  if (cache.has(url)) return;

  fetch(url, {
    headers: getAuthHeaders(),
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
    })
    .catch(() => {
      cache.delete(url);
    });
};

export const fetchWithCache = async <T,>(url: string, forceRevalidate = false): Promise<T> => {
  const item = cache.get(url);
  const isTransactional = url.includes("/cart") || url.includes("/orders") || url.includes("/token");
  const ttl = isTransactional ? TRANSACTIONAL_TTL : DEFAULT_TTL;

  // 1. Fast Cache Hit: If cached data exists and forceRevalidate is not requested
  if (item?.data && !forceRevalidate) {
    // If expired, trigger background revalidation (Stale-While-Revalidate)
    if (Date.now() - item.timestamp > ttl && !item.promise) {
      const backgroundPromise = fetch(url, {
        headers: getAuthHeaders(),
        credentials: "include"
      })
        .then(res => res.json())
        .then(newData => {
          if (newData && newData.success) {
            cache.set(url, { data: newData, timestamp: Date.now() });
          }
        })
        .catch(() => {})
        .finally(() => {
          const current = cache.get(url);
          if (current) current.promise = undefined;
        });

      item.promise = backgroundPromise;
    }
    // Return stale data immediately in 0ms!
    return item.data;
  }

  // 2. In-flight request deduplication
  if (item?.promise && !forceRevalidate) {
    return item.promise;
  }

  const promise = fetch(url, {
    headers: getAuthHeaders(),
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

  cache.set(url, { data: item?.data || null, timestamp: item?.timestamp || 0, promise });
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
