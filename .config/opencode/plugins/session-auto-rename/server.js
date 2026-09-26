import {
  cleanTitle,
  formatTitle,
  loadConfig,
  parseModel,
  systemPrompt,
  textFromParts,
  unwrap,
} from "./shared.js";

const msgCount = new Map();

async function generateTitle(ctx, cfg, text) {
  const model = parseModel(cfg.model);
  const created = await ctx.client.session.create({ body: {} });
  const sessionID = unwrap(created)?.id;
  if (!sessionID) return "";

  try {
    const body = {
      system: systemPrompt(cfg.titleMaxLength),
      parts: [{ type: "text", text: `Current conversation context:\n\n${text.slice(0, 2000)}\n\nGenerate a session title:` }],
    };
    if (model) body.model = model;

    const response = await ctx.client.session.prompt({ path: { id: sessionID }, body });
    const part = unwrap(response)?.parts?.find((item) => item.type === "text");
    return cleanTitle(part?.text, cfg.titleMaxLength);
  } finally {
    await ctx.client.session.delete({ path: { id: sessionID } }).catch(() => {});
  }
}

export const server = async (ctx) => {
  const cfg = await loadConfig();
  const interval = Number(cfg.interval);

  if (cfg.debug) console.log("[auto-rename] cfg:", cfg);

  return {
    "chat.message": async (input, output) => {
      const { sessionID } = input;
      if (!sessionID || !Number.isFinite(interval) || interval <= 0) return;

      const count = (msgCount.get(sessionID) ?? 0) + 1;
      msgCount.set(sessionID, count);
      if (count % interval !== 0) return;

      let text = output.message?.summary?.title || output.message?.summary?.body || textFromParts(output.parts);
      if (!text || text.length < 5) return;

      setImmediate(async () => {
        try {
          const title = await generateTitle(ctx, cfg, text);
          if (!title) return;
          const full = formatTitle(title, cfg.dateFormat);
          await ctx.client.session.update({ path: { id: sessionID }, body: { title: full } });
          if (cfg.debug) console.log("[auto-rename]", sessionID, "->", full);
        } catch (error) {
          console.error("[auto-rename] error:", error);
        }
      });
    },
  };
};

export default { id: "local-session-auto-rename-server", server };
