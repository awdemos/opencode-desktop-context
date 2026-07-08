import type { CaptureAdapter, StoredCapture } from "./types.js";
import type { Config } from "../config.js";
import type { Storage } from "../storage.js";
export type OrchestratorOptions = {
    force?: boolean;
};
export declare function createCaptureOrchestrator(adapter: CaptureAdapter, config: Config, storage: Storage): {
    captureIfAllowed: (options?: OrchestratorOptions) => Promise<StoredCapture | null>;
    clearCache: () => void;
};
export type CaptureOrchestrator = ReturnType<typeof createCaptureOrchestrator>;
//# sourceMappingURL=index.d.ts.map