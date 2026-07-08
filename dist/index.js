import { parseConfig } from "./config.js";
import { createCaptureOrchestrator } from "./capture/index.js";
import { createStorage } from "./storage.js";
import { loadPermissionState, savePermissionState } from "./privacy/index.js";
import { createCaptureDesktopTool } from "./tools/capture-desktop.js";
import { createChatMessageHook } from "./hooks/chat-message.js";
import { createSystemHintHook } from "./hooks/system-hint.js";
import { getPlatform } from "./capture/types.js";
import { macOSAdapter } from "./capture/macos.js";
import { windowsAdapter } from "./capture/windows.js";
import { linuxAdapter } from "./capture/linux.js";
function getAdapter() {
    switch (getPlatform()) {
        case "darwin":
            return macOSAdapter;
        case "win32":
            return windowsAdapter;
        case "linux":
            return linuxAdapter;
    }
}
export const DesktopContextPlugin = async (ctx, options = {}) => {
    const config = parseConfig(options);
    const adapter = getAdapter();
    const available = await adapter.isAvailable();
    if (!available) {
        await ctx.client.app.log({
            body: { service: "desktop-context", level: "error", message: `Capture adapter ${adapter.name} is not available` },
        });
        return {};
    }
    const storage = createStorage(config.retention, config.persistentDir);
    await storage.cleanup(config.retentionTtlMs);
    const orchestrator = createCaptureOrchestrator(adapter, config, storage);
    const permissionedOrchestrator = {
        captureIfAllowed: async (opts) => {
            const perm = await loadPermissionState();
            if (!perm.granted) {
                return null;
            }
            return orchestrator.captureIfAllowed(opts);
        },
        clearCache: orchestrator.clearCache,
    };
    return {
        "chat.message": createChatMessageHook(permissionedOrchestrator, config),
        "experimental.chat.system.transform": createSystemHintHook(config),
        tool: {
            capture_desktop: createCaptureDesktopTool({
                captureIfAllowed: async (opts) => {
                    let perm = await loadPermissionState();
                    if (!perm.granted) {
                        await savePermissionState({ granted: true, askedAt: new Date().toISOString() });
                        perm = await loadPermissionState();
                    }
                    if (!perm.granted)
                        return null;
                    return orchestrator.captureIfAllowed(opts);
                },
                clearCache: orchestrator.clearCache,
            }),
        },
    };
};
export default DesktopContextPlugin;
//# sourceMappingURL=index.js.map