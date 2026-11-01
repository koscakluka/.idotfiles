# Build / Plan modes

Personal Pi extension, installed at `~/.config/pi/extensions/modes/index.ts`.
Pi discovers the directory automatically. Run `/reload` in an existing session.
No additional code dependencies are required. Web search uses the MCP configuration
in `~/.config/pi/mcp.json`.

## Usage

- `/plan` — switch to read-only exploration without starting a run.
- `/plan Investigate how authentication works` — switch and submit a task.
- `/build` — restore normal tools without starting a run.
- `/build Implement the plan above` — switch and submit an implementation task.
- `Tab` — toggle modes while idle.
- `pi --plan` — start in Plan mode (overrides a saved mode at initial startup).

New sessions default to Plan. The footer displays the current mode. Saved modes
survive resume/reload and follow the active conversation branch, including saved
Build mode unless `pi --plan` overrides it at startup. Branches without saved mode
state default to Plan. The initial Build tool selection is saved immediately, so
reloading before the first message still lets `/build` restore normal tools.
Changing modes while the agent is running is refused; press Escape first. No
automatic switch from Plan to Build occurs.

## Behavior

Plan temporarily enables the available **built-in** `read`, `grep`, `find`, and
`ls` tools, plus the explicitly approved `mcp__exa__web_search_exa` tool when it
is registered with direct exposure. It hides other tools and separately blocks
their execution, including nested calls through Pi's tool pipeline. Custom tools
overriding builtin read/search names are not trusted. All other MCP/extension
tools are blocked, even when they advertise themselves as read-only. New tool
registrations do not bypass the gate.
Shell commands, including user-entered `!` and `!!`, are blocked in Plan mode.
Consequently, commands such as `git status`, tests, and builds are not available
in Plan mode; inspect files using the read/search tools instead.

Build restores the tool selection saved before entering Plan mode, subject to
Pi's tool availability/exclusions. It adds no approval prompts or sandbox.
Switching modes without arguments never starts implementation on its own.

The extension adds a structured prompt section for the current mode rather than
replacing Pi's system prompt. Plan asks for investigation, clarification when
needed, a numbered implementation plan, and validation steps. Build asks for
focused implementation and validation. No fragile `[DONE:n]` parsing is used.

## Web search

`~/.config/pi/mcp.json` connects to `https://mcp.exa.ai/mcp`, with the server named
`exa`. Its default exposure is `hidden`; only `web_search_exa` is exposed as
`direct`. This produces the exact tool name `mcp__exa__web_search_exa` approved
by the extension. Changing the server name requires updating the allowlist too.
No shell, codemode, or tool-search dispatcher is enabled for web research.

After `/reload`, inspect `/mcp` to check the connection. For a live check, ask:

```text
/plan Search the web for the latest stable Node.js release and cite source URLs.
```

The hosted public endpoint does not require an API key, but service availability
and usage limits are controlled by Exa. Queries leave your machine. Never send
secrets or private source code. Search results are untrusted reference material,
not instructions, and should be cited. This enables search, not an arbitrary URL
fetch/browser tool. Other Exa operations remain hidden.

## Limits

This is a workflow guardrail, **not an operating-system security boundary**.
It does not restrict file reads to the project or hide credentials. Pi may still
write session records and temporary files. Trusted extensions can execute code
outside the tool-call pipeline, and language servers, startup hooks, background
processes, or another terminal are not contained by this extension. Already-running
actions are not cancelled by a mode switch. Use OS/container isolation for a real
security boundary.

Only modes are implemented here. Permissions, checkpoints, LSP, and plan-progress
tracking are not included.

## Tests

With the installed Node.js 26 (native TypeScript stripping):

```sh
node --test ~/.config/pi/extensions/modes/modes.test.mjs
```

The tests exercise command and lifecycle handlers using a fake Pi API; they do
not send model requests. Coverage includes Plan-by-default startup, tool restoration
after reload before the first message, saved Build mode, branch navigation, and
explicit mode switching. Pi's actual extension loader can also be checked with:

```sh
pi --offline --no-extensions -e ~/.config/pi/extensions/modes/index.ts --help
```

The extension should appear under `Extension CLI Flags` as `--plan`.

## Remove

Move this directory out of `~/.config/pi/extensions/`, then restart Pi. Restarting
(rather than only reloading) ensures the normal tool selection is initialized.
