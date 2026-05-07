import { cache } from "./cache"

export async function cachedFetch<T>(
  key: string,
  url: string,
  token: string,
  ttlMs: number = 60000,
  forceRefresh: boolean = false,
  retries: number = 3
): Promise<T> {
  if (!forceRefresh) {
    const cached = cache.get<T>(key)
    if (cached !== null) return cached
  }

  const cleanUrl = url.trim();
  let lastError: any = null;
  
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch(cleanUrl, {
        headers: { 
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      })
      
      if (!res.ok) {
        let errorMsg = `HTTP ${res.status}`;
        try {
          if (res.headers.get("content-type")?.includes("application/json")) {
            const errBody = await res.json();
            console.error(`[Planora API] Server Error (${res.status}):`, errBody);
          } else {
            console.error(`[Planora API] Non-JSON Server Error (${res.status})`);
          }
        } catch {
          console.error(`[Planora API] Error parsing error body`);
        }
        throw new Error(errorMsg);
      }

      if (res.headers.get("content-type")?.includes("application/json")) {
        const data = await res.json();
        cache.set(key, data, ttlMs)
        return data;
      }
      return null as any;
    } catch (err: any) {
      lastError = err;
      console.warn(`[Planora] Fetch attempt ${i + 1} failed for ${cleanUrl}:`, err);
      if (i < retries - 1) {
        await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
      }
    }
  }

  throw lastError || new Error("Failed to fetch after multiple retries");
}

export function invalidateTasks() {
  cache.invalidatePattern("tasks")
  cache.invalidatePattern("goal_stats")
}

export function invalidateNotifications() {
  cache.invalidatePattern("notifications")
}

export function invalidateChat() {
  cache.invalidatePattern("sessions")
}
