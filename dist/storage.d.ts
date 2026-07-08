import type { StoredCapture } from "./capture/types.js";
export type StorageBackend = "memory" | "temp" | "persistent";
export type Storage = {
    save(capture: StoredCapture): Promise<StoredCapture>;
    cleanup(ttlMs: number): Promise<void>;
};
export declare function createMemoryStorage(): Storage;
export declare function createTempStorage(): Storage;
export declare function createPersistentStorage(directory: string): Storage;
export declare function createStorage(backend: StorageBackend, persistentDir?: string): Storage;
//# sourceMappingURL=storage.d.ts.map