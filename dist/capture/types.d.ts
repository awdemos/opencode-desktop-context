import type { Config } from "../config.js";
export type CaptureTarget = Config["captureTarget"];
export type ActiveWindow = {
    title: string;
    appName: string;
};
export type CaptureResult = {
    buffer: Buffer;
    format: "png" | "jpeg";
    window?: ActiveWindow;
};
export type StoredCapture = {
    buffer: Buffer;
    format: "png" | "jpeg";
    capturedAt: number;
    path?: string;
};
export type CaptureAdapter = {
    name: string;
    getActiveWindow(): Promise<ActiveWindow>;
    capture(target: CaptureTarget): Promise<CaptureResult>;
    isAvailable(): Promise<boolean>;
};
export type Platform = "darwin" | "win32" | "linux";
export declare function getPlatform(): Platform;
//# sourceMappingURL=types.d.ts.map