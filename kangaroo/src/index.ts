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
     * The createCacheBucket function that will be used to create cache buckets, it takes a name as a parameter which will be used as a prefix for the keys in that bucket, it returns an instance of the CacheBucket class which can be used to interact with the cache
     */
    public createCacheBucket<TKey, TValue>(name:string):CacheBucket<TKey,TValue> {
        return new CacheBucket<TKey, TValue>(this.redisConnection,name);
    }


    /**
     * gets the original Redis instance that was passed in the constructor, this can be used to perform Redis operations that are not covered by CacheBucket
     * @returns Redis instance
     */
    public getOriginalInstance():Redis{
        return this.redisConnection;
    }

}


export { Kangaroo }
