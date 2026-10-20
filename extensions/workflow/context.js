// src/session-tools/model.ts
var PanelError = class extends Error {
};
var historyLimit = 200;
function hasResponseData(value) {
  return Boolean(value);
}
function clean(value, limit = 400) {
  if (typeof value !== "string") {
    return "";
  }
  return value.replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\)/g, "").replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "").slice(0, limit);
}
function cleanOr(value, fallback) {
  const text = clean(value);
  return text.length > 0 ? text : fallback;
}
function nonzero(value) {
  const number = value ?? 0;
  return number !== 0 && !Number.isNaN(number);
}
function ordered(entries) {
  return [...entries].sort((a, b) => {
    const difference = a.info.time.created - b.info.time.created;
    return difference !== 0 && !Number.isNaN(difference) ? difference : a.info.id.localeCompare(b.info.id);
  });
}
function lastAssistant(entries, agent) {
  return ordered(entries).map((entry) => entry.info).findLast(
    (info) => info.role === "assistant" && (agent === void 0 || agent === "" || info.agent === agent)
  );
}
function contextRecords(entries) {
  const result = [];
  for (const entry of ordered(entries)) {
    for (const part of entry.parts) {
      const source = { messageID: entry.info.id };
      if (part.type === "file") {
        result.push({
          ...source,
          kind: "file",
          label: cleanOr(part.filename, "Unnamed attachment"),
          evidence: "Attachment recorded in history"
        });
      }
      if (part.type === "compaction") {
        result.push({
          ...source,
          kind: "compaction",
          label: part.auto ? "Automatic compaction requested" : "Manual compaction requested",
          evidence: "Request recorded; history presence does not prove current prompt inclusion"
        });
      }
      if (entry.info.role === "assistant" && entry.info.summary === true && part.type === "text") {
        if (!result.some((item) => item.kind === "compaction" && item.messageID === entry.info.id)) {
          result.push({
            ...source,
            kind: "compaction",
            label: "Summary recorded",
            evidence: nonzero(entry.info.time.completed) ? "Summary response completed" : "Summary response in progress"
          });
        }
      }
      if (part.type !== "tool" || part.state.status !== "completed") {
        continue;
      }
      if (part.tool === "read") {
        result.push({
          ...source,
          kind: "file",
          label: cleanOr(part.state.input.filePath ?? part.state.input.path, "Read target unavailable"),
          evidence: nonzero(part.state.time.compacted) ? "Read completed; tool output later compacted" : "Read tool completed"
        });
      }
      if (part.tool === "skill") {
        result.push({
          ...source,
          kind: "skill",
          label: cleanOr(part.state.input.name, "Skill name unavailable"),
          evidence: "Skill tool completed"
        });
      }
    }
  }
  return result;
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

// src/session-tools/context.ts
var context_default = {
  id: "context-inspector",
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning TUI registration hook.
  tui: async (api) => {
    const view = ui(api);
    const open = async () => {
      const sessionID = currentSession(api);
      const client = api.client;
      const data = await snapshot(api, sessionID);
      if (api.lifecycle.signal.aborted || client !== api.client || currentSession(api) !== sessionID) {
        return;
      }
      const last = lastAssistant(
        data.entries.filter((entry) => {
          if (entry.info.role !== "assistant" || entry.info.time.completed === void 0) {
            return false;
          }
          const failed = Boolean(entry.info.error);
          return !failed;
        })
      );
      const records = contextRecords(data.entries);
      const show = (kind) => {
        const items = records.filter((item) => item.kind === kind);
        view.menu(
          `${kind}: ${items.length} records`,
          items.length > 0 ? items.map((item, index) => ({
            title: item.label,
            value: String(index),
            description: item.evidence,
            run: () => view.alert(
              item.label,
              `${item.evidence}
Message: ${item.messageID}
This record does not establish inclusion in the current model request.`
            )
          })) : [{ title: "No records in loaded history", value: "empty" }]
        );
      };
      const token = (value) => value === void 0 ? "Not reported" : value.toLocaleString();
      view.menu(
        "Context inspector",
        [
          {
            title: "Latest completed request",
            value: "usage",
            description: last !== void 0 ? `${token(last.tokens.input)} input \xB7 ${token(last.tokens.output)} output` : "No completed assistant request recorded",
            run: () => view.alert(
              "Reported usage",
              last !== void 0 ? `${clean(last.providerID)}/${clean(last.modelID)}
Input: ${token(last.tokens.input)}
Output: ${token(last.tokens.output)}
Reasoning: ${token(last.tokens.reasoning)}
Cache reads: ${token(last.tokens.cache.read)}
Cache writes: ${token(last.tokens.cache.write)}

Fields follow provider accounting. They are not added together here.` : "No completed assistant request is recorded in the loaded history."
            )
          },
          { title: "Files and attachments", value: "files", run: () => show("file") },
          { title: "Recorded skill loads", value: "skills", run: () => show("skill") },
          { title: "Compaction records", value: "compaction", run: () => show("compaction") },
          {
            title: "Limits of this view",
            value: "limits",
            description: historyNote(data),
            run: () => view.alert(
              "Context evidence",
              `${historyNote(data)}

The exact assembled prompt and tokens per file are not exposed. Available skills are not assumed loaded. Old file reads and attachments may no longer be in context after compaction. Tool outputs are not copied here.`
            )
          },
          { title: "Refresh", value: "refresh", run: open }
        ],
        true
      );
    };
    view.command("context-inspector.open", "Inspect session context", "inspect-context", "Session", open);
  }
};
export {
  context_default as default
};
