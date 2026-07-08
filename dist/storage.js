import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
export function createMemoryStorage() {
    return {
        async save(capture) {
            return capture;
        },
        async cleanup() { },
    };
}
export function createTempStorage() {
    const dir = join(tmpdir(), "opencode-desktop-context");
    return {
        async save(capture) {
            await mkdir(dir, { recursive: true });
            const filename = `capture-${capture.capturedAt}.${capture.format}`;
            const path = join(dir, filename);
            await writeFile(path, capture.buffer);
            return { ...capture, path };
        },
        async cleanup(ttlMs) {
            const now = Date.now();
            try {
                const files = await readdir(dir);
                for (const file of files) {
                    const timestamp = parseInt(file.match(/capture-(\d+)/)?.[1] ?? "0", 10);
                    if (timestamp > 0 && now - timestamp > ttlMs) {
                        await rm(join(dir, file), { force: true });
                    }
                }
            }
            catch {
                // ignore
            }
        },
    };
}
export function createPersistentStorage(directory) {
    return {
        async save(capture) {
            await mkdir(directory, { recursive: true });
            const filename = `capture-${capture.capturedAt}.${capture.format}`;
            const path = join(directory, filename);
            await writeFile(path, capture.buffer);
            return { ...capture, path };
        },
        async cleanup() {
            // User-managed cleanup
        },
    };
}
export function createStorage(backend, persistentDir) {
    switch (backend) {
        case "persistent":
            if (!persistentDir)
                throw new Error("persistentDir required");
            return createPersistentStorage(persistentDir);
        case "temp":
            return createTempStorage();
        case "memory":
        default:
            return createMemoryStorage();
    }
}
//# sourceMappingURL=storage.js.map