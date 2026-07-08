export type PrivacyContext = {
    windowTitle: string;
    appName: string;
    blocklist: string[];
    allowlist: string[];
};
export declare function isAllowedToCapture(ctx: PrivacyContext): boolean;
export * from "./permission.js";
//# sourceMappingURL=index.d.ts.map