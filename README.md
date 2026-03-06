# opencode-ntfy

[OpenCode](https://github.com/sst/opencode) plugin that sends push notifications via [ntfy](https://ntfy.sh) when tasks complete or errors occur.

## Install

Add to your `opencode.json`:

```json
{
  "plugin": ["opencode-ntfy"]
}
```

Then install dependencies in your OpenCode workspace (`~/.config/opencode`):

```bash
bun install --cwd ~/.config/opencode
```

If your environment does not have Bun, install Bun first (recommended), or use your existing package manager consistently in that workspace.

### Use your own fork (recommended for custom behavior)

If you maintain custom logic (for example, root-session-only idle notifications), pin `opencode-ntfy` to your fork in `~/.config/opencode/package.json`:

```json
{
  "dependencies": {
    "@opencode-ai/plugin": "1.2.20",
    "opencode-ntfy": "git+https://github.com/<your-user>/opencode-ntfy.git#master"
  }
}
```

Then reinstall:

```bash
bun install --cwd ~/.config/opencode
```

## Configure

Create `.opencode-ntfy.json` in your OpenCode working directory (the plugin reads from `directory`):

```json
{
  "topic": "my-opencode-notifications"
}
```

For terminal sessions launched from your home directory, this is usually:

```text
~/.opencode-ntfy.json
```

| Field    | Required | Default                              | Description            |
|----------|----------|--------------------------------------|------------------------|
| `topic`  | yes      | --                                   | ntfy topic name        |
| `server` | no       | `https://ntfy.sh`                    | ntfy server URL        |
| `events` | no       | `["session.idle", "session.error"]`  | events to notify about |

## Root-only idle notifications (main agent only)

This fork resolves session ancestry and sends `session.idle` notifications only for root sessions:

- `session.created` / `session.updated`: cache session parent relationship
- `session.idle`: resolve root/child via cache, then `session.get`, then `session.list`
- child session idle events are skipped

If the session cannot be resolved reliably, idle notification is skipped (fail-closed).

### Self-hosted ntfy

```json
{
  "server": "https://ntfy.example.com",
  "topic": "my-topic"
}
```

### Only error notifications

```json
{
  "topic": "my-topic",
  "events": ["session.error"]
}
```

## Events

| Event           | Title                    | Priority       |
|-----------------|--------------------------|----------------|
| `session.idle`  | `opencode: task complete` | 3 (default)    |
| `session.error` | `opencode: error`        | 4 (high)       |

> `session.idle` is emitted for both root and child sessions in multi-agent runs; this plugin sends only for root sessions.

## Receiving notifications

Subscribe to your topic with any ntfy client:

- **Phone**: [ntfy Android](https://play.google.com/store/apps/details?id=io.heckel.ntfy) / [iOS](https://apps.apple.com/app/ntfy/id1625396347)
- **Desktop**: `curl -s ntfy.sh/my-topic/sse`
- **Browser**: `https://ntfy.sh/my-topic`

## License

GPL-3.0-or-later
