# 🦘 Kangaroo

**Fast like the Kangaroo way, easy like the Kangaroo jump.**

**A smart, type-safe, and hassle-free Redis caching wrapper for Node.js / TypeScript.**

Stop writing the same Redis boilerplate over and over. Kangaroo provides a strictly typed `CacheBucket` that magically handles object-key hashing, JSON serialization, and read-through caching so you can focus on building your app.

## Why use Kangaroo?

- 🛡️ **End-to-End Type Safety**: Define exact types for your cache keys AND values. No more `any` or `JSON.parse(string)` guesswork.
- 🗂️ **Bucket & Stack Namespacing**: Pass a prefix to your buckets and stacks (e.g. `createCacheBucket("users")` or `createCacheStack("history")`). Kangaroo isolates your keys behind the scenes so an `{id: 1}` key in the users bucket doesn't collide with an `{id: 1}` key in your products bucket!
- 🔑 **Smart Object Hashing**: Uses `fast-json-stable-stringify` under the hood. You can use full Javascript objects as cache keys (e.g. `bucket.get({ id: 1, type: "user" })`), and Kangaroo will securely and deterministically hash them so key order doesn't matter!
- 🔄 **Read-Through Caching**: The magical `.wrap()` method automatically checks the cache. If it misses, it automatically runs your fallback database query, saves the result to Redis for you, and returns the data.
- 🥞 **NEW: Cache Stacks**: Manage Last-In-First-Out (LIFO) operations seamlessly backed by Redis. Great for undo/redo features, recent activity breadcrumbs, or state traversal!
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

## Quick Start: The Cache Stack

Need to track recent activity or manage LIFO state? The new `CacheStack` feature effortlessly backs an episodic stack inside Redis for you!

```typescript
import { Kangaroo } from "kangaroo";
import Redis from "ioredis";

const redis = new Redis();
const cache = new Kangaroo(redis);

// 1. Create a Cache Stack to store user breadcrumbs/activity
type PageVisit = { url: string; timestamp: string };
const activityStack = cache.createCacheStack<PageVisit>("user-123-activity");

async function recordJourney() {
    // 2. Push items into the stack (they will automatically expire if you want!)
    await activityStack.push({
        data: { url: "/home", timestamp: Date.now().toString() },
        timePeriod: 3600 // Keep in memory for 1 hour
    });
    
    await activityStack.push({
        data: { url: "/products/headphones", timestamp: Date.now().toString() },
        timePeriod: 3600 
    });

    console.log(`Stack size: ${activityStack.size()}`); // 2

    // 3. Peek at the top item
    const current = await activityStack.top();
    console.log(`User is currently on: ${current?.url}`); // "/products/headphones"
    
    // 4. Pop the item off the stack (like a user hitting the 'Back' button)
    const lastPage = await activityStack.pop();
    console.log(`User left: ${lastPage?.url}`);
    
    console.log(`New stack size: ${activityStack.size()}`); // 1
}

recordJourney();
```

---

**Ready for more?** Check out the [Examples Guide](EXAMPLES.md) to see how to use complex objects as keys, leverage `.wrap()`, and implement real-world features using the Cache Stack.