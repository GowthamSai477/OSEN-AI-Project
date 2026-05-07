interface CacheEntry<T> {
  data: T
  timestamp: number
  ttl: number
}

class DataCache {
  private store = new Map<string, CacheEntry<any>>()

  set<T>(key: string, data: T, ttlMs: number = 30000) {
    this.store.set(key, { data, timestamp: Date.now(), ttl: ttlMs })
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key)
    if (!entry) return null
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.store.delete(key)
      return null
    }
    return entry.data as T
  }

  invalidate(key: string) { 
    this.store.delete(key) 
  }
  
  invalidatePattern(pattern: string) {
    for (const key of this.store.keys()) {
      if (key.includes(pattern)) this.store.delete(key)
    }
  }

  clear() {
    this.store.clear()
  }
}

export const cache = new DataCache()
