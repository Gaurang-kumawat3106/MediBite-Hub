import { getSessionKeyHeader } from "./csrf";

type CacheItem<T> = {
  data: T;
  timestamp: number;
  promise?: Promise<T>;
};

type ApiResult = { success: boolean; error?: string; login_required?: boolean };

const cache = new Map<string, CacheItem<unknown>>();
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

export const fetchWithCache = async <T extends ApiResult>(url: string, forceRevalidate = false): Promise<T> => {
  const item = cache.get(url) as CacheItem<T> | undefined;
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
            cache.set(url, { data: newData as T, timestamp: Date.now() });
          }
          return newData as T;
        })
        .catch(() => item.data)
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
          // Navigation belongs to the page component. Keeping the data client
          // side-effect free avoids a full reload from an unrelated request.
        }
        return { success: false, error: "Unauthorized", login_required: true } as T;
      }
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        return { success: false, error: `Server returned non-JSON response (${res.status})` } as T;
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
      return { success: false, error: err instanceof Error ? err.message : "Network connection issue." } as T;
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

export const invalidateCachesForEvent = (event: { type: string }) => {
  switch (event.type) {
    case "new_order":
      invalidateMatchingCache("/app/outlet/orders");
      invalidateMatchingCache("/app/outlet/home");
      break;
    case "order_update":
      invalidateOrderCaches();
      break;
    case "token_update":
      invalidateMatchingCache("/app/customer/orders");
      invalidateMatchingCache("/app/customer/token");
      break;
    case "product_deactivated":
      invalidateMatchingCache("/app/outlet/");
      invalidateMatchingCache("/app/customer/home");
      break;
  }
};
