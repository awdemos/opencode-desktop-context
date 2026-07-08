import sharp from "sharp";
import { isAllowedToCapture } from "../privacy/index.js";
export function createCaptureOrchestrator(adapter, config, storage) {
    let cache = null;
    async function processCapture(raw) {
        const capturedAt = Date.now();
        let buffer = raw.buffer;
        let format = raw.format;
        if (config.quality < 100 && raw.format === "png") {
            buffer = await sharp(raw.buffer).jpeg({ quality: config.quality }).toBuffer();
            format = "jpeg";
        }
        else if (config.quality < 100 && raw.format === "jpeg") {
            buffer = await sharp(raw.buffer).jpeg({ quality: config.quality }).toBuffer();
        }
        return { buffer, format, capturedAt };
    }
    async function captureIfAllowed(options = {}) {
        const now = Date.now();
        if (!options.force && cache && now - cache.capturedAt < config.maxAgeMs) {
            return cache;
        }
        const activeWindow = await adapter.getActiveWindow().catch(() => ({ title: "", appName: "" }));
        const allowed = isAllowedToCapture({
            windowTitle: activeWindow.title,
            appName: activeWindow.appName,
            blocklist: config.blocklist,
            allowlist: config.allowlist,
        });
        if (!allowed) {
            return null;
        }
        const raw = await adapter.capture(config.captureTarget);
        let stored = await processCapture(raw);
        stored = await storage.save(stored);
        cache = stored;
        return stored;
    }
    function clearCache() {
        cache = null;
    }
    return { captureIfAllowed, clearCache };
}
//# sourceMappingURL=index.js.map