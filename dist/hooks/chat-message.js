export function createChatMessageHook(orchestrator, config) {
    return async (input, output) => {
        if (!config.autoAttach)
            return;
        const capture = await orchestrator.captureIfAllowed();
        if (!capture)
            return;
        const url = capture.path ? `file://${capture.path}` : `data:image/${capture.format};base64,${capture.buffer.toString("base64")}`;
        output.parts.push({
            id: `desktop-${capture.capturedAt}`,
            sessionID: input.sessionID,
            messageID: output.message.id,
            type: "file",
            mime: capture.format === "png" ? "image/png" : "image/jpeg",
            url,
            filename: `desktop-${capture.capturedAt}.${capture.format}`,
        });
    };
}
//# sourceMappingURL=chat-message.js.map