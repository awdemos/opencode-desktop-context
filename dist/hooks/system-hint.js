const HINT = `You have access to a desktop screenshot via the capture_desktop tool. If the user refers to something visible on their screen and no recent screenshot is attached, call capture_desktop to see it.`;
export function createSystemHintHook(config) {
    return async (_input, output) => {
        if (!config.systemHint)
            return;
        output.system.push(HINT);
    };
}
//# sourceMappingURL=system-hint.js.map