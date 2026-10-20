// src/session-tools/bookmarks.tsx
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { use as _$use } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { randomUUID } from "node:crypto";
import { onCleanup } from "solid-js";
import { useTerminalDimensions } from "@opentui/solid";

// src/session-tools/model.ts
var PanelError = class extends Error {
};
var stages = ["planning", "implementation", "review", "verification", "blocked", "complete"];
var historyLimit = 200;
function record(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasResponseData(value) {
  return Boolean(value);
}
function clean(value, limit = 400) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "").slice(0, limit);
}
function ordered(entries) {
  return [...entries].sort((a, b) => {
    const difference = a.info.time.created - b.info.time.created;
    return difference !== 0 && !Number.isNaN(difference) ? difference : a.info.id.localeCompare(b.info.id);
  });
}
function isStage(value) {
  return stages.some((stage) => stage === value);
}
function stageReport(entries) {
  let report;
  for (const entry of ordered(entries)) {
    if (entry.info.role !== "assistant") {
      continue;
    }
    for (const part of entry.parts) {
      if (part.type !== "tool" || part.tool !== "workflow_status" || part.state.status !== "completed") {
        continue;
      }
      const data = part.state.metadata.workflowPanel;
      if (!record(data) || data.version !== 1 || !isStage(data.stage) || typeof data.summary !== "string" || data.agent !== entry.info.agent) {
        continue;
      }
      report = {
        stage: data.stage,
        summary: clean(data.summary),
        agent: clean(data.agent),
        messageID: entry.info.id,
        time: part.state.time.end
      };
    }
  }
  return report;
}
var bookmarkKinds = ["Note", "Plan", "Decision", "Question"];
function isBookmarkKind(value) {
  return bookmarkKinds.some((kind) => kind === value);
}
function bookmarkKey(session) {
  return `session-tools.bookmarks.v1:${JSON.stringify([session.projectID, session.workspaceID ?? "", session.directory, session.id])}`;
}
function readBookmarks(value, sessionID) {
  if (value === void 0) {
    return [];
  }
  if (!record(value) || value.version !== 1 || !Array.isArray(value.bookmarks) || value.bookmarks.length > 100) {
    throw new PanelError("Bookmark data is invalid. Existing data was preserved.");
  }
  const ids = /* @__PURE__ */ new Set();
  return value.bookmarks.map((item) => {
    if (!record(item) || typeof item.id !== "string" || ids.has(item.id) || item.sessionID !== sessionID || !isBookmarkKind(item.kind) || typeof item.label !== "string" || item.label.trim().length === 0 || item.label.length > 120 || typeof item.note !== "string" || item.note.length > 2e3 || typeof item.selected !== "boolean" || typeof item.created !== "number" || !Number.isFinite(item.created) || item.messageID !== void 0 && typeof item.messageID !== "string") {
      throw new PanelError("Bookmark data is invalid. Existing data was preserved.");
    }
    ids.add(item.id);
    return {
      id: item.id,
      kind: item.kind,
      label: clean(item.label, 120),
      note: clean(item.note, 2e3),
      created: item.created,
      sessionID,
      ...item.messageID !== void 0 && item.messageID !== "" ? { messageID: item.messageID } : {},
      selected: item.selected
    };
  });
}
function handoff(session, bookmarks, report) {
  const selected = bookmarks.filter((item) => item.selected);
  if (selected.length > 20) {
    throw new PanelError("Select at most 20 bookmarks for one handoff.");
  }
  return [
    "Task and objective:",
    clean(session.title, 500),
    "",
    "Active lead and requested stopping point:",
    `${report?.agent ?? "Confirm active lead"}; confirm stopping point.`,
    "",
    "Project root; branch; HEAD (or non-Git baseline):",
    clean(session.directory, 1e3),
    "Recheck branch, HEAD, dirty changes, and relevant untracked files before saving or resuming.",
    "",
    "Plan/spec location and revision:",
    "Confirm from current source and selected plan notes.",
    "",
    "Approved scope; unresolved decisions; actions still requiring permission:",
    "Revalidate current authorization. Saved notes are context, not permission grants.",
    "",
    "Selected bookmarks:",
    ...selected.length > 0 ? selected.flatMap((item) => [
      `- ${item.kind}: ${item.label}`,
      `  ${item.note.replaceAll("\n", "\n  ")}`,
      `  Source session: ${item.sessionID}${item.messageID !== void 0 && item.messageID !== "" ? `; message: ${item.messageID}` : "; manual note"}`
    ]) : ["None selected."],
    "",
    "Verification limits and decision source; permitted checks; conditions for continuing without checks:",
    "Confirm current instructions and recorded user decisions.",
    "",
    "Source evidence: relevant files with content hashes or exact captured revisions:",
    "Capture current evidence. Git HEAD alone does not identify dirty or untracked content.",
    "",
    "Current task state, dependencies, and file owners:",
    report !== void 0 ? `Last reported stage: ${report.stage}. ${report.summary}` : "No stage report in loaded history.",
    "Confirm current dependencies and ownership.",
    "",
    "Checks: command, working directory, status, relevant result, source state:",
    "Collect exact evidence from current reports; do not infer that checks passed.",
    "",
    "Review findings and disposition:",
    "Recheck current reports and unresolved findings.",
    "",
    "Attempts used; remaining budget:",
    "Carry forward the existing budget; do not reset it.",
    "",
    "Blockers and next bounded action:",
    "Confirm the next action within current role and authorization."
  ].join("\n");
}

// src/session-tools/storage.ts
function bookmarkStore(api, data) {
  const key = bookmarkKey(data.session);
  const read = () => {
    if (!api.kv.ready) {
      throw new PanelError("Bookmark storage is still loading. Try again shortly.");
    }
    return readBookmarks(api.kv.get(key), data.session.id);
  };
  const write = (change) => {
    const next = change(read());
    const payload = { version: 1, bookmarks: next };
    readBookmarks(payload, data.session.id);
    api.kv.set(key, payload);
  };
  return { read, write };
}

// src/tui/navigation.ts
var backValue = "\0back";
function dialogNavigation(api, decoration) {
  let frames = [];
  let revision = 0;
  let replacing = false;
  const reset = () => {
    frames = [];
    revision++;
  };
  api.lifecycle.signal.addEventListener("abort", reset, { once: true });
  const display = (render) => {
    if (api.lifecycle.signal.aborted) {
      return;
    }
    const client = api.client;
    const route = api.route.current;
    const sessionID = route.name === "session" ? route.params?.sessionID : void 0;
    const active = ++revision;
    replacing = true;
    try {
      api.ui.dialog.replace(render, () => {
        if (replacing || active !== revision) {
          return;
        }
        frames.pop();
        const parent = frames.at(-1);
        const closed = ++revision;
        queueMicrotask(() => {
          if (closed !== revision) {
            return;
          }
          const current = api.route.current;
          if (api.lifecycle.signal.aborted || client !== api.client || api.ui.dialog.open || current.name !== route.name || current.name === "session" && current.params?.sessionID !== sessionID) {
            reset();
            return;
          }
          if (parent !== void 0) {
            display(parent);
          }
        });
      });
    } finally {
      replacing = false;
    }
  };
  const show = (render, root = false) => {
    if (api.lifecycle.signal.aborted) {
      return;
    }
    if (root) {
      reset();
    }
    frames.push(render);
    display(render);
  };
  const close = () => {
    reset();
    api.ui.dialog.clear();
  };
  const back = () => {
    if (frames.length < 2) {
      close();
      return;
    }
    frames.pop();
    const parent = frames.at(-1);
    if (parent !== void 0) {
      display(parent);
    }
  };
  const decorate = (element) => decoration !== void 0 ? decoration(element, close) : element;
  const select = (props) => {
    let selected = props.current;
    return () => decorate(
      api.ui.DialogSelect({
        ...props,
        get current() {
          return selected;
        },
        get options() {
          return frames.length > 1 ? [
            ...props.options,
            {
              title: "\u2190 Back",
              value: backValue,
              description: "Return to the previous view",
              category: "Navigation",
              footer: "esc"
            }
          ] : props.options;
        },
        onMove: (option) => {
          if (option.value !== backValue) {
            selected = option.value;
          }
          props.onMove?.(option);
        },
        onSelect: (option) => {
          if (option.value === backValue) {
            back();
            return;
          }
          selected = option.value;
          return props.onSelect?.(option);
        }
      })
    );
  };
  const menu = (props, root = false) => show(select(props), root);
  const alert = (props) => show(() => decorate(api.ui.DialogAlert(props)));
  const confirm = (props) => show(() => decorate(api.ui.DialogConfirm(props)));
  const prompt = (props) => {
    let value = props.value;
    show(
      () => decorate(
        api.ui.DialogPrompt({
          ...props,
          value,
          onConfirm: (text) => {
            value = text;
            return props.onConfirm?.(text);
          }
        })
      )
    );
  };
  return {
    show,
    menu,
    select,
    alert,
    prompt,
    confirm,
    back,
    refresh: () => {
      const current = frames.at(-1);
      if (current !== void 0) {
        display(current);
      }
    },
    close,
    reset,
    get canGoBack() {
      return frames.length > 1;
    }
  };
}

// src/session-tools/client.ts
function currentSession(api) {
  const route = api.route.current;
  const id = route.name === "session" ? route.params?.sessionID : void 0;
  if (typeof id !== "string") {
    throw new PanelError("Open a session before using this panel.");
  }
  return id;
}
async function snapshot(api, sessionID, signal = api.lifecycle.signal) {
  const client = api.client;
  const options = { signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15e3)]) };
  const [session, messages] = await Promise.all([
    client.session.get({ sessionID }, options),
    client.session.messages({ sessionID, limit: historyLimit }, options)
  ]);
  const requestFailed = Boolean(session.error) || Boolean(messages.error);
  if (requestFailed || !hasResponseData(session.data) || !hasResponseData(messages.data)) {
    throw new PanelError("Could not read this session. It may have been deleted or the server is unavailable.");
  }
  return { session: session.data, entries: messages.data, limited: messages.data.length >= historyLimit };
}
function ui(api, decoration) {
  const navigation = dialogNavigation(api, decoration);
  const run = (action) => {
    const client = api.client;
    return Promise.resolve().then(() => {
      if (api.lifecycle.signal.aborted || client !== api.client) {
        return;
      }
      return action();
    }).catch((error) => {
      if (api.lifecycle.signal.aborted || client !== api.client) {
        return;
      }
      try {
        api.ui.toast({
          title: "Session tools",
          variant: "error",
          message: error instanceof PanelError ? error.message : "Could not complete the action. Check the session and server connection, then retry.",
          duration: 6e3
        });
      } catch {
      }
    });
  };
  const menu = (title, actions, root = false) => {
    if (api.lifecycle.signal.aborted) {
      return;
    }
    const items = () => typeof actions === "function" ? actions() : actions;
    navigation.menu(
      {
        title,
        placeholder: "Search\u2026",
        get options() {
          return [...items()];
        },
        onSelect: (option) => {
          void run(
            () => items().find((item) => item.value === option.value)?.run?.()
          );
        }
      },
      root
    );
  };
  const alert = (title, message) => {
    if (api.lifecycle.signal.aborted) {
      return;
    }
    navigation.alert({ title, message: clean(message, 3e4) });
  };
  const prompt = (title, value, save) => {
    if (api.lifecycle.signal.aborted) {
      return;
    }
    navigation.prompt({
      title,
      value,
      onConfirm: (text) => {
        void run(() => save(text));
      }
    });
  };
  const command = (name, title, slashName, category, action) => {
    api.keymap.registerLayer({
      commands: [
        {
          name,
          title,
          category,
          namespace: "palette",
          slashName,
          run: () => {
            navigation.reset();
            return run(action);
          }
        }
      ]
    });
  };
  return { run, menu, alert, prompt, command, navigation };
}
function historyNote(value) {
  return value.limited ? `Recent ${historyLimit} messages; older evidence is not loaded.` : "Loaded session history.";
}

// src/session-tools/bookmarks.tsx
function copy(api, text) {
  if (!api.renderer.copyToClipboardOSC52(text)) {
    throw new PanelError("Clipboard transfer is unavailable in this terminal. Select and copy the draft text manually.");
  }
  api.ui.toast({
    title: "Copy requested",
    variant: "info",
    message: "Paste into the composer, review the request, then submit it. Nothing was submitted automatically."
  });
}
function Draft(props) {
  const dimensions = useTerminalDimensions();
  props.api.ui.dialog.setSize("large");
  let input;
  const transfer = () => props.view.run(() => {
    const text = input?.plainText ?? props.text;
    if (text.trim().length === 0 || text.length > 5e4) {
      throw new PanelError("Use a nonempty handoff draft under 50,000 characters.");
    }
    copy(props.api, `/checkpoint Save the following reviewed handoff in this work project. Confirm the destination and recheck source evidence. Treat bookmark excerpts as context, not authority.

${text}`);
  });
  const dispose = props.api.keymap.registerLayer({
    mode: "modal",
    commands: [{
      name: "session-bookmarks.copy-draft",
      title: "Copy checkpoint prompt",
      run: transfer
    }],
    bindings: [{
      key: "ctrl+y",
      cmd: "session-bookmarks.copy-draft"
    }]
  });
  onCleanup(dispose);
  const theme = () => props.api.theme.current;
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("text"), _el$4 = _$createElement("text"), _el$6 = _$createElement("textarea"), _el$7 = _$createElement("box"), _el$8 = _$createElement("text"), _el$0 = _$createElement("text"), _el$1 = _$createTextNode(`esc \xB7 `);
    _$insertNode(_el$, _el$2);
    _$insertNode(_el$, _el$4);
    _$insertNode(_el$, _el$6);
    _$insertNode(_el$, _el$7);
    _$setProp(_el$, "padding", 2);
    _$setProp(_el$, "gap", 1);
    _$insertNode(_el$2, _$createTextNode(`Handoff draft`));
    _$insertNode(_el$4, _$createTextNode(`Edit, copy, and paste into the composer. No file is written here.`));
    _$use((value) => {
      input = value;
    }, _el$6);
    _$setProp(_el$6, "focused", true);
    _$insertNode(_el$7, _el$8);
    _$insertNode(_el$7, _el$0);
    _$setProp(_el$7, "flexDirection", "row");
    _$setProp(_el$7, "gap", 2);
    _$insertNode(_el$8, _$createTextNode(`ctrl+y \xB7 copy checkpoint prompt`));
    _$setProp(_el$8, "onMouseUp", () => {
      void transfer();
    });
    _$insertNode(_el$0, _el$1);
    _$insert(_el$0, () => props.view.navigation.canGoBack ? "back" : "close", null);
    _$effect((_p$) => {
      var _v$ = theme().primary, _v$2 = theme().textMuted, _v$3 = Math.max(3, Math.min(16, Math.floor(dimensions().height * 0.75) - 12)), _v$4 = props.text, _v$5 = theme().text, _v$6 = theme().text, _v$7 = theme().backgroundPanel, _v$8 = theme().primary, _v$9 = theme().textMuted, _v$0 = props.view.navigation.back;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$2, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$4, "fg", _v$2, _p$.t));
      _v$3 !== _p$.a && (_p$.a = _$setProp(_el$6, "height", _v$3, _p$.a));
      _v$4 !== _p$.o && (_p$.o = _$setProp(_el$6, "initialValue", _v$4, _p$.o));
      _v$5 !== _p$.i && (_p$.i = _$setProp(_el$6, "textColor", _v$5, _p$.i));
      _v$6 !== _p$.n && (_p$.n = _$setProp(_el$6, "focusedTextColor", _v$6, _p$.n));
      _v$7 !== _p$.s && (_p$.s = _$setProp(_el$6, "backgroundColor", _v$7, _p$.s));
      _v$8 !== _p$.h && (_p$.h = _$setProp(_el$8, "fg", _v$8, _p$.h));
      _v$9 !== _p$.r && (_p$.r = _$setProp(_el$0, "fg", _v$9, _p$.r));
      _v$0 !== _p$.d && (_p$.d = _$setProp(_el$0, "onMouseUp", _v$0, _p$.d));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0,
      n: void 0,
      s: void 0,
      h: void 0,
      r: void 0,
      d: void 0
    });
    return _el$;
  })();
}
var bookmarks_default = {
  id: "session-bookmarks",
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires Promise-returning TUI initialization hooks.
  tui: async (api) => {
    const view = ui(api);
    const source = async () => {
      const id = currentSession(api);
      const client = api.client;
      const data = await snapshot(api, id);
      if (api.lifecycle.signal.aborted || client !== api.client || currentSession(api) !== id) {
        throw new PanelError("The active session changed. Reopen bookmarks.");
      }
      return data;
    };
    const draft = async () => {
      const data = await source();
      const text = handoff(data.session, bookmarkStore(api, data).read(), stageReport(data.entries));
      view.navigation.show(() => _$createComponent(Draft, {
        api,
        text,
        view
      }));
    };
    const add = (data, note = "", messageID) => {
      view.menu("Bookmark type", bookmarkKinds.map((kind) => ({
        title: kind,
        value: kind,
        run: () => {
          view.prompt("Bookmark label", "", (label) => {
            if (label.trim().length === 0 || label.length > 120) {
              throw new PanelError("Use a label of 1\u2013120 characters.");
            }
            view.prompt("Bookmark note or excerpt", clean(note, 2e3), (text) => {
              if (text.length > 2e3) {
                throw new PanelError("Keep bookmark notes under 2,000 characters.");
              }
              bookmarkStore(api, data).write((current) => {
                if (current.length >= 100) {
                  throw new PanelError("This session already has 100 bookmarks. Remove one before adding more.");
                }
                return [...current, {
                  id: randomUUID(),
                  kind,
                  label: clean(label.trim(), 120),
                  note: clean(text, 2e3),
                  created: Date.now(),
                  sessionID: data.session.id,
                  messageID,
                  selected: true
                }];
              });
              return open();
            });
          });
        }
      })));
    };
    const chooseSource = async () => {
      const data = await source();
      const messages = ordered(data.entries).reverse().flatMap((entry) => {
        const text = entry.parts.filter((part) => part.type === "text" && part.ignored !== true && part.synthetic !== true).map((part) => part.type === "text" ? part.text : "").join("\n");
        if (text.trim().length === 0) {
          return [];
        }
        return [{
          title: `${entry.info.role} \xB7 ${new Date(entry.info.time.created).toLocaleTimeString()}`,
          value: entry.info.id,
          description: clean(text, 160).replaceAll("\n", " "),
          run: () => add(data, text, entry.info.id)
        }];
      });
      view.menu("Bookmark a message or note", [{
        title: "New manual note",
        value: "manual",
        description: historyNote(data),
        run: () => add(data)
      }, ...messages]);
    };
    const inspect = (data, mark) => {
      const store = bookmarkStore(api, data);
      const change = (update) => {
        store.write((items) => {
          if (!items.some((item) => item.id === mark.id)) {
            throw new PanelError("This bookmark was removed. Reopen the list.");
          }
          return items.map((item) => item.id === mark.id ? {
            ...item,
            ...update
          } : item);
        });
        return open();
      };
      view.menu(mark.label, [{
        title: mark.selected ? "Exclude from handoff" : "Include in handoff",
        value: "select",
        run: () => change({
          selected: !mark.selected
        })
      }, {
        title: "View note",
        value: "note",
        description: mark.note,
        run: () => view.alert(mark.label, `${mark.note}

Source: ${mark.sessionID}` + (mark.messageID !== void 0 && mark.messageID.length > 0 ? ` / ${mark.messageID}` : " / manual note"))
      }, {
        title: "Edit label",
        value: "label",
        run: () => view.prompt("Bookmark label", mark.label, (text) => {
          if (text.trim().length === 0 || text.length > 120) {
            throw new PanelError("Use a label of 1\u2013120 characters.");
          }
          return change({
            label: clean(text.trim(), 120)
          });
        })
      }, {
        title: "Edit note",
        value: "edit",
        run: () => view.prompt("Bookmark note", mark.note, (text) => {
          if (text.length > 2e3) {
            throw new PanelError("Keep bookmark notes under 2,000 characters.");
          }
          return change({
            note: clean(text, 2e3)
          });
        })
      }, {
        title: "Open source session",
        value: "source",
        description: mark.messageID ?? "Manual note",
        run: async () => {
          const client = api.client;
          if (mark.messageID !== void 0 && mark.messageID.length > 0) {
            const result = await client.session.message({
              sessionID: mark.sessionID,
              messageID: mark.messageID
            }, {
              signal: AbortSignal.any([api.lifecycle.signal, AbortSignal.timeout(15e3)])
            });
            const sourceAvailable = Boolean(result.data);
            if (Boolean(result.error) || !sourceAvailable) {
              throw new PanelError("The source message could not be read. The saved bookmark was preserved.");
            }
          }
          if (api.lifecycle.signal.aborted || client !== api.client) {
            return;
          }
          view.navigation.close();
          api.route.navigate("session", {
            sessionID: mark.sessionID
          });
        }
      }, {
        title: "Remove bookmark\u2026",
        value: "remove",
        run: () => {
          view.navigation.confirm({
            title: "Remove this bookmark?",
            message: mark.label,
            onConfirm: () => {
              void view.run(() => {
                store.write((items) => items.filter((item) => item.id !== mark.id));
                return open();
              });
            }
          });
        }
      }]);
    };
    const open = async () => {
      const data = await source();
      const marks = bookmarkStore(api, data).read();
      view.menu(`Bookmarks: ${marks.length} \xB7 ${marks.filter((mark) => mark.selected).length} selected`, [{
        title: "Add bookmark",
        value: "add",
        run: chooseSource
      }, {
        title: "Build editable handoff draft",
        value: "draft",
        description: "Uses selected bookmarks; no file is saved",
        run: draft
      }, {
        title: "Prepare resume request",
        value: "resume",
        description: "Copy /resume-work for an existing handoff",
        run: () => {
          view.prompt("Work-project handoff path", "", (path) => {
            if (path.trim().length === 0 || path.length > 1e3 || /[\r\n]/.test(path)) {
              throw new PanelError("Enter one handoff path.");
            }
            copy(api, `/resume-work ${clean(path.trim(), 1e3)}`);
          });
        }
      }, ...marks.map((mark) => ({
        title: `${mark.selected ? "[x]" : "[ ]"} ${mark.label}`,
        value: mark.id,
        category: mark.kind,
        description: clean(mark.note, 160),
        run: () => inspect(data, mark)
      }))], true);
    };
    view.command("session-bookmarks.open", "Session bookmarks", "bookmarks", "Session", open);
    view.command("session-bookmarks.add", "Bookmark a message or note", "bookmark", "Session", chooseSource);
    view.command("session-bookmarks.handoff", "Build session handoff", "session-handoff", "Session", draft);
  }
};
export {
  bookmarks_default as default
};
