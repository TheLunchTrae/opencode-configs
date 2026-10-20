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
function configFacts(agent, config, global, entries) {
  const last = lastAssistant(entries, agent.name);
  const model = hasResponseData(agent.model) ? `${agent.model.providerID}/${agent.model.modelID}` : void 0;
  const facts = [
    { label: "Agent default (server-resolved)", value: model ?? "No agent model; OpenCode selects a fallback" },
    { label: "Configured variant", value: cleanOr(agent.variant, "Model default") },
    { label: "Workspace default (merged)", value: cleanOr(config.model, "OpenCode fallback") },
    {
      label: "Global file default",
      value: hasResponseData(global) ? cleanOr(global.model, "Not configured") : "Unavailable"
    },
    {
      label: "Last recorded model for this agent",
      value: last !== void 0 ? `${last.providerID}/${last.modelID}` : "No recorded turn in loaded history"
    },
    {
      label: "Last recorded variant",
      value: last !== void 0 ? cleanOr(last.variant, "Not recorded") : "No recorded turn"
    },
    {
      label: "Model source",
      value: model !== void 0 ? "Resolved agent configuration, including plugin changes" : "No agent pin. Session selection, workspace default, or provider fallback can apply."
    },
    { label: "Origin file", value: "V1 returns merged settings; exact file provenance is not exposed" }
  ];
  return facts.map((fact) => ({ label: fact.label, value: clean(fact.value, 800) }));
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

// src/session-tools/config.ts
var config_default = {
  id: "effective-config",
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires a Promise-returning TUI registration hook.
  tui: async (api) => {
    const view = ui(api);
    const open = async () => {
      const client = api.client;
      const sessionID = api.route.current.name === "session" ? currentSession(api) : void 0;
      const options = { signal: AbortSignal.any([api.lifecycle.signal, AbortSignal.timeout(15e3)]) };
      const [agents, config, global] = await Promise.all([
        client.app.agents({}, options),
        client.config.get({}, options),
        client.global.config.get(options)
      ]);
      const requestFailed = Boolean(agents.error) || Boolean(config.error);
      if (requestFailed || !hasResponseData(agents.data) || !hasResponseData(config.data)) {
        throw new Error("Configuration unavailable");
      }
      const effectiveConfig = config.data;
      let entries = [];
      if (sessionID !== void 0 && sessionID !== "") {
        entries = (await snapshot(api, sessionID)).entries;
      }
      const activeID = api.route.current.name === "session" ? currentSession(api) : void 0;
      if (api.lifecycle.signal.aborted || client !== api.client || sessionID !== activeID) {
        return;
      }
      view.menu(
        "Effective config: agent",
        agents.data.map((agent) => ({
          title: clean(agent.name),
          value: agent.name,
          description: clean(agent.description),
          category: agent.mode,
          run: () => {
            const facts = configFacts(agent, effectiveConfig, global.data, entries);
            view.menu(`Config: ${clean(agent.name)}`, [
              ...facts.map((fact, index) => ({
                title: fact.label,
                value: `fact:${index}`,
                description: fact.value,
                run: () => view.alert(fact.label, fact.value)
              })),
              {
                title: "Effective permission rules",
                value: "permissions",
                description: "Ordered runtime rules; saved session approvals can also apply",
                run: () => {
                  view.menu(
                    "Agent permission rules",
                    agent.permission.map((rule, index) => ({
                      title: `${clean(rule.permission)}: ${clean(rule.action)}`,
                      value: String(index),
                      description: clean(rule.pattern, 800),
                      run: () => view.alert(
                        "Permission rule",
                        `${clean(rule.permission)}
${clean(rule.pattern, 2e3)}
${clean(rule.action)}`
                      )
                    }))
                  );
                }
              },
              {
                title: "MCP connections",
                value: "mcp",
                description: "Names and status only",
                run: () => {
                  const items = api.state.mcp();
                  view.menu(
                    "MCP connections",
                    items.length > 0 ? items.map((item) => ({
                      title: clean(item.name),
                      value: item.name,
                      description: clean(item.status)
                    })) : [{ title: "No MCP connections reported", value: "empty" }]
                  );
                }
              },
              { title: "Refresh configuration", value: "refresh", run: open }
            ]);
          }
        })),
        true
      );
    };
    view.command("effective-config.open", "Inspect effective config", "inspect-config", "Config", open);
  }
};
export {
  config_default as default
};
