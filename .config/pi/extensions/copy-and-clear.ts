import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { TuiAltScreen, ScrollView, type TUI } from "@earendil-works/pi-tui";


export default function copyAndClear(pi: ExtensionAPI) {
    pi.on("session_start", (_event, ctx) => {
        if (ctx.mode !== "tui") return;

        ctx.ui.setWidget("copy-and-clear-probe", (tui) => {
            if (!checkVersion(tui)) {
                return { render: () => ["Copy-and-clear: incompatible Pi version"], invalidate() { }, };
            }

            const prototype = TuiAltScreen.prototype;
            const originalCopy: unknown = Reflect.get(prototype, "copySelectionToClipboard");

            if (typeof originalCopy !== "function") {
                return { render: () => ["Copy-and-clear: incompatible Pi copy hook"], invalidate() { }, };
            }

            let disposed = false;

            async function copyAndClearSelection(this: TuiAltScreen,): Promise<boolean> {
                const before = readSelectionState(this);
                const copied = await this.copyActiveSelectionToClipboard();

                if (copied) {
                    // This makes it feel natural, otherwise it is too fast
                    await new Promise<void>((resolve) => setTimeout(resolve, 70));
                }

                if (disposed) return copied;

                const after = readSelectionState(this);
                if (copied && !after.pressActive && after.anchor === before.anchor && after.focus === before.focus) {
                    this.resetTextSelection();
                    this.requestRender();
                }
                return copied;
            }

            if (!Reflect.set(prototype, "copySelectionToClipboard", copyAndClearSelection)) {
                return { render: () => ["Copy-and-clear: could not install copy hook"], invalidate() { }, };
            }

            return {
                render: () => [],
                invalidate() { },
                dispose() {
                    disposed = true;

                    if (Reflect.get(prototype, "copySelectionToClipboard") === copyAndClearSelection) {
                        Reflect.set(prototype, "copySelectionToClipboard", originalCopy,);
                    }
                },
            };
        });
    });
}

// Checks required capabilities, not a numeric Pi version.
function checkVersion(tui: TUI): boolean {
    const copyHook: unknown = Reflect.get(tui, "copySelectionToClipboard");
    const resetSelection: unknown = Reflect.get(tui, "resetTextSelection");

    return (
        typeof copyHook === "function" &&
        typeof resetSelection === "function" &&
        typeof tui.requestRender === "function"
    );
}

type SelectionState = {
    anchor: SelectionPoint | undefined;
    focus: SelectionPoint | undefined;
    pressActive: boolean;
};

// HACK: Mirrors Pi's non-exported SelectionPoint interface.
type SelectionPoint = { row: number; col: number; scrollView?: ScrollView; boundary?: boolean; };

function readSelectionState(tui: TuiAltScreen): SelectionState {
    const anchor: unknown = Reflect.get(tui, "selectionAnchor");
    const focus: unknown = Reflect.get(tui, "selectionFocus");
    const pressActive: unknown = Reflect.get(tui, "selectionPressActive");

    if (
        !isSelectionPoint(anchor) ||
        !isSelectionPoint(focus) ||
        typeof pressActive !== "boolean"
    ) {
        throw new Error("Copy-and-clear: incompatible Pi selection state");
    }

    return { anchor, focus, pressActive };
}

function isSelectionPoint(
    value: unknown,
): value is SelectionPoint | undefined {
    if (value === undefined) return true;
    if (typeof value !== "object" || value === null) return false;

    return (
        "row" in value &&
        typeof value.row === "number" &&
        "col" in value &&
        typeof value.col === "number" &&
        (
            !("scrollView" in value) ||
            value.scrollView === undefined ||
            value.scrollView instanceof ScrollView
        ) &&
        (
            !("boundary" in value) ||
            value.boundary === undefined ||
            typeof value.boundary === "boolean"
        )
    );
}

