import { Redis } from "ioredis"

import { CacheBucket } from "./CacheBucket/cacheBucket.js";

/**
 * The main class that will be used to create cache buckets and interact with the cache, it takes a Redis connection as a parameter in the constructor example: const kang = new Kangaroo(connectionInstance)
 */
class Kangaroo {
    private redisConnection: Redis;

    constructor(connection: Redis) {
        this.redisConnection = connection;
    }

    /**
     * The createCacheBucket function that will be used to create a new cache bucket, it takes two generic types TKey and TValue which represent the type of the key and value that will be stored in the cache bucket, it returns an instance of the CacheBucket class that can be used to interact with the cache
     */
    public createCacheBucket<TKey, TValue>() {
        return new CacheBucket<TKey, TValue>(this.redisConnection);
    }

}


export { Kangaroo }
