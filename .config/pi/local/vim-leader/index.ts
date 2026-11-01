import type {
    ExtensionAPI,
    ExtensionContext,
} from "@earendil-works/pi-coding-agent";
import { matchesKey } from "@earendil-works/pi-tui";

export default function vimLeader(pi: ExtensionAPI) {
    // settings.json loads this extension after pi-vim.
    pi.on("session_start", (_event, ctx) => {
        installLeader(ctx);
    });


    pi.registerCommand("leader-check", {
        description: "Activate Vim leader mappings",
        handler: async (_args, ctx) => {
            installLeader(ctx);
        },
    });
}

const installedLeaderFactories = new WeakSet<object>();

function installLeader(ctx: ExtensionContext): void {
    if (ctx.mode !== "tui") return;
    const factory = ctx.ui.getEditorComponent();

    if (!factory) {
        ctx.ui.notify("vim-leader: no custom editor factory.", "warning");
        return;
    }

    if (installedLeaderFactories.has(factory)) { return; }

    ctx.ui.setEditorComponent((tui, theme, keybindings) => {
        const editor = factory(tui, theme, keybindings);
        const candidate = editor as typeof editor & {
            getMode?: () => string;
        };

        // Version-specific adapter for pi-vim 0.14.2.
        // Missing or changed fields fail closed: leader stays disabled.
        const state = editor as unknown as Record<string, unknown>;

        // - npm/node_modules/pi-vim/index.ts:265–274 — pending command state.
        // Without these checks, Space could break f<Space>, r<Space>, or :model ….
        // - npm/node_modules/pi-vim/index.ts:279–280 — Normal-mode paste state.
        // - npm/node_modules/pi-vim/index.ts:286 — dot-repeat replay state.
        const canStartLeader = (): boolean =>
            candidate.getMode?.() === "normal" &&
            state.pendingExCommand === null &&
            state.pendingMotion === null &&
            state.pendingTextObject === null &&
            state.pendingOperator === null &&
            state.pendingReplace === false &&
            state.pendingG === false &&
            state.prefixCount === "" &&
            state.operatorCount === "" &&
            state.discardingBracketedPasteInNormalMode === false &&
            state.pendingEscWhileDiscardingBracketedPasteInNormalMode === false &&
            state.replayingRepeat === false;

        const originalHandleInput = editor.handleInput.bind(editor);
        let leaderPending = false;

        editor.handleInput = (data: string): void => {
            if (leaderPending) {
                leaderPending = false;
                ctx.ui.setStatus("vim-leader", undefined);

                // If editing state changed, don't capture this input.
                if (!canStartLeader()) {
                    originalHandleInput(data);
                    return;
                }

                // Cancel only the leader sequence, not the agent.
                if (matchesKey(data, "escape")) return;

                const mappings = [
                    { key: "r", command: "resume" },
                    { key: "t", command: "tree" },
                    { key: "m", command: "model" },
                    { key: "ctrl+r", command: "reload" },
                ] as const;

                const mapping = mappings.find(({ key }) =>
                    matchesKey(data, key),
                );

                if (mapping) {
                    for (const key of `:${mapping.command}`) {
                        originalHandleInput(key);
                    }
                    originalHandleInput("\r");
                    return;
                }

                // Unknown sequences retain normal editor behavior.
                originalHandleInput(data);
                return;
            }

            if (canStartLeader() && matchesKey(data, "space")) {
                leaderPending = true;
                ctx.ui.setStatus("vim-leader", "Space → r");
                return;
            }

            originalHandleInput(data);
        };

        return editor;
    });

    const installedFactory = ctx.ui.getEditorComponent();
    if (installedFactory) {
        installedLeaderFactories.add(installedFactory);
    }
}
