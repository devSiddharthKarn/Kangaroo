# 🦘 Kangaroo Examples & Features

Here are some common patterns and examples to help you get the most out of Kangaroo and convince you why it's the right choice for your caching layers.

## 1. The Magic of `.wrap()`: Dashboard Analytics

Generating dashboard analytics usually requires expensive aggregation queries across multiple database tables. You don't want every user refresh to hammer your DB.

The `.wrap()` method handles this elegantly. It checks Redis first. If it's a "cache miss", it executes your heavy DB query, saves the result to Redis automatically, and returns the strictly-typed data.

```typescript
import { Kangaroo } from "kangaroo";
import Redis from "ioredis";

const redis = new Redis();
const cache = new Kangaroo(redis);

type AnalyticsRequest = { orgId: string; dateRange: "7d" | "30d" | "90d" };
type AnalyticsData = { totalRevenue: number; activeUsers: number; topPaths: string[] };

// Setup a bucket specifically for Analytics, isolating its keys with the "analytics" namespace
const analyticsBucket = cache.createCacheBucket<AnalyticsRequest, AnalyticsData>("analytics");

async function getDashboardData(req: AnalyticsRequest) {
    return await analyticsBucket.wrap({
        key: req,
        timePeriod: 3600, // Aggregate data only once an hour!
        whatIf: async () => {
            console.log(`⚠️ Cache miss for Org ${req.orgId}! Running heavy aggregations...`);
            
            // This only runs once per hour per combination of orgId and dateRange
            // const revenue = await db.query('SELECT SUM(amount) FROM sales WHERE org_id = ? AND date > ?', ...);
            
            return { 
                totalRevenue: 15420.50, 
                activeUsers: 142,
                topPaths: ["/home", "/checkout", "/catalog"]
            }; 
        }
    });
}

// First call: Logs "⚠️ Cache miss!..." and computes
await getDashboardData({ orgId: "org_alpha", dateRange: "30d" }); 

// Second call: Instantly returns from Redis memory!
await getDashboardData({ orgId: "org_alpha", dateRange: "30d" }); 
```

## 2. Using Complex Objects as Cache Keys: Flight Search

Normally in Redis, keys must be simple strings. If you want to cache a flight search with origin, destination, passengers, and dates, you'd have to construct dirty strings like `cache:flights:JFK:LHR:2:2024-12-01`. 

With Kangaroo, you can use full nested objects as keys. Kangaroo deterministically stringifies them, meaning order doesn't matter!

```typescript
type FlightSearchQuery = {
    origin: string;
    destination: string;
    passengers: number;
    dates: { outbound: string; return?: string };
};

type FlightResults = { airlines: string[]; cheapestPrice: number };

// Give it a namespace ("flights"), an object Key, and an object Value!
const flightSearchBucket = cache.createCacheBucket<FlightSearchQuery, FlightResults>("flights");

// Set using an object directly
await flightSearchBucket.set(
    { 
        origin: "JFK", 
        destination: "LHR", 
        passengers: 2, 
        dates: { outbound: "2024-12-01", return: "2024-12-14" } 
    }, 
    { airlines: ["Delta", "British Airways"], cheapestPrice: 540.00 }, 
    600 // Expire in 10 minutes (prices change fast!)
);

// Retrieve using an object (even if the properties are provided in a completely different order!)
const result = await flightSearchBucket.get({ 
    passengers: 2,
    dates: { return: "2024-12-14", outbound: "2024-12-01" }, // Nested order changed!
    destination: "LHR", 
    origin: "JFK"
});

console.log(result?.cheapestPrice); // 540.00
```

## 3. Manual Invalidation (Deletion): User Profile Updates

When users update their profile, you need to clear their cached public profile immediately to avoid showing stale data to other users.

```typescript
type UserId = { id: string };
type UserProfile = { username: string; bio: string; avatarUrl: string };

const profileBucket = cache.createCacheBucket<UserId, UserProfile>("profiles");

async function updateBio(userId: string, newBio: string) {
    // 1. Update the database
    // await db.query('UPDATE profiles SET bio = ? WHERE id = ?', newBio, userId);

    // 2. Wipe the old cache securely using the exact object structure
    const removedCount = await profileBucket.delete({ id: userId });
    
    if (removedCount && removedCount > 0) {
        console.log("Successfully updated bio and purged old cache!");
    }
}
```

## 4. The Cache Stack: Temporary "Undo" Actions

If you are building an editor, dashboard, or drawing tool, users often need an **"Undo"** functionality. Storing these large state objects in the client's browser crashes the tab. Storing them permanently in the database bloats your tables.

By using Kangaroo's `CacheStack`, you get an automatic Last-In-First-Out (LIFO) undo log that lives securely in Redis, and automatically expires after an hour!

```typescript
// Setup an undo stack for a specific document with the namespace "doc:999:undo"
type DrawingState = { action: string; shapes: string[]; color: string };
const undoStack = cache.createCacheStack<DrawingState>("doc:999:undo");

async function drawCircle() {
    const currentState = { action: "draw", shapes: ["circle"], color: "blue" };

    // Push the state to Redis, keep it for only 1 hour
    await undoStack.push({ data: currentState, timePeriod: 3600 });
}

async function undoLastAction() {
    // Is the stack empty?
    if (undoStack.size() === 0) {
        return console.log("Nothing to undo!");
    }

    // Pop the latest state off the stack
    const restoredState = await undoStack.pop();
    
    console.log(`Reverting document state to: ${restoredState?.action}`);
    // Output: Reverting document state to: draw
}
```

## 5. Total Type Isolation

Every time you call `createCacheBucket<TKey, TValue>("prefix")`, you create a strongly bounded namespace in TypeScript and Redis. You physically cannot pass the wrong data type into the `.set` method without your IDE throwing an error saving you hours of debugging.

```typescript
interface Article { title: string; views: number }

const articles = cache.createCacheBucket<number, Article>("articles");

// ❌ TypeScript Error: Property 'views' is missing
await articles.set(12, { title: "Hello World" }, 60);

// ❌ TypeScript Error: Argument of type 'string' is not assignable to type 'number'
await articles.get("12"); 

// ✅ Correct
await articles.set(12, { title: "Hello World", views: 0 }, 60);
```