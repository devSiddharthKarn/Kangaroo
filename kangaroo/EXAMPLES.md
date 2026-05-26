# 🦘 Kangaroo Examples & Features

Here are some common patterns and examples to help you get the most out of Kangaroo and convince you why it's the right choice for your caching layers.

## 1. The Magic of `.wrap()` (Read-Through Cache)

Normally, fetching data securely requires checking the cache, writing an `if (!cached)` block, querying the DB, saving it to the cache, and then finally returning it.

The `.wrap()` method dramatically reduces this boilerplate. It checks Redis first. If it's a "cache miss", it executes your callback, caches the response for you, and returns the strictly-typed data.

```typescript
import { Kangaroo } from "kangaroo";
import Redis from "ioredis";

const redis = new Redis();
const cache = new Kangaroo(redis);

// Setup a bucket for querying users from PostgreSQL, MongoDB, etc.
const dbQueryBucket = cache.createCacheBucket<string, { id: string, email: string }>();

async function getUser(userId: string) {
    return await dbQueryBucket.wrap({
        key: `user:${userId}`,
        timePeriod: 60, // Cache for 60 seconds
        whatIf: async () => {
            console.log("⚠️ Cache miss! Fetching from Database...");
            
            // This only runs if the cache is empty or expired!
            // const dbUser = await db.query('SELECT * FROM users WHERE id = ?', userId);
            
            return { id: userId, email: "test@example.com" }; 
        }
    });
}

// First call: Logs "⚠️ Cache miss!..."
await getUser("1002"); 

// Second call: Instantly returns from Redis!
await getUser("1002"); 
```

## 2. Using Complex Objects as Cache Keys

Normally in Redis, keys must be simple strings. If you want to cache a query that takes multiple filters (like a location), you'd have to construct dirty strings like `cache:search:lat40:lng-74`. 

With Kangaroo, you can use full objects as keys. Kangaroo deterministically stringifies them, meaning `{ lat: 40, lng: -74 }` and `{ lng: -74, lat: 40 }` evaluate to the exact same cache key, regardless of property order!

```typescript
// Key is an object!
const locationBucket = cache.createCacheBucket<{ lat: number, lng: number }, { city: string, weather: string }>();

// Set using an object
await locationBucket.set(
    { lat: 40.7128, lng: -74.0060 }, 
    { city: "New York", weather: "Sunny" }, 
    3600 // Expire in 1 hour
);

// Retrieve using an object (even if the parameters are provided in a different order!)
const result = await locationBucket.get({ lng: -74.0060, lat: 40.7128 });

console.log(result?.city); // "New York"
```

## 3. Manual Invalidation (Deletion)

When users update their profile or log out, you need to clear their cache gracefully to avoid stale data. Use `.delete()`.

```typescript
const sessionBucket = cache.createCacheBucket<string, { token: string }>();

async function logout(sessionId: string) {
    // Attempt deletion
    const removedCount = await sessionBucket.delete(`session:${sessionId}`);
    
    if (removedCount && removedCount > 0) {
        console.log("Successfully logged out and cleared cache!");
    }
}
```

## 4. Total Type Isolation

Every time you call `createCacheBucket<TKey, TValue>()`, you create a strongly bounded namespace in TypeScript. You physically cannot pass the wrong data type into the `.set` method without your IDE throwing an error saving you hours of debugging.

```typescript
interface Article { title: string; views: number }

const articles = cache.createCacheBucket<number, Article>();

// ❌ TypeScript Error: Property 'views' is missing
await articles.set(12, { title: "Hello World" }, 60);

// ❌ TypeScript Error: Argument of type 'string' is not assignable to type 'number'
await articles.get("12"); 

// ✅ Correct
await articles.set(12, { title: "Hello World", views: 0 }, 60);
```