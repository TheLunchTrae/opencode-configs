// src/session-tools/workflow.tsx
import { effect as _$effect2 } from "@opentui/solid";
import { createTextNode as _$createTextNode2 } from "@opentui/solid";
import { insertNode as _$insertNode2 } from "@opentui/solid";
import { insert as _$insert2 } from "@opentui/solid";
import { memo as _$memo } from "@opentui/solid";
import { setProp as _$setProp2 } from "@opentui/solid";
import { createElement as _$createElement2 } from "@opentui/solid";
import { createComponent as _$createComponent2 } from "@opentui/solid";
import { For, Show as Show2, createEffect, createSignal as createSignal2, onCleanup as onCleanup2 } from "solid-js";

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
function activity(status, questions, permissions) {
  if (nonzero(questions)) {
    return "Question waiting";
  }
  if (nonzero(permissions)) {
    return "Permission waiting";
  }
  if (status?.type === "busy") {
    return "Running";
  }
  if (status?.type === "retry") {
    return `Retry ${status.attempt}`;
  }
  return status?.type === "idle" ? "Idle" : "Status unavailable";
}
function delegations(entries) {
  const found = /* @__PURE__ */ new Map();
  for (const entry of ordered(entries)) {
    for (const part of entry.parts) {
      if (part.type !== "tool" || part.tool !== "task" || part.state.status === "pending") {
        continue;
      }
      const metadata = part.state.metadata;
      if (!record(metadata) || typeof metadata.sessionId !== "string") {
        continue;
      }
      const state = part.state;
      found.set(metadata.sessionId, {
        sessionID: metadata.sessionId,
        agent: cleanOr(state.input.subagent_type, "Subagent"),
        description: cleanOr(state.input.description, "Delegated task"),
        state: state.status,
        duration: state.status === "completed" || state.status === "error" ? Math.max(0, state.time.end - state.time.start) : void 0
      });
    }
  }
  return [...found.values()];
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

// src/session-tools/workflow-timeline.ts
function compareEvents(a, b) {
  const time = a.time - b.time;
  if (time !== 0) {
    return time;
  }
  const message = a.messageID.localeCompare(b.messageID);
  return message !== 0 ? message : a.partID.localeCompare(b.partID);
}
function timelineEvents(sessionID, entries) {
  const events = [];
  for (const entry of ordered(entries)) {
    if (entry.info.role !== "assistant") {
      continue;
    }
    for (const part of entry.parts) {
      if (part.type !== "tool" || part.state.status === "pending") {
        continue;
      }
      const state = part.state;
      if (part.tool === "workflow_status" && state.status === "completed") {
        const data = state.metadata.workflowPanel;
        if (record(data) && data.version === 1 && stages.some((stage) => stage === data.stage) && typeof data.summary === "string" && data.agent === entry.info.agent && Number.isFinite(state.time.end)) {
          const stage = stages.find((value) => value === data.stage);
          if (stage !== void 0) {
            events.push({
              kind: "report",
              time: state.time.end,
              messageID: entry.info.id,
              partID: part.id,
              stage,
              summary: clean(data.summary)
            });
          }
        }
      }
      const metadata = state.metadata;
      if (part.tool !== "task" || !record(metadata) || typeof metadata.sessionId !== "string" || metadata.sessionId.length === 0 || !Number.isFinite(state.time.start)) {
        continue;
      }
      const ended = state.status === "completed" || state.status === "error" ? state.time.end : void 0;
      const prompt = state.input.prompt;
      const agent = clean(state.input.subagent_type);
      const description = clean(state.input.description);
      const task = {
        id: `${sessionID}:${part.id}`,
        parentSessionID: sessionID,
        messageID: entry.info.id,
        sessionID: metadata.sessionId,
        agent: agent.length > 0 ? agent : "Subagent",
        description: description.length > 0 ? description : "Delegated task",
        state: state.status,
        started: state.time.start,
        ended,
        duration: ended !== void 0 ? Math.max(0, ended - state.time.start) : void 0,
        prompt: typeof prompt === "string" ? clean(prompt, prompt.length) : void 0,
        background: metadata.background === true
      };
      events.push({ kind: "task", time: task.started, messageID: entry.info.id, partID: part.id, task });
    }
  }
  return events.sort(compareEvents);
}
function initialPrompt(entries) {
  const first = ordered(entries).find((entry) => entry.info.role === "user");
  const text = first?.parts.filter((part) => part.type === "text" && part.synthetic !== true && part.ignored !== true).map((part) => part.type === "text" ? clean(part.text, part.text.length) : "").join("\n");
  return text !== void 0 && text.trim().length > 0 ? text : void 0;
}
function phaseLabel(phase) {
  const labels = {
    planning: "Planning",
    implementation: "Dev",
    review: "Review",
    verification: "Verification",
    blocked: "Blocked",
    complete: "Complete",
    unassigned: "Unassigned"
  };
  return phase.stage === "unassigned" ? labels.unassigned : `${labels[phase.stage]} ${phase.occurrence}`;
}
function workflowTimeline(rootID, histories, rows) {
  const phases = [];
  const counts = /* @__PURE__ */ new Map();
  const unassigned = {
    id: `${rootID}:unassigned`,
    stage: "unassigned",
    occurrence: 0,
    summary: "No recorded phase or delegation establishes the assignment.",
    assignments: []
  };
  const rowBySession = new Map(rows.map((row) => [row.session.id, row]));
  const phaseByTask = /* @__PURE__ */ new Map();
  const tasks = [];
  let current;
  for (const event of timelineEvents(rootID, histories.get(rootID) ?? [])) {
    if (event.kind === "task") {
      tasks.push(event);
      phaseByTask.set(event.task.id, current ?? unassigned);
      continue;
    }
    if (current?.stage === event.stage) {
      current.summary = event.summary;
      continue;
    }
    if (current !== void 0) {
      current.ended = event.time;
    }
    const occurrence = (counts.get(event.stage) ?? 0) + 1;
    counts.set(event.stage, occurrence);
    current = {
      id: `${rootID}:${event.partID}`,
      stage: event.stage,
      occurrence,
      summary: event.summary,
      started: event.time,
      assignments: []
    };
    phases.push(current);
  }
  for (const [sessionID, entries] of histories) {
    if (sessionID !== rootID) {
      tasks.push(...timelineEvents(sessionID, entries).filter((event) => event.kind === "task"));
    }
  }
  tasks.sort(compareEvents);
  const tasksByChildSession = /* @__PURE__ */ new Map();
  for (const event of tasks) {
    const launches = tasksByChildSession.get(event.task.sessionID) ?? [];
    launches.push(event);
    tasksByChildSession.set(event.task.sessionID, launches);
  }
  const nested = tasks.filter((event) => event.task.parentSessionID !== rootID);
  for (const event of nested) {
    const launches = tasksByChildSession.get(event.task.parentSessionID) ?? [];
    const overlapping = launches.filter(
      (candidate) => compareEvents(candidate, event) <= 0 && (candidate.task.background || candidate.task.ended === void 0 || event.time < candidate.task.ended)
    );
    const candidates = launches.filter((candidate, index) => {
      const next = launches.at(index + 1);
      return compareEvents(candidate, event) <= 0 && (next === void 0 || compareEvents(event, next) < 0) && (candidate.task.ended === void 0 || candidate.task.background || event.time <= candidate.task.ended);
    });
    const parent = overlapping.length < 2 && candidates.length === 1 ? candidates.at(0) : void 0;
    phaseByTask.set(event.task.id, parent !== void 0 ? phaseByTask.get(parent.task.id) ?? unassigned : unassigned);
  }
  const linked = /* @__PURE__ */ new Set();
  for (const event of tasks) {
    const task = event.task;
    linked.add(task.sessionID);
    const row = rowBySession.get(task.sessionID);
    const assignment = {
      id: task.id,
      sessionID: task.sessionID,
      depth: (rowBySession.get(task.parentSessionID)?.depth ?? 0) + 1,
      row: row !== void 0 ? { ...row, agent: task.agent, task } : void 0,
      task,
      latest: tasksByChildSession.get(task.sessionID)?.at(-1)?.task.id === task.id
    };
    (phaseByTask.get(task.id) ?? unassigned).assignments.push(assignment);
  }
  for (const row of rows) {
    if (row.depth > 0 && !linked.has(row.session.id)) {
      unassigned.assignments.push({
        id: `${rootID}:unlinked:${row.session.id}`,
        sessionID: row.session.id,
        depth: row.depth,
        row,
        latest: true
      });
    }
  }
  return unassigned.assignments.length > 0 ? [unassigned, ...phases] : phases;
}

// src/session-tools/workflow-data.ts
async function loadWorkflow(api, sessionID, signal, fullHistory = true) {
  const client = api.client;
  const options = { signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15e3)]) };
  const [session, messages] = await Promise.all([
    client.session.get({ sessionID }, options),
    client.session.messages({ sessionID, ...fullHistory ? {} : { limit: historyLimit } }, options)
  ]);
  if (Boolean(session.error) || Boolean(messages.error) || !hasResponseData(session.data) || !hasResponseData(messages.data)) {
    throw new PanelError("Could not read this session. It may have been deleted or the server is unavailable.");
  }
  const root = {
    session: session.data,
    entries: messages.data,
    limited: !fullHistory && messages.data.length >= historyLimit
  };
  const status = await client.session.status({}, options);
  const rows = [];
  const statusFailed = Boolean(status.error);
  const statusesAvailable = Boolean(status.data);
  let partial = statusFailed || !statusesAvailable;
  const seen = /* @__PURE__ */ new Set();
  const histories = /* @__PURE__ */ new Map([[sessionID, root.entries]]);
  const queue = [{ session: root.session, depth: 0 }];
  while (queue.length > 0 && rows.length < 24 && !signal.aborted) {
    const item = queue.shift();
    if (item === void 0) {
      break;
    }
    if (seen.has(item.session.id)) {
      continue;
    }
    seen.add(item.session.id);
    const history = item.depth === 0 ? { data: root.entries, error: void 0 } : await client.session.messages({ sessionID: item.session.id, ...fullHistory ? {} : { limit: 20 } }, options);
    const unavailable = Boolean(history.error) || !hasResponseData(history.data);
    histories.set(item.session.id, history.data ?? []);
    const last = lastAssistant(history.data ?? []);
    const agent = clean(last?.agent ?? item.session.agent ?? item.task?.agent);
    const variant = clean(last?.variant);
    rows.push({
      ...item,
      agent: agent.length > 0 ? agent : "Agent unavailable",
      model: last !== void 0 ? clean(`${last.providerID}/${last.modelID}`) : "No recorded model in loaded history",
      variant: variant.length > 0 ? variant : "Not recorded",
      unavailable
    });
    partial ||= unavailable;
    if (item.depth >= 2) {
      continue;
    }
    const children = await client.session.children({ sessionID: item.session.id }, options);
    const childrenUnavailable = Boolean(children.error) || !hasResponseData(children.data);
    if (childrenUnavailable) {
      partial = true;
      continue;
    }
    const tasks = delegations(history.data ?? []);
    for (const session2 of children.data ?? []) {
      if (queue.length + rows.length >= 24) {
        partial = true;
        break;
      }
      if (!seen.has(session2.id)) {
        queue.push({ session: session2, depth: item.depth + 1, task: tasks.find((task) => task.sessionID === session2.id) });
      }
    }
  }
  const statuses = { ...status.data };
  if (!statusFailed && statusesAvailable) {
    for (const row of rows) {
      statuses[row.session.id] ??= { type: "idle" };
    }
  }
  const phases = fullHistory ? workflowTimeline(sessionID, histories, rows) : [];
  partial ||= phases.some((phase) => phase.assignments.some((assignment) => assignment.row === void 0));
  return { root, rows, statuses, phases, partial: partial || queue.length > 0 };
}

// src/session-tools/workflow-view.tsx
import { use as _$use } from "@opentui/solid";
import { insert as _$insert } from "@opentui/solid";
import { createComponent as _$createComponent } from "@opentui/solid";
import { effect as _$effect } from "@opentui/solid";
import { createTextNode as _$createTextNode } from "@opentui/solid";
import { insertNode as _$insertNode } from "@opentui/solid";
import { setProp as _$setProp } from "@opentui/solid";
import { createElement as _$createElement } from "@opentui/solid";
import { useTerminalDimensions } from "@opentui/solid";
import { Show, createSignal, onCleanup } from "solid-js";
function CloseControl(props) {
  return (() => {
    var _el$ = _$createElement("box"), _el$2 = _$createElement("text");
    _$insertNode(_el$, _el$2);
    _$setProp(_el$, "position", "absolute");
    _$setProp(_el$, "top", 0);
    _$setProp(_el$, "right", 4);
    _$setProp(_el$, "width", 3);
    _$setProp(_el$, "height", 1);
    _$setProp(_el$, "zIndex", 1);
    _$setProp(_el$, "onMouseUp", (event) => {
      event.stopPropagation();
      props.close();
    });
    _$insertNode(_el$2, _$createTextNode(` \xD7 `));
    _$effect((_p$) => {
      var _v$ = props.api.theme.current.backgroundPanel, _v$2 = props.api.theme.current.textMuted;
      _v$ !== _p$.e && (_p$.e = _$setProp(_el$, "backgroundColor", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp(_el$2, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
function workflowUi(api) {
  return ui(api, (element, close) => (() => {
    var _el$4 = _$createElement("box");
    _$insert(_el$4, element, null);
    _$insert(_el$4, _$createComponent(CloseControl, {
      api,
      close
    }), null);
    return _el$4;
  })());
}
function PromptReader(props) {
  const dimensions = useTerminalDimensions();
  const [text, setText] = createSignal();
  const [loading, setLoading] = createSignal(true);
  const [failed, setFailed] = createSignal(false);
  const controller = new AbortController();
  const client = props.api.client;
  const route = props.api.route.current;
  const sessionID = route.name === "session" ? route.params?.sessionID : void 0;
  let scroll;
  const current = () => {
    const active = props.api.route.current;
    return !controller.signal.aborted && !props.api.lifecycle.signal.aborted && client === props.api.client && active.name === route.name && (active.name !== "session" || active.params?.sessionID === sessionID);
  };
  const load = async () => {
    setLoading(true);
    setFailed(false);
    try {
      const result = await props.load(controller.signal);
      if (current()) {
        setText(result);
      }
    } catch {
      if (current()) {
        setFailed(true);
      }
    } finally {
      if (current()) {
        setLoading(false);
      }
    }
  };
  const height = () => Math.max(3, Math.floor(dimensions().height * 0.6) - 6);
  const dispose = props.api.keymap.registerLayer({
    mode: "modal",
    commands: [{
      name: "workflow-panel.prompt.up",
      title: "Scroll prompt up",
      run: () => scroll?.scrollBy(-1)
    }, {
      name: "workflow-panel.prompt.down",
      title: "Scroll prompt down",
      run: () => scroll?.scrollBy(1)
    }, {
      name: "workflow-panel.prompt.page-up",
      title: "Previous prompt page",
      run: () => scroll?.scrollBy(-height())
    }, {
      name: "workflow-panel.prompt.page-down",
      title: "Next prompt page",
      run: () => scroll?.scrollBy(height())
    }, {
      name: "workflow-panel.prompt.home",
      title: "Prompt start",
      run: () => scroll?.scrollTo(0)
    }, {
      name: "workflow-panel.prompt.end",
      title: "Prompt end",
      run: () => scroll?.scrollTo(scroll.scrollHeight)
    }],
    bindings: [{
      key: "up",
      cmd: "workflow-panel.prompt.up"
    }, {
      key: "down",
      cmd: "workflow-panel.prompt.down"
    }, {
      key: "pageup",
      cmd: "workflow-panel.prompt.page-up"
    }, {
      key: "pagedown",
      cmd: "workflow-panel.prompt.page-down"
    }, {
      key: "home",
      cmd: "workflow-panel.prompt.home"
    }, {
      key: "end",
      cmd: "workflow-panel.prompt.end"
    }]
  });
  onCleanup(() => {
    controller.abort();
    dispose();
  });
  props.api.ui.dialog.setSize("large");
  void load();
  return (() => {
    var _el$5 = _$createElement("box"), _el$6 = _$createElement("text"), _el$7 = _$createElement("text");
    _$insertNode(_el$5, _el$6);
    _$insertNode(_el$5, _el$7);
    _$setProp(_el$5, "paddingLeft", 4);
    _$setProp(_el$5, "paddingRight", 4);
    _$setProp(_el$5, "paddingBottom", 1);
    _$setProp(_el$5, "gap", 1);
    _$setProp(_el$6, "paddingRight", 3);
    _$insert(_el$6, () => props.title);
    _$insert(_el$5, _$createComponent(CloseControl, {
      get api() {
        return props.api;
      },
      get close() {
        return props.view.navigation.close;
      }
    }), _el$7);
    _$insert(_el$5, _$createComponent(Show, {
      get when() {
        return !loading();
      },
      get fallback() {
        return (() => {
          var _el$9 = _$createElement("text");
          _$insertNode(_el$9, _$createTextNode(`Loading prompt\u2026`));
          _$effect((_$p) => _$setProp(_el$9, "fg", props.api.theme.current.textMuted, _$p));
          return _el$9;
        })();
      },
      get children() {
        return _$createComponent(Show, {
          get when() {
            return !failed();
          },
          get fallback() {
            return (() => {
              var _el$1 = _$createElement("text");
              _$insertNode(_el$1, _$createTextNode(`Could not load prompt. Select to retry.`));
              _$setProp(_el$1, "onMouseUp", () => {
                void load();
              });
              _$effect((_$p) => _$setProp(_el$1, "fg", props.api.theme.current.warning, _$p));
              return _el$1;
            })();
          },
          get children() {
            return _$createComponent(Show, {
              get when() {
                return text();
              },
              get fallback() {
                return (() => {
                  var _el$11 = _$createElement("text");
                  _$insertNode(_el$11, _$createTextNode(`The original prompt is unavailable in recorded history.`));
                  _$effect((_$p) => _$setProp(_el$11, "fg", props.api.theme.current.textMuted, _$p));
                  return _el$11;
                })();
              },
              children: (value) => (() => {
                var _el$13 = _$createElement("scrollbox"), _el$14 = _$createElement("text");
                _$insertNode(_el$13, _el$14);
                _$use((element) => {
                  scroll = element;
                }, _el$13);
                _$setProp(_el$14, "wrapMode", "word");
                _$insert(_el$14, value);
                _$effect((_p$) => {
                  var _v$6 = height(), _v$7 = props.api.theme.current.text;
                  _v$6 !== _p$.e && (_p$.e = _$setProp(_el$13, "height", _v$6, _p$.e));
                  _v$7 !== _p$.t && (_p$.t = _$setProp(_el$14, "fg", _v$7, _p$.t));
                  return _p$;
                }, {
                  e: void 0,
                  t: void 0
                });
                return _el$13;
              })()
            });
          }
        });
      }
    }), _el$7);
    _$insertNode(_el$7, _$createTextNode(`esc \xB7 back`));
    _$effect((_p$) => {
      var _v$3 = props.api.theme.current.primary, _v$4 = props.api.theme.current.textMuted, _v$5 = props.view.navigation.back;
      _v$3 !== _p$.e && (_p$.e = _$setProp(_el$6, "fg", _v$3, _p$.e));
      _v$4 !== _p$.t && (_p$.t = _$setProp(_el$7, "fg", _v$4, _p$.t));
      _v$5 !== _p$.a && (_p$.a = _$setProp(_el$7, "onMouseUp", _v$5, _p$.a));
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$5;
  })();
}
async function readInitialPrompt(api, sessionID, signal) {
  const result = await api.client.session.messages({
    sessionID
  }, {
    signal: AbortSignal.any([signal, api.lifecycle.signal, AbortSignal.timeout(15e3)])
  });
  if (Boolean(result.error) || result.data === void 0) {
    throw new PanelError("Could not read the original prompt.");
  }
  return initialPrompt(result.data);
}

// src/session-tools/workflow.tsx
function feed(api, sessionID, fullHistory = true) {
  const [data, setData] = createSignal2();
  const [failed, setFailed] = createSignal2(false);
  const controller = new AbortController();
  let busy = false;
  let pending = false;
  let timer;
  const markFailed = () => {
    if (!controller.signal.aborted) {
      setFailed(true);
    }
  };
  const refresh = async () => {
    if (controller.signal.aborted || api.lifecycle.signal.aborted) {
      return;
    }
    if (busy) {
      pending = true;
      return;
    }
    busy = true;
    const client = api.client;
    try {
      const result = await loadWorkflow(api, sessionID, controller.signal, fullHistory);
      if (!controller.signal.aborted && client === api.client) {
        setData(result);
        setFailed(false);
      }
    } catch {
      if (client === api.client) {
        markFailed();
      }
    } finally {
      busy = false;
      if (pending) {
        pending = false;
        schedule();
      }
    }
  };
  const schedule = () => {
    if (timer !== void 0 || controller.signal.aborted) {
      return;
    }
    timer = setTimeout(() => {
      timer = void 0;
      refresh().catch(markFailed);
    }, 500);
  };
  const unsubscribers = [api.event.on("session.status", schedule), api.event.on("session.created", schedule), api.event.on("session.updated", schedule), api.event.on("session.deleted", schedule)];
  const interval = setInterval(() => {
    refresh().catch(markFailed);
  }, 1e4);
  const dispose = () => {
    controller.abort();
    clearInterval(interval);
    clearTimeout(timer);
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  };
  const removeDispose = api.lifecycle.onDispose(dispose);
  onCleanup2(() => {
    dispose();
    removeDispose();
  });
  refresh().catch(markFailed);
  return {
    data,
    failed,
    refresh
  };
}
function rowStatus(api, data, row) {
  const questions = api.state.session.question(row.session.id).length;
  const permissions = api.state.session.permission(row.session.id).length;
  const status = data.statuses[row.session.id];
  if (questions > 0 || permissions > 0 || status?.type === "busy" || status?.type === "retry") {
    return activity(status, questions, permissions);
  }
  if (row.task?.state === "completed") {
    return "Delegation completed";
  }
  if (row.task?.state === "error") {
    return "Delegation failed";
  }
  return row.unavailable === true ? "History unavailable" : activity(status, 0, 0);
}
function assignmentStatus(api, data, assignment) {
  if (assignment.task?.background === true) {
    if (assignment.latest === true && assignment.row !== void 0) {
      const row = assignment.row;
      const questions = api.state.session.question(row.session.id).length;
      const permissions = api.state.session.permission(row.session.id).length;
      const status = data.statuses[row.session.id];
      if (questions > 0 || permissions > 0 || status?.type === "busy" || status?.type === "retry") {
        return activity(status, questions, permissions);
      }
    }
    if (assignment.task.state === "error") {
      return "Delegation failed";
    }
    return assignment.task.state === "completed" ? "Background dispatch completed" : "Delegation running";
  }
  if (assignment.task?.state === "completed") {
    return "Delegation completed";
  }
  if (assignment.task?.state === "error") {
    return "Delegation failed";
  }
  return assignment.row !== void 0 ? rowStatus(api, data, assignment.row) : "Session unavailable";
}
function details(api, view, assignment) {
  const row = assignment.row;
  const task = assignment.task;
  const agent = task?.agent ?? row?.agent ?? "Subagent";
  view.menu(clean(agent), [{
    title: task !== void 0 ? "View assignment prompt" : "View initial prompt",
    value: "prompt",
    description: "Read the prompt in a large view",
    run: () => view.navigation.show(() => _$createComponent2(PromptReader, {
      api,
      view,
      title: task !== void 0 ? "Assignment prompt" : "Initial prompt",
      load: (signal) => task !== void 0 ? Promise.resolve(task.prompt) : readInitialPrompt(api, assignment.sessionID, signal)
    }))
  }, {
    title: "Open conversation",
    value: "open",
    description: clean(row?.session.title),
    run: () => {
      view.navigation.close();
      api.route.navigate("session", {
        sessionID: assignment.sessionID
      });
    }
  }, {
    title: "Last recorded model",
    value: "model",
    description: row !== void 0 ? `${row.model} \xB7 ${row.variant}` : "Session unavailable",
    run: () => view.alert("Recorded model", row !== void 0 ? `${row.model}
Variant: ${row.variant}
This describes the latest recorded turn in the session.` : "No recorded model is available.")
  }, {
    title: "Delegated task",
    value: "task",
    description: task?.description ?? "No linked assignment",
    run: () => view.alert("Delegated task", task?.description ?? clean(row?.session.title))
  }, {
    title: "Timing",
    value: "time",
    description: task?.duration !== void 0 ? `${Math.round(task.duration / 1e3)} seconds ${task.background ? "to dispatch this background assignment" : "for this assignment"}` : task !== void 0 ? `Assignment started ${new Date(task.started).toLocaleString()}` : row !== void 0 ? `Session created ${new Date(row.session.time.created).toLocaleString()}` : "Timing unavailable"
  }]);
}
function Dialog(props) {
  const source = feed(props.api, props.sessionID);
  const isExpanded = (phase, data) => props.state.expanded().get(phase.id) ?? phase.id === data.phases.at(-1)?.id;
  createEffect(() => {
    const data = source.data();
    const target = props.state.initialSessionID;
    if (data === void 0 || target === void 0) {
      return;
    }
    props.state.initialSessionID = void 0;
    const assignment = data.phases.flatMap((phase) => phase.assignments).find((item) => item.sessionID === target && item.latest === true);
    const row = data.rows.find((item) => item.session.id === target);
    if (assignment !== void 0) {
      details(props.api, props.view, assignment);
    } else if (row !== void 0) {
      details(props.api, props.view, {
        id: row.session.id,
        sessionID: target,
        depth: row.depth,
        row
      });
    }
  });
  const actions = () => {
    const data = source.data();
    if (data === void 0) {
      return [{
        title: source.failed() ? "Could not load workflow. Select to retry." : "Loading workflow\u2026",
        value: "retry",
        run: source.refresh
      }];
    }
    return [{
      title: "Initial request",
      value: "request",
      description: clean(data.root.session.title),
      run: () => props.view.navigation.show(() => _$createComponent2(PromptReader, {
        get api() {
          return props.api;
        },
        get view() {
          return props.view;
        },
        title: "Initial request",
        load: () => Promise.resolve(initialPrompt(data.root.entries))
      }))
    }, ...data.phases.flatMap((phase) => [{
      title: `${isExpanded(phase, data) ? "\u25BE" : "\u25B8"} ${phaseLabel(phase)}`,
      value: `phase:${phase.id}`,
      description: phase.summary,
      footer: `${phase.assignments.length} assignments${phase.id === data.phases.at(-1)?.id ? " \xB7 current" : ""}`,
      run: () => {
        props.state.setExpanded((current) => new Map(current).set(phase.id, !isExpanded(phase, data)));
      }
    }, ...isExpanded(phase, data) ? phase.assignments.map((assignment) => ({
      title: `${"  ".repeat(assignment.depth)}${assignment.task?.agent ?? assignment.row?.agent ?? "Subagent"}`,
      value: `assignment:${assignment.id}`,
      description: assignment.task?.description ?? clean(assignment.row?.session.title),
      footer: assignmentStatus(props.api, data, assignment),
      run: () => details(props.api, props.view, assignment)
    })) : []]), ...data.rows.filter((row) => row.depth === 0).map((row) => ({
      title: `Lead: ${row.agent}`,
      value: `lead:${row.session.id}`,
      footer: rowStatus(props.api, data, row),
      run: () => details(props.api, props.view, {
        id: row.session.id,
        sessionID: row.session.id,
        depth: 0,
        row
      })
    })), {
      title: "Refresh",
      value: "refresh",
      description: source.failed() ? "Refresh failed; displayed data may be stale." : `Recorded phase history.${data.partial ? " Some child sessions or statuses are unavailable." : ""}`,
      run: source.refresh
    }];
  };
  return props.view.navigation.select({
    title: "Live workflow",
    placeholder: "Find an agent or task\u2026",
    current: props.state.current,
    get options() {
      return actions();
    },
    onSelect: (option) => {
      props.state.current = option.value;
      void props.view.run(() => actions().find((item) => item.value === option.value)?.run?.());
    },
    onMove: (option) => {
      props.state.current = option.value;
    }
  })();
}
function Sidebar(props) {
  const source = feed(props.api, props.sessionID, false);
  const [expanded, setExpanded] = createSignal2(false);
  const report = () => {
    const data = source.data();
    return data !== void 0 ? stageReport(data.root.entries) : void 0;
  };
  const theme = () => props.api.theme.current;
  return (() => {
    var _el$ = _$createElement2("box"), _el$2 = _$createElement2("text"), _el$3 = _$createTextNode2(` Workflow`), _el$4 = _$createElement2("text");
    _$insertNode2(_el$, _el$2);
    _$insertNode2(_el$, _el$4);
    _$setProp2(_el$, "gap", 1);
    _$insertNode2(_el$2, _el$3);
    _$setProp2(_el$2, "onMouseUp", () => setExpanded((value) => !value));
    _$insert2(_el$2, () => expanded() ? "\u25BE" : "\u25B8", _el$3);
    _$setProp2(_el$4, "onMouseUp", () => props.open());
    _$insert2(_el$4, () => report()?.stage ?? "Stage not reported");
    _$insert2(_el$, _$createComponent2(Show2, {
      get when() {
        return expanded();
      },
      get children() {
        return [_$createComponent2(Show2, {
          get when() {
            return report()?.summary;
          },
          children: (summary) => (() => {
            var _el$7 = _$createElement2("text");
            _$insert2(_el$7, summary);
            _$effect2((_$p) => _$setProp2(_el$7, "fg", theme().textMuted, _$p));
            return _el$7;
          })()
        }), _$createComponent2(Show2, {
          get when() {
            return source.failed();
          },
          get children() {
            var _el$5 = _$createElement2("text");
            _$insertNode2(_el$5, _$createTextNode2(`Refresh failed; data may be stale.`));
            _$effect2((_$p) => _$setProp2(_el$5, "fg", theme().warning, _$p));
            return _el$5;
          }
        }), _$createComponent2(For, {
          get each() {
            return source.data()?.rows.slice(0, 5);
          },
          children: (row) => {
            const status = () => {
              const data = source.data();
              return data !== void 0 ? rowStatus(props.api, data, row) : "Loading";
            };
            return (() => {
              var _el$8 = _$createElement2("text"), _el$9 = _$createTextNode2(`: `);
              _$insertNode2(_el$8, _el$9);
              _$setProp2(_el$8, "onMouseUp", () => props.open(row));
              _$insert2(_el$8, () => row.agent, _el$9);
              _$insert2(_el$8, status, null);
              _$effect2((_$p) => _$setProp2(_el$8, "fg", theme().textMuted, _$p));
              return _el$8;
            })();
          }
        })];
      }
    }), null);
    _$effect2((_p$) => {
      var _v$ = theme().primary, _v$2 = theme().text;
      _v$ !== _p$.e && (_p$.e = _$setProp2(_el$2, "fg", _v$, _p$.e));
      _v$2 !== _p$.t && (_p$.t = _$setProp2(_el$4, "fg", _v$2, _p$.t));
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$;
  })();
}
var workflow_default = {
  id: "workflow-panel",
  // eslint-disable-next-line @typescript-eslint/require-await -- OpenCode requires Promise-returning TUI initialization hooks.
  tui: async (api) => {
    const view = workflowUi(api);
    const open = (sessionID = currentSession(api), row) => {
      const [expanded, setExpanded] = createSignal2(/* @__PURE__ */ new Map());
      const state = {
        expanded,
        setExpanded,
        initialSessionID: row?.session.id
      };
      view.navigation.show(() => _$createComponent2(Dialog, {
        api,
        view,
        sessionID,
        state
      }), true);
    };
    view.command("workflow-panel.open", "Live workflow", "workflow-panel", "Session", () => open());
    api.slots.register({
      order: 350,
      slots: {
        sidebar_content: (_context, props) => _$createComponent2(Show2, {
          get when() {
            return props.session_id;
          },
          keyed: true,
          children: (sessionID) => _$createComponent2(Sidebar, {
            api,
            sessionID,
            open: (row) => open(sessionID, row)
          })
        })
      }
    });
  }
};
export {
  workflow_default as default
};
