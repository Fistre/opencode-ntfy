// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Andrey Limachko <liannnix@giran.cyou>

import type { Plugin, PluginInput } from "@opencode-ai/plugin"
import { loadConfig } from "./config.js"
import { sendNotification } from "./notify.js"

type SessionRecord = {
  id: string
  parentID?: string
}

function asSessionRecord(value: unknown): SessionRecord | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const obj = value as Record<string, unknown>
  if (typeof obj.id !== "string") {
    return null
  }

  if (obj.parentID !== undefined && typeof obj.parentID !== "string") {
    return null
  }

  return {
    id: obj.id,
    parentID: obj.parentID as string | undefined,
  }
}

function readSessionFromGetResult(value: unknown): SessionRecord | null {
  if (typeof value !== "object" || value === null) {
    return null
  }

  const obj = value as Record<string, unknown>
  return asSessionRecord(obj.data)
}

function readSessionsFromListResult(value: unknown): SessionRecord[] {
  if (typeof value !== "object" || value === null) {
    return []
  }

  const obj = value as Record<string, unknown>
  if (!Array.isArray(obj.data)) {
    return []
  }

  return obj.data
    .map((item) => asSessionRecord(item))
    .filter((item): item is SessionRecord => item !== null)
}

export const plugin: Plugin = async (input: PluginInput) => {
  const { project, directory, client } = input

  const config = loadConfig(directory ?? ".")
  if (!config) {
    console.warn("[opencode-ntfy] No valid config found, plugin disabled")
    return {}
  }

  if (!config.topic) {
    console.warn("[opencode-ntfy] Topic is required in config, plugin disabled")
    return {}
  }

  const projectName = project.id || project.worktree || "unknown"
  const rootSessionCache = new Map<string, boolean>()

  const markSession = (session: SessionRecord): void => {
    rootSessionCache.set(session.id, session.parentID === undefined)
  }

  const resolveIsRootSession = async (sessionID: string): Promise<boolean> => {
    const cached = rootSessionCache.get(sessionID)
    if (cached !== undefined) {
      return cached
    }

    try {
      const getResult = await client.session.get({
        path: { id: sessionID },
        query: { directory },
      })
      const session = readSessionFromGetResult(getResult)
      if (session) {
        markSession(session)
        return session.parentID === undefined
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn("[opencode-ntfy] Failed to resolve session by id:", message)
    }

    try {
      const listResult = await client.session.list({
        query: { directory },
      })
      const sessions = readSessionsFromListResult(listResult)
      for (const session of sessions) {
        markSession(session)
      }
      const cachedAfterList = rootSessionCache.get(sessionID)
      return cachedAfterList === true
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn("[opencode-ntfy] Failed to resolve sessions list:", message)
    }

    return false
  }

  return {
    event: async ({ event }) => {
      if (event.type === "session.created" || event.type === "session.updated") {
        const obj = event.properties as Record<string, unknown>
        const session = asSessionRecord(obj.info)
        if (session) {
          markSession(session)
        }
      }

      if (!config.events.includes(event.type)) {
        return
      }

      if (event.type === "session.idle") {
        const sessionID = event.properties.sessionID ?? "unknown"
        const isRootSession = await resolveIsRootSession(sessionID)
        if (!isRootSession) {
          return
        }
        await sendNotification({
          server: config.server,
          topic: config.topic,
          title: "opencode: task complete",
          message: `Project: ${projectName} | Session: ${sessionID}`,
          priority: 3,
          tags: ["white_check_mark"],
        })
      }

      if (event.type === "session.error") {
        const sessionID = event.properties.sessionID ?? "n/a"
        const error = event.properties.error
        const errorType = error && typeof error === "object" && "type" in error
          ? String(error.type)
          : "unknown"
        await sendNotification({
          server: config.server,
          topic: config.topic,
          title: "opencode: error",
          message: `Project: ${projectName} | Session: ${sessionID} | Error: ${errorType}`,
          priority: 4,
          tags: ["x"],
        })
      }
    },
  }
}

export default plugin
