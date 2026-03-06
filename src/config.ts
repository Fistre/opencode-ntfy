// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Andrey Limachko <liannnix@giran.cyou>

import { readFileSync } from "fs"
import { join } from "path"
import { homedir } from "os"

export interface NtfyConfig {
  server: string
  topic: string
  events: string[]
}

const DEFAULT_SERVER = "https://ntfy.sh"
const DEFAULT_EVENTS = ["session.idle", "session.error"] as const

export function loadConfig(directory: string): NtfyConfig | null {
  const configPaths = [
    join(directory, ".opencode-ntfy.json"),
    join(homedir(), ".opencode-ntfy.json"),
  ]

  let raw: string | null = null
  let configPath: string | null = null

  for (const candidate of configPaths) {
    try {
      raw = readFileSync(candidate, "utf-8")
      configPath = candidate
      break
    } catch {
      continue
    }
  }

  if (!raw || !configPath) {
    console.warn("[opencode-ntfy] Config file not found in:", configPaths.join(", "))
    return null
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    console.warn("[opencode-ntfy] Invalid JSON in config file:", configPath)
    return null
  }

  if (!isNtfyConfig(parsed)) {
    console.warn("[opencode-ntfy] Invalid config structure:", configPath)
    return null
  }

  return {
    server: parsed.server ?? DEFAULT_SERVER,
    topic: parsed.topic,
    events: parsed.events ?? [...DEFAULT_EVENTS],
  }
}

function isNtfyConfig(value: unknown): value is NtfyConfig {
  if (typeof value !== "object" || value === null) {
    return false
  }

  const obj = value as Record<string, unknown>

  if (obj.server !== undefined && typeof obj.server !== "string") {
    return false
  }

  if (typeof obj.topic !== "string") {
    return false
  }

  if (obj.events !== undefined) {
    if (!Array.isArray(obj.events)) {
      return false
    }
    for (const item of obj.events) {
      if (typeof item !== "string") {
        return false
      }
    }
  }

  return true
}
