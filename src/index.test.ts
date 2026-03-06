// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (c) 2026 Andrey Limachko <liannnix@giran.cyou>

import { describe, it, expect, beforeEach, afterEach, vi } from "bun:test"
import { mkdtempSync, writeFileSync, rmSync } from "fs"
import { join } from "path"
import { tmpdir } from "os"
import { plugin } from "./index"

function createPluginInput(directory: string, options?: { childSession?: boolean }) {
  return {
    project: { id: "my-project", worktree: "/my-project" },
    directory,
    client: {
      session: {
        get: vi.fn().mockImplementation(async ({ path }: { path: { id: string } }) => {
          const sessionID = path.id
          if (options?.childSession) {
            return { data: { id: sessionID, parentID: "parent-session" } }
          }
          return { data: { id: sessionID } }
        }),
        list: vi.fn().mockResolvedValue({ data: [] }),
      },
    },
  }
}

describe("plugin", () => {
  let tempDir: string

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "opencode-ntfy-test-"))
  })

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it("returns empty hooks when config file does not exist", async () => {
    const hooks = await plugin(createPluginInput(tempDir))
    expect(hooks).toEqual({})
  })

  it("returns empty hooks when topic is missing", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ server: "https://custom.example.com" })
    )
    const hooks = await plugin(createPluginInput(tempDir))
    expect(hooks).toEqual({})
  })

  it("sends notification on session.idle event", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ topic: "my-topic" })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin(createPluginInput(tempDir))
    expect(hooks.event).toBeDefined()

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc123" },
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("https://ntfy.sh/my-topic", {
      method: "POST",
      body: "Project: my-project | Session: abc123",
      headers: {
        "X-Title": "opencode: task complete",
        "X-Priority": "3",
        "X-Tags": "white_check_mark",
      },
      signal: expect.any(AbortSignal),
    })
  })

  it("sends notification on session.error event", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ topic: "my-topic" })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin(createPluginInput(tempDir))
    expect(hooks.event).toBeDefined()

    await hooks.event!({
      event: {
        type: "session.error",
        properties: { sessionID: "abc123", error: { type: "ProviderAuthError" } },
      },
    })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("https://ntfy.sh/my-topic", {
      method: "POST",
      body: "Project: my-project | Session: abc123 | Error: ProviderAuthError",
      headers: {
        "X-Title": "opencode: error",
        "X-Priority": "4",
        "X-Tags": "x",
      },
      signal: expect.any(AbortSignal),
    })
  })

  it("ignores events not in config.events", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ topic: "my-topic", events: ["session.idle"] })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin(createPluginInput(tempDir))

    await hooks.event!({
      event: {
        type: "session.error",
        properties: { sessionID: "abc123", error: { type: "ProviderAuthError" } },
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("uses custom server from config", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ server: "https://custom.example.com", topic: "my-topic" })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin(createPluginInput(tempDir))

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc123" },
      },
    })

    expect(fetchMock).toHaveBeenCalledWith("https://custom.example.com/my-topic", expect.any(Object))
  })

  it("uses worktree when id is missing", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ topic: "my-topic" })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin({
      ...createPluginInput(tempDir),
      project: { worktree: "/path/to/project" },
    })

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc123" },
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ntfy.sh/my-topic",
      expect.objectContaining({
        body: "Project: /path/to/project | Session: abc123",
      })
    )
  })

  it("handles missing sessionID gracefully", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ topic: "my-topic" })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin(createPluginInput(tempDir))

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: {},
      },
    })

    expect(fetchMock).toHaveBeenCalledWith(
      "https://ntfy.sh/my-topic",
      expect.objectContaining({
        body: "Project: my-project | Session: unknown",
      })
    )
  })

  it("skips notification for child session on session.idle", async () => {
    writeFileSync(
      join(tempDir, ".opencode-ntfy.json"),
      JSON.stringify({ topic: "my-topic" })
    )

    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const hooks = await plugin(createPluginInput(tempDir, { childSession: true }))

    await hooks.event!({
      event: {
        type: "session.idle",
        properties: { sessionID: "abc123" },
      },
    })

    expect(fetchMock).not.toHaveBeenCalled()
  })
})
