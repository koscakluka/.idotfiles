import assert from "node:assert/strict";
import { test } from "node:test";
import modes from "./index.ts";

const NORMAL = ["read", "bash", "edit", "write", "mcp__example__mutate"];
const READ = ["read", "grep", "find", "ls"];
const WEB = "mcp__exa__web_search_exa";
const webTool = (exposure = "direct") => ({
	name: WEB, exposure,
	sourceInfo: { source: "builtin", path: "builtin:mcp" },
});
const state = (mode, buildTools = NORMAL) => ({
	type: "custom", customType: "build-plan-mode", data: { version: 1, mode, buildTools },
});

function harness({ entries = [], active = NORMAL, planFlag = false, tools } = {}) {
	const handlers = new Map();
	const commands = new Map();
	const shortcuts = new Map();
	const messages = [];
	const notifications = [];
	const statuses = new Map();
	let selected = [...active];
	let branch = [...entries];
	let idle = true;
	const registered = tools ?? [...new Set([...NORMAL, ...READ, "powershell", "codemode", "tool_search", "subagent"])].map((name) => ({
		name, exposure: "direct",
		sourceInfo: { source: name.startsWith("mcp__") || name === "subagent" ? "extension" : "builtin", path: `builtin:${name}` },
	}));
	const pi = {
		on: (name, handler) => handlers.set(name, handler),
		registerFlag() { },
		getFlag: () => planFlag,
		registerCommand: (name, command) => commands.set(name, command),
		registerShortcut: (key, shortcut) => shortcuts.set(key, shortcut),
		getActiveTools: () => [...selected],
		getAllTools: () => registered,
		setActiveTools: (names) => { selected = names.filter((name) => registered.some((tool) => tool.name === name)); },
		appendEntry: (customType, data) => branch.push({ type: "custom", customType, data: structuredClone(data) }),
		sendUserMessage: (message) => messages.push(message),
	};
	const ctx = {
		mode: "tui", hasUI: true, isIdle: () => idle,
		sessionManager: { getBranch: () => branch },
		ui: {
			theme: { fg: (_color, text) => text },
			setStatus: (key, value) => statuses.set(key, value),
			notify: (text) => notifications.push(text),
		},
	};
	modes(pi);
	return {
		pi, ctx, registered, messages, notifications, statuses,
		get active() { return [...selected]; },
		get entries() { return structuredClone(branch); },
		setIdle: (value) => { idle = value; },
		setBranch: (value) => { branch = value; },
		emit: async (name, event = {}) => handlers.get(name)?.(event, ctx),
		start: async (reason = "startup") => handlers.get("session_start")({ reason }, ctx),
		command: async (name, args = "") => commands.get(name).handler(args, ctx),
		toggle: async () => shortcuts.get("tab").handler(ctx),
	};
}

test("new sessions start in Plan with read-only tools and no automatic work", async () => {
	const h = harness();
	await h.start();
	assert.deepEqual(h.active, READ);
	assert.match(h.statuses.get("build-plan"), /PLAN/);
	assert.deepEqual(h.messages, []);
	assert.equal((await h.emit("tool_call", { toolName: "write" })).block, true);
});

test("reload before the first message preserves the original Build tools", async () => {
	const h = harness();
	await h.start();
	assert.deepEqual(h.entries, [state("plan")]);
	const reloaded = harness({ entries: h.entries, active: h.active });
	await reloaded.start("reload");
	assert.deepEqual(reloaded.active, READ);
	await reloaded.command("build");
	assert.deepEqual(reloaded.active, NORMAL);
	assert.deepEqual(reloaded.messages, []);
});

test("saved Build mode is respected without --plan", async () => {
	for (const reason of ["startup", "resume", "reload", "fork"]) {
		const h = harness({ entries: [state("build")] });
		await h.start(reason);
		assert.deepEqual(h.active, NORMAL, reason);
		assert.match(h.statuses.get("build-plan"), /BUILD/);
		assert.equal(await h.emit("tool_call", { toolName: "write" }), undefined);
	}
});

test("Plan exposes only builtin read/search and blocks all other tool calls", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	assert.deepEqual(h.active, READ);
	for (const toolName of READ) assert.equal(await h.emit("tool_call", { toolName }), undefined);
	for (const toolName of ["bash", "powershell", "edit", "write", "codemode", "tool_search", "subagent", "mcp__example__mutate", "unknown"]) {
		const result = await h.emit("tool_call", { toolName, parentToolCallId: "parent" });
		assert.equal(result.block, true, toolName);
	}
	assert.match(h.statuses.get("build-plan"), /PLAN/);
});

test("Build restores the exact previous selection, including custom tools", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	await h.command("plan"); // Idempotent; must not overwrite the Build snapshot.
	await h.command("build");
	assert.deepEqual(h.active, NORMAL);
	assert.equal(await h.emit("tool_call", { toolName: "bash" }), undefined);
	assert.equal(await h.emit("user_bash"), undefined);
});

test("commands optionally submit a task, while bare commands never start a run", async () => {
	const h = harness();
	await h.start();
	await h.command("plan", "  Investigate authentication  ");
	assert.deepEqual(h.messages, ["Investigate authentication"]);
	assert.deepEqual(h.active, READ);
	await h.command("build", "Implement the plan");
	assert.deepEqual(h.active, NORMAL);
	assert.deepEqual(h.messages, ["Investigate authentication", "Implement the plan"]);
});

test("busy mode changes are refused without queuing tasks or escalating privileges", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	h.setIdle(false);
	await h.command("build", "Implement");
	assert.deepEqual(h.active, READ);
	assert.deepEqual(h.messages, []);
	assert.equal((await h.emit("tool_call", { toolName: "write" })).block, true);
	assert.match(h.notifications.at(-1), /Stop the current run/);
});

test("Plan blocks user shell commands without running them", async () => {
	const h = harness({ planFlag: true });
	await h.start();
	const result = await h.emit("user_bash", { command: "touch unwanted-file" });
	assert.equal(result.result.exitCode, 1);
	assert.match(result.result.output, /blocks shell/);
});

test("startup --plan overrides a saved Build mode, but reload respects later /build", async () => {
	const h = harness({ entries: [state("build")], planFlag: true });
	await h.start();
	assert.deepEqual(h.active, READ);
	await h.command("build");
	const reloaded = harness({ entries: h.entries, active: h.active, planFlag: true });
	await reloaded.start("reload");
	assert.deepEqual(reloaded.active, NORMAL);
});

test("resume and reload in Plan preserve the pre-plan Build selection", async () => {
	for (const reason of ["startup", "resume", "reload", "fork"]) {
		const h = harness({ entries: [state("plan")], active: READ });
		await h.start(reason);
		assert.deepEqual(h.active, READ);
		await h.command("build");
		assert.deepEqual(h.active, NORMAL, reason);
	}
});

test("tree navigation restores only the active branch's mode", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	h.setBranch([state("build", ["read", "bash"])]);
	await h.emit("session_tree");
	assert.deepEqual(h.active, ["read", "bash"]);
	h.setBranch([state("plan", ["read", "edit"])]);
	await h.emit("session_tree");
	assert.deepEqual(h.active, READ);
	await h.command("build");
	assert.deepEqual(h.active, ["read", "edit"]);
	h.setBranch([]);
	await h.emit("session_tree");
	assert.deepEqual(h.active, READ);
});

test("navigation before the first mode entry defaults to Plan and preserves the Build baseline", async () => {
	const h = harness({ entries: [state("plan")], active: READ });
	await h.start("reload");
	h.setBranch([]);
	await h.emit("session_tree");
	assert.deepEqual(h.active, READ);
	await h.command("build");
	assert.deepEqual(h.active, NORMAL);
});

test("unavailable or excluded tools are never reintroduced", async () => {
	const h = harness({
		entries: [state("plan")], active: ["read"],
		tools: [{ name: "read", exposure: "direct", sourceInfo: { source: "builtin", path: "builtin:read" } }],
	});
	await h.start();
	assert.deepEqual(h.active, ["read"]);
	await h.command("build");
	assert.deepEqual(h.active, ["read"]);
});

test("malformed persisted state defaults to Plan", async () => {
	const h = harness({ entries: [{ type: "custom", customType: "build-plan-mode", data: { version: 1, mode: "plan", buildTools: [42] } }] });
	await h.start();
	assert.deepEqual(h.active, READ);
	await h.command("build");
	assert.deepEqual(h.active, NORMAL);
});

test("per-run guidance changes with mode and hides late-activated tools", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	h.pi.setActiveTools([...READ, "write"]);
	const plan = { systemPromptOptions: { sections: {}, selectedTools: [...READ, "write"] } };
	await h.emit("before_agent_start", plan);
	assert.deepEqual(h.active, READ);
	assert.deepEqual(plan.systemPromptOptions.selectedTools, READ);
	assert.match(plan.systemPromptOptions.sections.build_plan_mode, /Current mode: PLAN/);
	await h.command("build");
	const build = { systemPromptOptions: { sections: {} } };
	await h.emit("before_agent_start", build);
	assert.match(build.systemPromptOptions.sections.build_plan_mode, /Current mode: BUILD/);
	assert.doesNotMatch(build.systemPromptOptions.sections.build_plan_mode, /Current mode: PLAN/);
});

test("tools overriding builtin read/search are not trusted by name", async () => {
	const h = harness({
		tools: [
			{ name: "read", exposure: "direct", sourceInfo: { source: "extension", path: "/custom/read.ts" } },
			{ name: "grep", exposure: "direct", sourceInfo: { source: "builtin", path: "builtin:grep" } },
		]
	});
	await h.start();
	await h.command("plan");
	assert.deepEqual(h.active, ["grep"]);
	assert.equal((await h.emit("tool_call", { toolName: "read" })).block, true);
});

test("newly registered tools are denied even if they claim to be read-only", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	h.registered.push({ name: "mcp__new__tool", exposure: "direct", annotations: { readOnlyHint: true }, sourceInfo: { source: "extension" } });
	assert.equal((await h.emit("tool_call", { toolName: "mcp__new__tool" })).block, true);
});

test("mode enforcement works in noninteractive sessions without requiring UI", async () => {
	const h = harness({ planFlag: true });
	h.ctx.mode = "print";
	h.ctx.hasUI = false;
	h.ctx.ui = undefined;
	await h.start();
	assert.equal((await h.emit("tool_call", { toolName: "write" })).block, true);
	await h.command("build");
	assert.equal(await h.emit("tool_call", { toolName: "write" }), undefined);
});

test("shortcut toggles modes without starting work", async () => {
	const h = harness();
	await h.start();
	await h.toggle();
	assert.deepEqual(h.active, NORMAL);
	await h.toggle();
	assert.deepEqual(h.active, READ);
	assert.deepEqual(h.messages, []);
});

test("Plan exposes and permits the exact approved Exa search tool, including nested calls", async () => {
	const h = harness();
	h.registered.push(webTool());
	await h.start();
	await h.command("plan");
	assert.deepEqual(h.active, [...READ, WEB]);
	assert.equal(await h.emit("tool_call", { toolName: WEB }), undefined);
	assert.equal(await h.emit("tool_call", { toolName: WEB, parentToolCallId: "parent" }), undefined);
	for (const toolName of ["bash", "edit", "write", "codemode", "tool_search", "mcp__exa__crawling_exa", "mcp__other__web_search_exa"]) {
		assert.equal((await h.emit("tool_call", { toolName, parentToolCallId: "parent" })).block, true, toolName);
	}
});

test("hidden or non-direct Exa search tools are not enabled or permitted", async () => {
	for (const exposure of ["hidden", "deferred", "codemode"]) {
		const h = harness();
		h.registered.push(webTool(exposure));
		await h.start();
		await h.command("plan");
		assert.deepEqual(h.active, READ);
		assert.equal((await h.emit("tool_call", { toolName: WEB })).block, true, exposure);
	}
});

test("Exa connecting after Plan starts is available on the next run", async () => {
	const h = harness();
	await h.start();
	await h.command("plan");
	assert.equal((await h.emit("tool_call", { toolName: WEB })).block, true);
	h.registered.push(webTool());
	const event = { systemPromptOptions: { sections: {}, selectedTools: READ } };
	await h.emit("before_agent_start", event);
	assert.deepEqual(event.systemPromptOptions.selectedTools, [...READ, WEB]);
	assert.equal(await h.emit("tool_call", { toolName: WEB }), undefined);
	assert.match(event.systemPromptOptions.sections.build_plan_mode, /cite relevant source URLs/);
	assert.match(event.systemPromptOptions.sections.build_plan_mode, /Never include secrets or private code/);
});

test("Build preserves the web search tool when it was active before Plan", async () => {
	const h = harness({ active: [...NORMAL, WEB] });
	h.registered.push(webTool());
	await h.start();
	await h.command("plan");
	await h.command("build");
	assert.deepEqual(h.active, [...NORMAL, WEB]);
});

test("resuming Plan keeps approved web search without changing the saved Build selection", async () => {
	const h = harness({ entries: [state("plan")], active: READ });
	h.registered.push(webTool());
	await h.start("resume");
	assert.deepEqual(h.active, [...READ, WEB]);
	await h.command("build");
	assert.deepEqual(h.active, NORMAL);
});
