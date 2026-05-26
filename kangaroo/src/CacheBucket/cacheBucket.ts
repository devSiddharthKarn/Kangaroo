import stableStringify from "fast-json-stable-stringify"
import { Redis } from "ioredis"

/**
 * type for the structure that will be passed to the wrap function, it contains the key, time period and a function that will be called to fetch the data if it's not present in the cache
 */
type TWrap<TKey, TValue> = {
    /**
     * type for your key, can be string, number or even an object
     */
    key: TKey,
    /**
     * the time period for which the data should be cached in seconds, set it to 0 if you want to cache it indefinitely
     */
    timePeriod: number,
    /**
     * a function that will be called to fetch the data if it's not present in the cache, it should return a promise that resolves to the data
     */
    whatIf: () => Promise<TValue>
}

/**
 * type for the data that will be passed to the set function, it contains the key, value and time period for which the data should be cached
 */
type TSetData<TKey, TValue> = {
    /**
     * type for your key, can be string, number or even an object
     */
    key: TKey,
    /**
     * type for your value, can be anything that can be serialized to JSON
     */
    value: TValue,
    /**
     * the time period for which the data should be cached in seconds, set it to 0 if you want to cache it indefinitely
     */
    timePeriod: number
}

/**
 * The CacheBucket class that will be used to interact with the cache, it contains methods for setting, getting, deleting and wrapping data in the cache
 */
class CacheBucket<TKey, TValue> {
    private connection: Redis;
    private prefix:string;

    constructor(connection: Redis,prefix:string) {
        this.connection = connection
        this.prefix=prefix;
    }

    private hashKey(key: TKey): string {
        return (this.prefix+stableStringify(key));
    }

    /**
     * the set function that will be used to set data in the cache, it takes an object of type TSetData which contains the key, value and time period for which the data should be cached
     */
    public async set(data: TSetData<TKey, TValue>): Promise<void> {
        try {

            const hashedKey = this.hashKey(data.key);
            const hashedValue = JSON.stringify(data.value);
            if (data.timePeriod == 0) {
                await this.connection.set(hashedKey, hashedValue);
            } else {
                await this.connection.setex(hashedKey, data.timePeriod, hashedValue);
            }
            return;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    /**
     * the bulkSet function that will be used to set multiple data in the cache at once, it takes an array of objects of type TSetData which contains the key, value and time period for which the data should be cached
     */
    public async bulkSet(data: TSetData<TKey, TValue>[]) {
        try {

            const pipeline = this.connection.pipeline();

            for (const entry of data) {
                const hashedKey = this.hashKey(entry.key);
                const hashedValue = JSON.stringify(entry.value);
                await pipeline.setex(hashedKey, entry.timePeriod, hashedValue);
            }

            await pipeline.exec();

            return;

        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    /**
     * the get function that will be used to get data from the cache, it takes a key of type TKey and returns a promise that resolves to the value of type TValue or null if the key is not present in the cache
     */
    public async get(key: TKey): Promise<TValue | null> {
        try {
            const hashedKey: string = this.hashKey(key);
            const data: string | null = await this.connection.get(hashedKey);
            if (!data) return null;
            const parsedValue: TValue = JSON.parse(data) as TValue;
            return parsedValue;
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    }

    /**
     * the bulkGet function that will be used to get multiple data from the cache at once, it takes an array of keys of type TKey and returns a promise that resolves to an array of values of type TValue or null if the key is not present in the cache
     */
    public async bulkGet(keys: TKey[]) {
        try {
            const hashedKeys = keys.map(key => {
                return this.hashKey(key);
            })

            const results = await this.connection.mget(...hashedKeys);

            const data = results.map(result => {
                if (!result) return null;
                else return JSON.parse(result) as TValue
            });

            return data;

        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    /**
     * the delete function that will be used to delete data from the cache, it takes a key of type TKey and returns a promise that resolves to the number of keys that were deleted or null if there was an error
     */
    public async delete(key: TKey): Promise<number | null> {
        try {
            const hashedKey = this.hashKey(key);
            const data: number = await this.connection.del(hashedKey);
            return data;
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    }

    /**
     * the wrap function that will be used to wrap a function that fetches data and caches it, it takes an object of type TWrap which contains the key, time period and a function that will be called to fetch the data if it's not present in the cache, it returns a promise that resolves to the value of type TValue
     */
    public async wrap(structure: TWrap<TKey, TValue>) {
        try {
            const data: TValue | null = await this.get(structure.key);
            if (data) {
                return data;
            }
            const fetchedData: TValue = await structure.whatIf();
            await this.set({
                key: structure.key,
                value: fetchedData,
                timePeriod: structure.timePeriod
            });
            return fetchedData;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    /**
     * the pop function that will be used to get data from the cache and delete it, it takes a key of type TKey and returns a promise that resolves to the value of type TValue or null if the key is not present in the cache
     */
    public async pop(key: TKey): Promise<TValue | null> {
        try {
            const hashedKey = this.hashKey(key);

            const data = await this.connection.get(hashedKey);
            if (!data) return null;

            await this.connection.del(hashedKey);

            return JSON.parse(data) as TValue;
        } catch (error) {
            console.error("Error:", error);
            return null;
        }
    }

    /**
     * the bulkPop function that will be used to get multiple data from the cache and delete them at once, it takes an array of keys of type TKey and returns a promise that resolves to an array of values of type TValue or null if the key is not present in the cache
     */
    public async bulkPop(keys: TKey[]): Promise<(TValue | null)[]> {
        try {
            const pipeline = this.connection.pipeline();

            const hashedKeys = keys.map(k => this.hashKey(k));

            hashedKeys.forEach(k => pipeline.get(k));

            hashedKeys.forEach(k => pipeline.del(k));

            const results = await pipeline.exec();

            if (!results) return [];

            const values = results
                .slice(0, keys.length)
                .map(([err, res]) => {
                    if (err || !res) return null;
                    return JSON.parse(res as string) as TValue;
                });

            return values;

        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    public getOriginalInstance():Redis{
        return this.connection;
    }
}


export { CacheBucket }
