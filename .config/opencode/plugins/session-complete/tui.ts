import type { TuiPluginModule } from "@opencode-ai/plugin/tui"
import { createMemo, createSignal, onCleanup } from "solid-js"
import { createComponent } from "solid-js/web"

type SessionLike = {
  id: string
  title: string
  directory: string
  path?: string
  parentID?: string
  time: {
    updated: number
    archived?: number
  }
  project?: {
    name?: string
    worktree: string
  } | null
}

type TuiApi = Parameters<NonNullable<TuiPluginModule["tui"]>>[0]
type RetitleSession = (api: TuiApi, sessionID: string) => Promise<string>

const COMPLETED_SEPARATOR_VALUE = "__session_complete_separator___"
const COMPLETED_TOGGLE_VALUE = "__session_complete_toggle_completed__"

function currentSessionID(api: TuiApi) {
  const current = api.route.current
  if (current.name !== "session") return
  const sessionID = current.params?.sessionID
  return typeof sessionID === "string" ? sessionID : undefined
}

function dateCategory(value: number | undefined) {
  if (!value) return "Unknown"
  const date = new Date(value)
  if (date.toDateString() === new Date().toDateString()) return "Today"
  return date.toDateString()
}

async function readSessions(api: TuiApi) {
  const result = await api.client.session.list({ scope: "project", roots: true, limit: 500 })
  if (result.error) throw result.error

  const sessions = (result.data ?? []) as SessionLike[]
  const activeSessions = sessions.filter((session) => !session.time.archived)
  const archivedSessions = sessions.filter((session) => session.time.archived)

  return { activeSessions, archivedSessions }
}

function sessionOptions(sessions: SessionLike[], category: (session: SessionLike) => string) {
  return sessions
    .toSorted((a, b) => b.time.updated - a.time.updated)
    .map((session) => ({
      title: session.title,
      value: session.id,
      category: category(session),
    }))
}

function archivedSessionOptions(sessions: SessionLike[]) {
  return sessions
    .toSorted((a, b) => (b.time.archived || b.time.updated) - (a.time.archived || a.time.updated))
    .map((session) => ({
      title: "✓ " + session.title,
      value: session.id,
      category: `${dateCategory(session.time.archived || session.time.updated)} `,
    }))
}

function isControlValue(value: string) {
  return value === COMPLETED_SEPARATOR_VALUE || value === COMPLETED_TOGGLE_VALUE
}

function matchesFilter(session: SessionLike, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  return session.title.toLowerCase().includes(needle)
}

function buildOptions(
  activeSessions: SessionLike[],
  archivedSessions: SessionLike[],
  query: string,
  showCompleted: boolean,
) {
  const searching = query.trim().length > 0
  const active = activeSessions.filter((session) => matchesFilter(session, query))
  const archived = archivedSessions.filter((session) => matchesFilter(session, query))
  const expanded = showCompleted || searching

  return [
    ...sessionOptions(active, (session) => dateCategory(session.time.updated)),
    ...(archivedSessions.length
      ? [
        { title: "", value: COMPLETED_SEPARATOR_VALUE, category: "--- Completed ---", disabled: true },
        {
          title: searching
            ? `Completed matches (${archived.length})`
            : `${expanded ? "Hide" : "Show"} completed (${archivedSessions.length})`,
          value: COMPLETED_TOGGLE_VALUE,
          category: "--- Completed ---",
          footer: searching ? "search" : "enter",
        },
      ]
      : []),
    ...(expanded ? archivedSessionOptions(archived) : []),
  ]
}

async function setArchived(api: TuiApi, sessionID: string, archived: boolean) {
  const result = await api.client.session.update({
    sessionID,
    time: { archived: archived ? Date.now() : 0 },
  })
  if (result.error) throw result.error
}

function hasAutoRenamePlugin(api: TuiApi) {
  return api.plugins.list().some((plugin) => {
    if (!plugin.active) return false
    return (
      plugin.id === "local-session-auto-rename-tui" ||
      plugin.id.includes("session-auto-rename") ||
      plugin.spec.includes("session-auto-rename") ||
      plugin.target.includes("session-auto-rename")
    )
  })
}

async function loadRetitleSession(): Promise<RetitleSession> {
  const mod = (await import("../session-auto-rename/tui.js")) as { retitleSession?: RetitleSession }
  if (!mod.retitleSession) throw new Error("session-auto-rename retitle helper not found")
  return mod.retitleSession
}

function openPicker(api: TuiApi) {
  void (async () => {
    const { activeSessions, archivedSessions } = await readSessions(api)
    const current = currentSessionID(api)
    const canRetitle = hasAutoRenamePlugin(api)

    if (activeSessions.length === 0 && archivedSessions.length === 0) {
      api.ui.toast({ variant: "info", message: "No sessions found" })
      return
    }

    api.ui.dialog.setSize("large")
    api.ui.dialog.replace(() => {
      const [filter, setFilter] = createSignal("")
      const [showCompleted, setShowCompleted] = createSignal(false)
      const [active, setActive] = createSignal(activeSessions)
      const [archived, setArchivedSessions] = createSignal(archivedSessions)
      const [selected, setSelected] = createSignal(
        current && activeSessions.some((session) => session.id === current)
          ? current
          : (activeSessions[0]?.id ?? (archivedSessions.length ? COMPLETED_TOGGLE_VALUE : undefined)),
      )
      const options = createMemo(() => buildOptions(active(), archived(), filter(), showCompleted()))
      const selectedSession = createMemo(() => {
        const id = selected()
        if (!id || isControlValue(id)) return
        const activeSession = active().find((session) => session.id === id)
        if (activeSession) return { session: activeSession, archived: false }
        const archivedSession = archived().find((session) => session.id === id)
        if (archivedSession) return { session: archivedSession, archived: true }
      })

      async function toggleSession(sessionID: string) {
        const selected = selectedSession()
        if (!selected || selected.session.id !== sessionID) return
        const nextArchived = !selected.archived
        const visibleOptions = options()
        const selectedIndex = visibleOptions.findIndex((option) => option.value === sessionID)
        const nextSelection = selected.archived
          ? sessionID
          : (
            visibleOptions
              .slice(0, selectedIndex < 0 ? 0 : selectedIndex)
              .toReversed()
              .find((option) => !isControlValue(option.value) && !option.disabled)?.value
            ?? visibleOptions
              .slice(selectedIndex + 1)
              .find((option) => !isControlValue(option.value) && !option.disabled)?.value
            ?? COMPLETED_TOGGLE_VALUE
          )
        await setArchived(api, sessionID, nextArchived)

        if (nextArchived) {
          const completed = { ...selected.session, time: { ...selected.session.time, archived: Date.now() } }
          setActive((sessions) => sessions.filter((session) => session.id !== sessionID))
          setArchivedSessions((sessions) => [completed, ...sessions.filter((session) => session.id !== sessionID)])
          if (nextSelection) {
            setSelected(nextSelection)
          }
          return
        }

        const restored = { ...selected.session, time: { ...selected.session.time, archived: 0 } }
        setArchivedSessions((sessions) => sessions.filter((session) => session.id !== sessionID))
        setActive((sessions) => [restored, ...sessions.filter((session) => session.id !== sessionID)])
        if (nextSelection) {
          setSelected(nextSelection)
        }
      }

      async function retitleSelected() {
        const selected = selectedSession()
        if (!selected) return

        api.ui.toast({ variant: "info", message: "Generating session title..." })
        const retitleSession = await loadRetitleSession()
        const title = await retitleSession(api, selected.session.id)
        const updateTitle = (session: SessionLike) =>
          session.id === selected.session.id ? { ...session, title } : session

        if (selected.archived) {
          setArchivedSessions((sessions) => sessions.map(updateTitle))
        } else {
          setActive((sessions) => sessions.map(updateTitle))
        }

        api.ui.toast({ variant: "success", message: `Renamed to: ${title}` })
      }

      const disposeKeymap = (api as unknown as {
        keymap?: {
          registerLayer(layer: {
            commands: Array<{ name: string; title: string; category: string; run: () => void }>
            bindings: Array<{ key: string; cmd: string; desc: string }>
          }): () => void
        }
      }).keymap?.registerLayer({
        commands: [
          {
            name: "session.complete.toggle",
            title: "Complete or restore selected session",
            category: "Dialog",
            run() {
              const selected = selectedSession()
              if (!selected) return
              void toggleSession(selected.session.id).catch((error) =>
                api.ui.toast({
                  variant: "error",
                  title: selected.archived ? "Restore failed" : "Complete failed",
                  message: error instanceof Error ? error.message : String(error),
                }),
              )
            },
          },
          ...(canRetitle
            ? [
              {
                name: "session.retitle.selected",
                title: "Regenerate selected session title",
                category: "Dialog",
                run() {
                  void retitleSelected().catch((error) =>
                    api.ui.toast({
                      variant: "error",
                      title: "Retitle failed",
                      message: error instanceof Error ? error.message : String(error),
                    }),
                  )
                },
              },
            ]
            : []),
        ],
        bindings: [
          {
            key: "ctrl+d",
            cmd: "session.complete.toggle",
            desc: "Complete or restore selected session",
          },
          ...(canRetitle
            ? [
              {
                key: "ctrl+r",
                cmd: "session.retitle.selected",
                desc: "Regenerate selected session title",
              },
            ]
            : []),
        ],
      }) ?? (() => { })
      onCleanup(disposeKeymap)

      return createComponent(api.ui.DialogSelect, {
        title: "Sessions",
        get options() {
          return options()
        },
        get current() {
          return filter().trim() ? undefined : selected()
        },
        skipFilter: true,
        onFilter: setFilter,
        onMove(option) {
          setSelected(option.value)
        },
        onSelect(option) {
          if (option.value === COMPLETED_TOGGLE_VALUE) {
            if (filter().trim()) return
            setShowCompleted((value) => !value)
            return
          }
          if (isControlValue(option.value)) return
          api.route.navigate("session", { sessionID: option.value })
          api.ui.dialog.clear()
        },
      })
    })
  })().catch((error) => {
    api.ui.toast({
      variant: "error",
      title: "Session picker failed",
      message: error instanceof Error ? error.message : String(error),
    })
  })
}

async function markCurrent(api: TuiApi, archived: boolean) {
  const sessionID = currentSessionID(api)
  if (!sessionID) {
    api.ui.toast({ variant: "warning", message: "No current session" })
    return
  }

  await setArchived(api, sessionID, archived)
  api.ui.toast({
    variant: "success",
    message: archived ? "Session marked completed" : "Session restored",
  })
}

export default {
  id: "session-complete",
  tui: async (api) => {
    const dispose = api.command.register(() => [
      {
        title: "Switch session",
        description: "Open session picker with completed sessions after active sessions",
        category: "Session",
        value: "session.complete.list",
        keybind: "<leader>l",
        slash: { name: "completed-sessions", aliases: ["csessions"] },
        suggested: true,
        onSelect: () => openPicker(api),
      },
      {
        title: "Mark session completed",
        description: "Archive the current session so it drops below active sessions",
        category: "Session",
        value: "session.complete",
        slash: { name: "complete", aliases: ["done"] },
        onSelect: () => {
          void markCurrent(api, true).catch((error) =>
            api.ui.toast({
              variant: "error",
              title: "Complete failed",
              message: error instanceof Error ? error.message : String(error),
            }),
          )
        },
      },
      {
        title: "Restore session",
        description: "Unarchive the current session and return it to active sessions",
        category: "Session",
        value: "session.restore",
        slash: { name: "restore", aliases: ["uncomplete", "undone"] },
        onSelect: () => {
          void markCurrent(api, false).catch((error) =>
            api.ui.toast({
              variant: "error",
              title: "Restore failed",
              message: error instanceof Error ? error.message : String(error),
            }),
          )
        },
      },
    ])
    api.lifecycle.onDispose(dispose)
  },
} satisfies TuiPluginModule
