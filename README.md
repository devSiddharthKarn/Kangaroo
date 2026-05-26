# 🦘 Kangaroo

**Fast like the Kangaroo way, easy like the Kangaroo jump.**

**A smart, type-safe, and hassle-free Redis caching wrapper for Node.js / TypeScript.**

Stop writing the same Redis boilerplate over and over. Kangaroo provides a strictly typed `CacheBucket` that magically handles object-key hashing, JSON serialization, and read-through caching so you can focus on building your app.

## Why use Kangaroo?

- 🛡️ **End-to-End Type Safety**: Define exact types for your cache keys AND values. No more `any` or `JSON.parse(string)` guesswork.
- 🔑 **Smart Object Hashing**: Uses `fast-json-stable-stringify` under the hood. You can use full Javascript objects as cache keys (e.g. `bucket.get({ id: 1, type: "user" })`), and Kangaroo will securely and deterministically hash them so key order doesn't matter!
- 🔄 **Read-Through Caching**: The magical `.wrap()` method automatically checks the cache. If it misses, it automatically runs your fallback database query, saves the result to Redis for you, and returns the data.
- ⚡ **Lightweight**: Built on top of the battle-tested `ioredis` library.

## Installation

```bash
pnpm add kangaroo ioredis
# or npm install kangaroo ioredis
# or yarn add kangaroo ioredis
```

## Quick Start

```typescript
import { Kangaroo } from "kangaroo";
import Redis from "ioredis";

// 1. Initialize standard ioredis connection
const redis = new Redis("redis://localhost:6379");

// 2. Pass it to Kangaroo
const cache = new Kangaroo(redis);

// 3. Create a bucket that expects a string key and stores User objects
const usersBucket = cache.createCacheBucket<string, { name: string, age: number }>();

async function run() {
    // Set a value (expires in 3600 seconds)
    await usersBucket.set("user:1", { name: "Alice", age: 30 }, 3600);

    // Get a value (fully typed!)
    const user = await usersBucket.get("user:1");
    // TypeScript knows `user` has a `name` property!
    console.log(user?.name); // "Alice"
}

run();
```

---

**Ready for more?** Check out the [Examples Guide](EXAMPLES.md) to see how to use complex objects as keys and leverage the powerful read-through caching features.