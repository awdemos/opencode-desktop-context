import { z } from "zod";
export const captureTargetSchema = z.enum(["fullScreen", "activeWindow", "allDisplays"]);
export const retentionSchema = z.enum(["memory", "temp", "persistent"]);
export const configSchema = z
    .object({
    captureTarget: captureTargetSchema.default("fullScreen"),
    maxAgeMs: z.number().int().min(0).default(30000),
    autoAttach: z.boolean().default(true),
    systemHint: z.boolean().default(false),
    visualIndicator: z.boolean().default(true),
    retention: retentionSchema.default("temp"),
    retentionTtlMs: z.number().int().min(0).default(600000),
    persistentDir: z.string().optional(),
    blocklist: z.array(z.string()).default(["1Password", "Bitwarden", "Chase", "Keychain Access"]),
    allowlist: z.array(z.string()).default([]),
    quality: z.number().int().min(1).max(100).default(80),
})
    .refine((data) => data.retention !== "persistent" || data.persistentDir, { message: "persistentDir is required when retention is 'persistent'", path: ["persistentDir"] });
export const defaultConfig = configSchema.parse({});
export function parseConfig(input) {
    return configSchema.parse(input);
}
//# sourceMappingURL=config.js.map