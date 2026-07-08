export function getPlatform() {
    const platform = process.platform;
    if (platform === "darwin" || platform === "win32" || platform === "linux") {
        return platform;
    }
    throw new Error(`Unsupported platform: ${platform}`);
}
//# sourceMappingURL=types.js.map