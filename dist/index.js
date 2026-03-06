"use strict";
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Andrey Limachko <liannnix@giran.cyou>
Object.defineProperty(exports, "__esModule", { value: true });
exports.plugin = void 0;
const config_js_1 = require("./config.js");
const notify_js_1 = require("./notify.js");
function asSessionRecord(value) {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const obj = value;
    if (typeof obj.id !== "string") {
        return null;
    }
    if (obj.parentID !== undefined && typeof obj.parentID !== "string") {
        return null;
    }
    return {
        id: obj.id,
        parentID: obj.parentID,
    };
}
function readSessionFromGetResult(value) {
    if (typeof value !== "object" || value === null) {
        return null;
    }
    const obj = value;
    return asSessionRecord(obj.data);
}
function readSessionsFromListResult(value) {
    if (typeof value !== "object" || value === null) {
        return [];
    }
    const obj = value;
    if (!Array.isArray(obj.data)) {
        return [];
    }
    return obj.data
        .map((item) => asSessionRecord(item))
        .filter((item) => item !== null);
}
const plugin = async (input) => {
    const { project, directory, client } = input;
    const config = (0, config_js_1.loadConfig)(directory ?? ".");
    if (!config) {
        console.warn("[opencode-ntfy] No valid config found, plugin disabled");
        return {};
    }
    if (!config.topic) {
        console.warn("[opencode-ntfy] Topic is required in config, plugin disabled");
        return {};
    }
    const projectName = project.id || project.worktree || "unknown";
    const rootSessionCache = new Map();
    const markSession = (session) => {
        rootSessionCache.set(session.id, session.parentID === undefined);
    };
    const resolveIsRootSession = async (sessionID) => {
        const cached = rootSessionCache.get(sessionID);
        if (cached !== undefined) {
            return cached;
        }
        try {
            const getResult = await client.session.get({
                path: { id: sessionID },
                query: { directory },
            });
            const session = readSessionFromGetResult(getResult);
            if (session) {
                markSession(session);
                return session.parentID === undefined;
            }
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn("[opencode-ntfy] Failed to resolve session by id:", message);
        }
        try {
            const listResult = await client.session.list({
                query: { directory },
            });
            const sessions = readSessionsFromListResult(listResult);
            for (const session of sessions) {
                markSession(session);
            }
            const cachedAfterList = rootSessionCache.get(sessionID);
            return cachedAfterList === true;
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            console.warn("[opencode-ntfy] Failed to resolve sessions list:", message);
        }
        return false;
    };
    return {
        event: async ({ event }) => {
            if (event.type === "session.created" || event.type === "session.updated") {
                const obj = event.properties;
                const session = asSessionRecord(obj.info);
                if (session) {
                    markSession(session);
                }
            }
            if (!config.events.includes(event.type)) {
                return;
            }
            if (event.type === "session.idle") {
                const sessionID = event.properties.sessionID ?? "unknown";
                const isRootSession = await resolveIsRootSession(sessionID);
                if (!isRootSession) {
                    return;
                }
                await (0, notify_js_1.sendNotification)({
                    server: config.server,
                    topic: config.topic,
                    title: "opencode: task complete",
                    message: `Project: ${projectName} | Session: ${sessionID}`,
                    priority: 3,
                    tags: ["white_check_mark"],
                });
            }
            if (event.type === "session.error") {
                const sessionID = event.properties.sessionID ?? "n/a";
                const error = event.properties.error;
                const errorType = error && typeof error === "object" && "type" in error
                    ? String(error.type)
                    : "unknown";
                await (0, notify_js_1.sendNotification)({
                    server: config.server,
                    topic: config.topic,
                    title: "opencode: error",
                    message: `Project: ${projectName} | Session: ${sessionID} | Error: ${errorType}`,
                    priority: 4,
                    tags: ["x"],
                });
            }
        },
    };
};
exports.plugin = plugin;
//# sourceMappingURL=index.js.map