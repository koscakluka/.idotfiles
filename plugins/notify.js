export const NotifyPlugin = async ({ project, $ }) => {
  const lastIdleBySession = new Map()
  const suppressNextIdleBySession = new Set()
  const assistantMessageIDs = new Set()
  const lastAssistantTextBySession = new Map()
  const askedQuestionIDs = new Set()
  const askedPermissionIDs = new Set()

  const projectName = (() => {
    if (project?.name) return String(project.name)
    if (project?.worktree) {
      const parts = String(project.worktree).split("/").filter(Boolean)
      if (parts.length > 0) return parts[parts.length - 1]
    }
    return "OpenCode"
  })()

  const truncate = (value, max) => {
    const text = String(value ?? "").trim()
    if (text.length <= max) return text
    return `${text.slice(0, Math.max(0, max - 3))}...`
  }

  const esc = (value) =>
    String(value ?? "")
      .replace(/\\/g, "\\\\")
      .replace(/"/g, '\\"')
      .replace(/\r?\n/g, " ")

  const notify = async (title, message, subtitle) => {
    if (process.env.TMUX) {
      try {
        await $`tmux oc-notify`
      } catch {}
    }

    const script = [
      `display notification "${esc(message)}"`,
      `with title "${esc(title)}"`,
      `subtitle "${esc(subtitle)}"`,
      'sound name "Glass"',
    ].join(" ")
    await $`osascript -e ${script}`
  }

  return {
    event: async ({ event }) => {
      if (event.type === "message.updated") {
        const info = event.properties?.info
        if (info?.role !== "assistant") return

        if (info?.error?.name === "MessageAbortedError") {
          suppressNextIdleBySession.add(info.sessionID)
        }

        assistantMessageIDs.add(info.id)
        return
      }

      if (event.type === "session.error") {
        const sessionID = event.properties?.sessionID
        const errorName = event.properties?.error?.name
        if (sessionID && errorName === "MessageAbortedError") {
          suppressNextIdleBySession.add(sessionID)
        }
        return
      }

      if (event.type === "message.part.updated") {
        const part = event.properties?.part
        if (part?.type !== "text") return
        if (!assistantMessageIDs.has(part.messageID)) return

        if (typeof part.text === "string" && part.text.trim().length > 0) {
          lastAssistantTextBySession.set(part.sessionID, truncate(part.text, 180))
        } else if (typeof event.properties?.delta === "string") {
          const prior = lastAssistantTextBySession.get(part.sessionID) || ""
          lastAssistantTextBySession.set(part.sessionID, truncate(`${prior}${event.properties.delta}`, 180))
        }
        return
      }

      if (event.type === "question.asked") {
        const request = event.properties
        if (!request?.id || askedQuestionIDs.has(request.id)) return
        askedQuestionIDs.add(request.id)

        const firstQuestion = request.questions?.[0]
        const questionText =
          firstQuestion?.question ||
          firstQuestion?.header ||
          "OpenCode is waiting for your input."
        await notify("OpenCode Question", truncate(questionText, 200), projectName)
        return
      }

      if (event.type === "permission.asked" || event.type === "permission.updated") {
        const request = event.properties
        if (!request?.id || askedPermissionIDs.has(request.id)) return
        askedPermissionIDs.add(request.id)

        const permissionType = request.permission || request.type || "permission"
        const rawPatterns = Array.isArray(request.patterns)
          ? request.patterns
          : Array.isArray(request.pattern)
            ? request.pattern
            : request.pattern
              ? [request.pattern]
              : []
        const patternText = rawPatterns.length > 0 ? ` (${rawPatterns.join(", ")})` : ""
        const body = `Needs ${permissionType}${patternText}`

        await notify("OpenCode Permission", truncate(body, 200), projectName)
        return
      }

      if (event.type === "session.idle") {
        const sessionID = event.properties?.sessionID
        if (!sessionID) return

        if (suppressNextIdleBySession.has(sessionID)) {
          suppressNextIdleBySession.delete(sessionID)
          return
        }

        const now = Date.now()
        const lastIdle = lastIdleBySession.get(sessionID)
        if (typeof lastIdle === "number" && now - lastIdle < 3000) return
        lastIdleBySession.set(sessionID, now)

        const snippet = lastAssistantTextBySession.get(sessionID)
        const message = snippet ? truncate(snippet, 140) : "Completed"
        await notify("OpenCode Complete", message, projectName)
      }
    },
  }
}
