const SYSTEM_PROMPT = `You are a session title generator. Generate a concise, descriptive title for a coding session.

Rules:
- Title must be in the same language as the conversation
- Title should capture the current main task/topic
- Keep it short (max {maxLength} characters)
- No quotes, no punctuation at the end
- Output ONLY the title, nothing else`;

const CONFIG_PATH = `${process.env.HOME}/.config/opencode/session-auto-rename.jsonc`;

export function systemPrompt(maxLength) {
  return SYSTEM_PROMPT.replace("{maxLength}", String(maxLength));
}

export function parseModel(value) {
  if (!value || typeof value !== "string") return null;
  const index = value.indexOf("/");
  if (index === -1) return null;
  return { providerID: value.slice(0, index), modelID: value.slice(index + 1) };
}

export function fmtDate(format) {
  const date = new Date();
  const pad = (value) => value.toString().padStart(2, "0");
  return String(format || "")
    .replace("YYYY", String(date.getFullYear()))
    .replace("YY", String(date.getFullYear()).slice(-2))
    .replace("MM", pad(date.getMonth() + 1))
    .replace("DD", pad(date.getDate()))
    .replace("HH", pad(date.getHours()))
    .replace("mm", pad(date.getMinutes()));
}

export function defaultConfig() {
  return {
    interval: 10,
    titleMaxLength: 30,
    dateFormat: "YY-MM-DD",
    model: "opencode/big-pickle",
    debug: false,
  };
}

export async function loadConfig() {
  try {
    const file = Bun.file(CONFIG_PATH);
    if (file.size > 0) {
      const text = await file.text();
      const stripped = text
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(?<![:"'])\/\/.*$/gm, "");
      return { ...defaultConfig(), ...JSON.parse(stripped) };
    }
  } catch {}
  return defaultConfig();
}

export function cleanTitle(raw, maxLength) {
  return String(raw || "")
    .trim()
    .replace(/^['"`]+|['"`]+$/g, "")
    .replace(/[.!?。！？]+$/g, "")
    .slice(0, maxLength)
    .trim();
}

export function formatTitle(title, dateFormat) {
  const suffix = fmtDate(dateFormat);
  return suffix ? `${title}(${suffix})` : title;
}

export function textFromParts(parts) {
  return (parts || [])
    .filter((part) => part && part.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function unwrap(result) {
  return result && typeof result === "object" && "data" in result ? result.data : result;
}
