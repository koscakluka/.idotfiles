import {
  cleanTitle,
  formatTitle,
  loadConfig,
  parseModel,
  systemPrompt,
  textFromParts,
  unwrap,
} from "./shared.js";

function currentSessionID(api) {
  const route = api.route.current;
  return route?.name === "session" ? route.params?.sessionID : undefined;
}

async function sessionContext(api, sessionID) {
  const response = await api.client.session.messages({ sessionID, limit: 12 });
  if (response?.error) throw response.error;

  const data = unwrap(response);
  const messages = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
  const blocks = [];

  for (const item of messages.slice(-12)) {
    const message = item?.info || item;
    const parts = item?.parts || [];
    const text = textFromParts(parts);
    if (!text) continue;
    blocks.push(`${message.role || "message"}: ${text}`);
  }

  return blocks.join("\n\n").slice(-4000).trim();
}

function summarize(value, max = 500) {
  if (value instanceof Error) return value.message;
  if (typeof value === "string") return value.slice(0, max);
  try {
    return JSON.stringify(value).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

async function generateTitle(api, cfg, text) {
  const model = parseModel(cfg.model);
  const created = await api.client.session.create({ title: "Title generation" });
  const sessionID = unwrap(created)?.id;
  if (!sessionID) throw new Error(`temporary session create returned no id: ${summarize(created)}`);

  try {
    const request = {
      sessionID,
      system: systemPrompt(cfg.titleMaxLength),
      parts: [{ type: "text", text: `Current conversation context:\n\n${text}\n\nGenerate a session title:` }],
    };
    if (model) request.model = model;

    const response = await api.client.session.prompt(request);
    const data = unwrap(response);

    if (cfg.debug) {
      console.log(
        "[auto-rename:tui] prompt response:",
        summarize({ status: response?.response?.status, error: response?.error, data }, 2000),
      );
    }

    if (response?.error) throw new Error(`title model error: ${summarize(response.error)}`);

    const part = data?.parts?.find((item) => item.type === "text");
    const title = cleanTitle(part?.text, cfg.titleMaxLength);
    if (!title) {
      const partTypes = Array.isArray(data?.parts)
        ? data.parts.map((item) => item?.type || "unknown").join(", ")
        : "none";
      throw new Error(`title model returned no text part (part types: ${partTypes})`);
    }
    return title;
  } finally {
    await api.client.session.delete({ sessionID }).catch(() => {});
  }
}

export async function retitleSession(api, sessionID) {
  const text = await sessionContext(api, sessionID);
  if (!text || text.length < 5) {
    throw new Error("Not enough session context for title.");
  }

  const cfg = await loadConfig();
  const title = await generateTitle(api, cfg, text);

  const full = formatTitle(title, cfg.dateFormat);
  const response = await api.client.session.update({ sessionID, title: full });
  if (response?.error) throw response.error;
  return full;
}

async function retitle(api) {
  const sessionID = currentSessionID(api);
  if (!sessionID) {
    api.ui.toast({ variant: "warning", message: "Open a session before retitling." });
    return;
  }

  api.ui.toast({ variant: "info", message: "Generating session title..." });

  try {
    const full = await retitleSession(api, sessionID);
    api.ui.toast({ variant: "success", message: `Renamed to: ${full}` });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    api.ui.toast({ variant: "error", message: `Retitle failed: ${message}` });
  }
}

export const tui = async (api) => {
  const dispose = api.command.register(() => [
    {
      title: "Regenerate session title",
      value: "session.retitle",
      description: "Generate a fresh title for the current session",
      category: "Session",
      suggested: true,
      slash: { name: "retitle", aliases: ["title"] },
      onSelect: () => retitle(api),
    },
  ]);

  api.lifecycle.onDispose(dispose);
};

export default { id: "local-session-auto-rename-tui", tui };
