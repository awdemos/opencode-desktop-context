function normalize(value) {
    return value.toLowerCase().trim();
}
function matchesAny(value, patterns) {
    const normalizedValue = normalize(value);
    return patterns.some((pattern) => normalizedValue.includes(normalize(pattern)));
}
export function isAllowedToCapture(ctx) {
    const { windowTitle, appName, blocklist, allowlist } = ctx;
    if (matchesAny(windowTitle, blocklist) || matchesAny(appName, blocklist)) {
        return false;
    }
    if (allowlist.length > 0) {
        return matchesAny(windowTitle, allowlist) || matchesAny(appName, allowlist);
    }
    return true;
}
export * from "./permission.js";
//# sourceMappingURL=index.js.map