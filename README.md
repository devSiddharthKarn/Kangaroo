# 🦘 Kangaroo

**Fast like the Kangaroo way, easy like the Kangaroo jump.**

**A smart, type-safe, and hassle-free Redis caching wrapper for Node.js / TypeScript.**

Stop writing the same Redis boilerplate over and over. Kangaroo provides a strictly typed `CacheBucket` that magically handles object-key hashing, JSON serialization, and read-through caching so you can focus on building your app.

## Before And After

Before Kangaroo, a simple cache lookup usually meant manually building keys, serializing values, and handling misses yourself:

```typescript
const key = `user:${userId}`;
const cached = await redis.get(key);

if (cached) {
    return JSON.parse(cached);
}

const fresh = await loadUser(userId);
await redis.set(key, JSON.stringify(fresh), "EX", 300);
return fresh;
```

With Kangaroo, the same flow becomes a single typed call:

```typescript
const users = cache.createCacheBucket<{ id: string }, { name: string }>("users");

const user = await users.wrap({
    key: { id: userId },
    timePeriod: 300,
    whatIf: async () => loadUser(userId),
});
```

## Why use Kangaroo?

- 🛡️ **End-to-End Type Safety**: Define exact types for your cache keys AND values. No more `any` or `JSON.parse(string)` guesswork.
- 🗂️ **Bucket Namespacing**: Pass a prefix to your buckets (e.g. `createCacheBucket("users")`). Kangaroo isolates your keys behind the scenes so an `{id: 1}` key in the users bucket doesn't collide with an `{id: 1}` key in your products bucket!
- 🔑 **Smart Object Hashing**: Uses `fast-json-stable-stringify` under the hood. You can use full Javascript objects as cache keys (e.g. `bucket.get({ id: 1, type: "user" })`), and Kangaroo will securely and deterministically hash them so key order doesn't matter!
- 🔄 **Read-Through Caching**: The magical `.wrap()` method automatically checks the cache. If it misses, it automatically runs your fallback database query, saves the result to Redis for you, and returns the data.
- ⚡ **Lightweight**: Built on top of the battle-tested `ioredis` library.

## Installation

```bash
npm i @siddharth-karna/kangaroo
pnpm i @siddharth-karna/kangaroo
yarn add @siddharth-karna/kangaroo
bun add @siddharth-karna/kangaroo
```

## Real-Life Quick Start: E-Commerce Product Caching

Instead of limiting yourself to string keys, Kangaroo lets you use **complex query objects** as cache keys, and caches back the exact response type. Here is how you can cache an e-commerce search with multiple filters!

```typescript
import { Kangaroo } from "kangaroo";
import Redis from "ioredis";

// 1. Initialize standard ioredis connection
const redis = new Redis("redis://localhost:6379");

// 2. Pass it to Kangaroo
const cache = new Kangaroo(redis);

// Types for our real-world use case
type ProductSearchFilters = { category: string; minPrice: number; maxPrice: number; inStockOnly: boolean };
type ProductSearchResult = { products: { id: string; name: string; price: number }[]; totalFound: number };

// 3. Create a bucket. Give it a namespace ("product-search"), and fully type the Key and Value!
const productSearchBucket = cache.createCacheBucket<ProductSearchFilters, ProductSearchResult>("product-search");

async function searchProducts(filters: ProductSearchFilters) {
    // 4. Wrap automatically checks Redis using the object key!
    return await productSearchBucket.wrap({
        key: filters,
        timePeriod: 300, // Cache for 5 minutes
        whatIf: async () => {
            console.log("⚠️ Cache miss! Querying expensive database operation...");
            
            // Simulating an expensive DB query using the filters object
            // const dbResults = await db.query('...', filters);
            
            return {
                products: [
                    { id: "p_1", name: "Wireless Headphones", price: 99.99 },
                    { id: "p_2", name: "Bluetooth Speaker", price: 59.99 }
                ],
                totalFound: 2
            };
        }
    });
}

async function run() {
    const userFilters = { category: "audio", minPrice: 50, maxPrice: 150, inStockOnly: true };

    // First call: Runs the `whatIf` database query
    const results1 = await searchProducts(userFilters);

    // Second call: Instantly returns from Redis! It hashes the object deterministically.
    const results2 = await searchProducts({ 
        inStockOnly: true, 
        maxPrice: 150, 
        category: "audio", 
        minPrice: 50 
    }); // Property order doesn't matter!

    console.log(`Found ${results2.totalFound} products.`);
}

run();
```

---

**Ready for more?** Check out the [Examples Guide](EXAMPLES.md) to see how to use complex objects as keys and leverage `.wrap()` in real-world scenarios.