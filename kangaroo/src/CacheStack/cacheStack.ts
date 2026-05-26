import { Redis } from "ioredis"
import stableStringify from "fast-json-stable-stringify"
import { CacheBucket } from "../CacheBucket/cacheBucket.js";

type TSetData<TData> = {
    data: TData,
    timePeriod: number
}

class CacheStack<TData> {

    private cacheBucket: CacheBucket<string, TData>
    private prefix: string;
    private pointer: number = -1;

    constructor(redis: Redis, prefix: string) {
        this.cacheBucket = new CacheBucket<string, TData>(redis, prefix);
        this.prefix = prefix
    }

    private key(pointer: number): string {
        try {
            const key: string = (this.prefix) + String(pointer);
            return key;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    /*
        * Returns the current pointer of the stack, which is the index of the last element in the stack. It starts at -1 when the stack is empty and increments with each push and decrements with each pop.
    */
    public getPointer(): number {
        return this.pointer;
    }

    /*
        * Returns the size of the stack, which is the number of elements in the stack.
    */
    public size(): number {
        return this.pointer + 1;
    }

    /*
        * Pushes a new element onto the stack. It increments the pointer and sets the value in the cache bucket using the current pointer as part of the key. The data is passed as a parameter along with the time period for which the data should be cached.
    */
    public async push(data: TSetData<TData>): Promise<void> {
        try {
            this.pointer++;
            const key = this.key(this.pointer);
            await this.cacheBucket.set({
                key: key,
                value: data.data,
                timePeriod: data.timePeriod
            });
        } catch (error) {
            console.error("Error:", error);
            this.pointer--;
            throw error;
        }
    }

    /*
        * Removes and returns the top element from the stack. It decrements the pointer and retrieves the value from the cache bucket using the current pointer as part of the key.
    */
    public async pop(): Promise<TData | null> {
        try {
            if (this.pointer == -1) {
                return null;
            }

            const key = this.key(this.pointer);
            const data: TData | null = await this.cacheBucket.pop(key);

            this.pointer--;

            return data;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }

    public async top() {
        try {
            if (this.pointer == -1) return null;

            const key = this.key(this.pointer);
            const data = this.cacheBucket.get(key);
            return data;
        } catch (error) {
            console.error("Error:", error);
            throw error;
        }
    }
}

export { CacheStack }