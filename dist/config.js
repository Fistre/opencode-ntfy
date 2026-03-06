"use strict";
// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Andrey Limachko <liannnix@giran.cyou>
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadConfig = loadConfig;
const fs_1 = require("fs");
const path_1 = require("path");
const os_1 = require("os");
const DEFAULT_SERVER = "https://ntfy.sh";
const DEFAULT_EVENTS = ["session.idle", "session.error"];
function loadConfig(directory) {
    const configPaths = [
        (0, path_1.join)(directory, ".opencode-ntfy.json"),
        (0, path_1.join)((0, os_1.homedir)(), ".opencode-ntfy.json"),
    ];
    let raw = null;
    let configPath = null;
    for (const candidate of configPaths) {
        try {
            raw = (0, fs_1.readFileSync)(candidate, "utf-8");
            configPath = candidate;
            break;
        }
        catch {
            continue;
        }
    }
    if (!raw || !configPath) {
        console.warn("[opencode-ntfy] Config file not found in:", configPaths.join(", "));
        return null;
    }
    let parsed;
    try {
        parsed = JSON.parse(raw);
    }
    catch {
        console.warn("[opencode-ntfy] Invalid JSON in config file:", configPath);
        return null;
    }
    if (!isNtfyConfig(parsed)) {
        console.warn("[opencode-ntfy] Invalid config structure:", configPath);
        return null;
    }
    return {
        server: parsed.server ?? DEFAULT_SERVER,
        topic: parsed.topic,
        events: parsed.events ?? [...DEFAULT_EVENTS],
    };
}
function isNtfyConfig(value) {
    if (typeof value !== "object" || value === null) {
        return false;
    }
    const obj = value;
    if (obj.server !== undefined && typeof obj.server !== "string") {
        return false;
    }
    if (typeof obj.topic !== "string") {
        return false;
    }
    if (obj.events !== undefined) {
        if (!Array.isArray(obj.events)) {
            return false;
        }
        for (const item of obj.events) {
            if (typeof item !== "string") {
                return false;
            }
        }
    }
    return true;
}
//# sourceMappingURL=config.js.map