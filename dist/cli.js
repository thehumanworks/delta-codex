// Delta for Codex — AGPL-3.0-only. See LICENSE and NOTICE.

// src/main.ts
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

// src/core/process.ts
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
var MAX_FRAME = 32 * 1024 * 1024;
var run = (argv, options = {}) => new Promise((resolve2, reject) => {
  const child = spawn(argv[0], argv.slice(1), {
    cwd: options.cwd,
    windowsHide: true,
    stdio: "pipe",
    shell: false,
    env: { ...process.env, DELTA_INTEGRATION: "codex" }
  });
  let stdout = "", stderr = "", failure;
  let killTimer;
  const fail = (error) => {
    if (failure) return;
    failure = error;
    child.kill("SIGTERM");
    killTimer = setTimeout(() => child.kill("SIGKILL"), 2500);
  };
  const timer = setTimeout(() => {
    fail(new Error(`Command timed out: ${argv.slice(0, 3).join(" ")}`));
  }, options.timeout ?? 12e4);
  const capture = (which, chunk) => {
    if (which === "stdout") stdout += chunk.toString();
    else {
      stderr += chunk;
      options.onStderr?.(chunk);
    }
    if (stdout.length + stderr.length > MAX_FRAME) {
      fail(new Error("Command output exceeds the capture limit; no acknowledgment assumed"));
    }
  };
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => capture("stdout", chunk));
  child.stderr.on("data", (chunk) => capture("stderr", chunk));
  child.on("error", (error) => {
    clearTimeout(timer);
    clearTimeout(killTimer);
    reject(error);
  });
  child.on("close", (code) => {
    clearTimeout(timer);
    clearTimeout(killTimer);
    failure ? reject(failure) : resolve2({ code, stdout, stderr });
  });
  child.stdin.on("error", () => {
  });
  child.stdin.end(options.input);
});
function stream(argv, onLine) {
  const child = spawn(argv[0], argv.slice(1), {
    windowsHide: true,
    stdio: "pipe",
    shell: false,
    env: { ...process.env, DELTA_INTEGRATION: "codex" }
  });
  let resolveReady, rejectReady;
  let first = true, stopped = false, stderr = "";
  const ready = new Promise((resolve2, reject) => {
    resolveReady = resolve2;
    rejectReady = reject;
  });
  void ready.catch(() => {
  });
  let length = 0;
  child.stdout.on("data", (chunk) => {
    const last = chunk.lastIndexOf(10);
    length = last < 0 ? length + chunk.length : chunk.length - last - 1;
    if (length > MAX_FRAME) {
      rejectReady(new Error("Delta stream frame too large"));
      child.kill();
    }
  });
  const lines = createInterface({ input: child.stdout });
  lines.on("line", (line) => {
    try {
      if (line.length > MAX_FRAME) throw new Error("Delta stream frame too large");
      if (first) {
        first = false;
        resolveReady(JSON.parse(line));
      }
      onLine?.(line);
    } catch (error) {
      rejectReady(error);
      child.kill();
    }
  });
  child.stderr.on("data", (chunk) => {
    stderr = (stderr + chunk.toString()).slice(-4096);
  });
  const done = new Promise((resolve2, reject) => {
    child.on("error", (error) => {
      rejectReady(error);
      reject(error);
    });
    child.on("close", (code) => {
      lines.close();
      rejectReady(new Error(stderr || `Delta stream exited ${code}`));
      if (stopped || code === 0) resolve2();
      else reject(new Error(stderr || `Delta stream exited ${code}`));
    });
  });
  void done.catch(() => {
  });
  return {
    ready,
    done,
    stop: async () => {
      stopped = true;
      await terminate(child, done);
    }
  };
}
async function terminate(child, done) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  child.kill("SIGTERM");
  const timer = setTimeout(() => child.kill("SIGKILL"), 2500);
  try {
    await done.catch(() => {
    });
  } finally {
    clearTimeout(timer);
  }
}
async function deadline(promise, milliseconds, label) {
  let timer;
  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), milliseconds);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

// src/core/json.ts
function isJsonObject(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}
function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}
function isSafeInteger(value) {
  return typeof value === "number" && Number.isSafeInteger(value);
}
function isOneOf(value, allowed) {
  return allowed.includes(value);
}
function jsonText(value) {
  return typeof value === "string" ? value : JSON.stringify(value) ?? String(value);
}

// src/core/paths.ts
function pathKey(path, ...counterparts) {
  const windows = (value) => /^[a-z]:[\\/]/i.test(value) || value.startsWith("\\\\");
  return windows(path) || counterparts.some(windows) ? path.replace(/\\/g, "/") : path;
}
function samePath(left, right) {
  return pathKey(left, right) === pathKey(right, left);
}

// src/cli/thread-commands.ts
var SOURCE = "codex";
var PRODUCER_NAME = "Codex";
var DeltaCommandError = class extends Error {
  constructor(code, message, hints = {}, reason) {
    super(message);
    this.code = code;
    this.hints = hints;
    this.reason = reason;
    this.name = "DeltaCommandError";
  }
  code;
  hints;
  reason;
};
function commandErrorFromEnvelope(error, name) {
  if (!isJsonObject(error) || typeof error.code !== "string" || typeof error.message !== "string") return;
  const reason = isNonEmptyString(error.reason) ? error.reason : void 0;
  const label = reason && reason !== error.code ? `${error.code} (${reason})` : error.code;
  return new DeltaCommandError(
    error.code,
    `${name ? `${name}: ` : ""}${label}: ${error.message}`,
    {
      ...typeof error.retryable === "boolean" ? { retryable: error.retryable } : {},
      ...isFiniteNumber(error.retry_after_ms) && error.retry_after_ms >= 0 ? { retryAfterMs: error.retry_after_ms } : {}
    },
    reason
  );
}
function commandErrorFromOutput(text2, name) {
  let value;
  try {
    value = JSON.parse(text2);
  } catch {
    return void 0;
  }
  return isJsonObject(value) ? commandErrorFromEnvelope(value.error, name) : void 0;
}
function envelopeError(value) {
  return isJsonObject(value) ? commandErrorFromEnvelope(value.error) : void 0;
}
var LOCAL_FAILURE_CLASSES = {
  process_failed: "transient",
  timeout: "transient",
  command_failed: "permanent",
  invalid_acknowledgment: "permanent"
};
function classifyCommandFailure(error) {
  if (!(error instanceof DeltaCommandError)) return "permanent";
  if (error.hints.retryable !== void 0) return error.hints.retryable ? "transient" : "permanent";
  return LOCAL_FAILURE_CLASSES[error.code] ?? "permanent";
}
function appendFailure(stdout, stderr, exitCode) {
  for (const line of stdout.trim().split("\n").reverse()) {
    const failure = commandErrorFromOutput(line);
    if (failure) return failure;
  }
  return new DeltaCommandError("process_failed", stderr.trim() || `append exited ${exitCode ?? "abnormally"}`);
}
function parseWatchEvent(line) {
  const event = JSON.parse(line);
  if (!isJsonObject(event))
    throw new Error("Unexpected thread watch event; use matching CLI and extension builds");
  const failure = commandErrorFromEnvelope(event.error);
  if (failure) return { type: "error", error: failure };
  switch (event.type) {
    case "ready":
      if (isNonEmptyString(event.thread_id) && validProducer(event.producer))
        return { type: "ready", thread_id: event.thread_id, producer: event.producer };
      break;
    case "item":
      if (validItem(event.item)) return { type: "item", item: event.item };
      break;
    case "item.append":
      if (isNonEmptyString(event.id) && typeof event.text === "string")
        return { type: "item.append", id: event.id, text: event.text };
      break;
    case "remove":
      if (isNonEmptyString(event.id)) return { type: "remove", id: event.id };
      break;
    case "live":
      return { type: "live" };
    case "turn":
      if (isOneOf(event.state, ["idle", "running"]) && (event.turn_id === null || isNonEmptyString(event.turn_id)) && (event.user === null || validUser(event.user)))
        return { type: "turn", state: event.state, turn_id: event.turn_id, user: event.user };
      break;
    case "producer.turn":
      if (validTurn(event)) return { type: "producer.turn", sequence: event.sequence, status: event.status };
      break;
    case "presence":
      if (Array.isArray(event.users) && event.users.every(validUser))
        return { type: "presence", users: event.users };
      break;
    case "children":
      if (Array.isArray(event.children) && event.children.every(validChild))
        return { type: "children", children: event.children.map(watchChild) };
      break;
    case "child":
      if (validChild(event.child)) return { type: "child", child: watchChild(event.child) };
      break;
    case "child.remove":
      if (isNonEmptyString(event.thread_id)) return { type: "child.remove", thread_id: event.thread_id };
      break;
    case "worktrees":
      if (Array.isArray(event.worktrees) && event.worktrees.every(validWorktreeName))
        return {
          type: "worktrees",
          worktrees: event.worktrees.map((tree) => ({ reference: tree.reference, name: tree.name }))
        };
      break;
    case "comment":
      if (validComment(event.comment)) return { type: "comment", comment: event.comment };
      break;
    case "comment.remove":
      if (isNonEmptyString(event.id)) return { type: "comment.remove", id: event.id };
      break;
    default:
      if (typeof event.type === "string") return;
  }
  throw new Error("Unexpected thread watch event; use matching CLI and extension builds");
}
function validWorktreeName(tree) {
  return isJsonObject(tree) && isNonEmptyString(tree.reference) && typeof tree.name === "string";
}
function validChild(child) {
  return isJsonObject(child) && isNonEmptyString(child.thread_id) && isNonEmptyString(child.kind) && typeof child.name === "string" && isNonEmptyString(child.status) && isNonEmptyString(child.reference);
}
function watchChild(child) {
  return {
    thread_id: child.thread_id,
    reference: child.reference,
    kind: child.kind,
    name: child.name,
    status: child.status
  };
}
function validComment(comment) {
  return isJsonObject(comment) && isNonEmptyString(comment.id) && isNonEmptyString(comment.chain) && isNonEmptyString(comment.delivered_with) && (comment.after_id === null || isNonEmptyString(comment.after_id)) && (comment.routed_to === null || isNonEmptyString(comment.routed_to)) && validUser(comment.author) && Array.isArray(comment.co_authors) && comment.co_authors.every(validUser) && typeof comment.agent === "boolean" && (comment.created_at === null || isFiniteNumber(comment.created_at)) && typeof comment.text === "string" && (comment.target === null || validCommentTarget(comment.target));
}
function validCommentTarget(target) {
  if (!isJsonObject(target)) return false;
  if (target.kind === "transcript")
    return (target.item_id === null || isNonEmptyString(target.item_id)) && typeof target.quote === "string";
  if (target.kind === "file")
    return typeof target.path === "string" && typeof target.view === "string" && (target.worktree === null || isNonEmptyString(target.worktree)) && (target.selected === null || typeof target.selected === "string") && Array.isArray(target.regions) && target.regions.every(
      (region) => isJsonObject(region) && isSafeInteger(region.first_line) && isSafeInteger(region.last_line) && typeof region.status === "string" && typeof region.text === "string"
    );
  return typeof target.kind === "string";
}
function validItem(item) {
  return isJsonObject(item) && isNonEmptyString(item.id) && isNonEmptyString(item.kind) && (item.after_id === null || isNonEmptyString(item.after_id)) && (item.turn_id === null || isNonEmptyString(item.turn_id)) && (item.author === null || validUser(item.author)) && (item.created_at === null || isFiniteNumber(item.created_at)) && typeof item.open === "boolean" && isJsonObject(item.content);
}
function validUser(user) {
  return isJsonObject(user) && (user.user_id === null || isNonEmptyString(user.user_id)) && (user.name === null || typeof user.name === "string") && (user.actor_id === void 0 || isNonEmptyString(user.actor_id));
}
function parseThreadStatus(line) {
  const status2 = JSON.parse(line);
  const failure = envelopeError(status2);
  if (failure) throw failure;
  if (isJsonObject(status2) && status2.operation === "status" && validBinding(status2)) return status2;
  throw new Error("Unexpected thread status; use matching CLI and extension builds");
}
function validBinding(frame) {
  return isNonEmptyString(frame.thread_id) && (frame.url === null || isNonEmptyString(frame.url)) && (frame.title === null || typeof frame.title === "string") && isJsonObject(frame.access) && isOneOf(frame.access.state, ["local_only", "granted"]) && (frame.access.is_owner === null || typeof frame.access.is_owner === "boolean") && (frame.visibility === null || isOneOf(frame.visibility, ["private", "organization", "unlisted"])) && (frame.upload === null || validUpload(frame.upload)) && validWorktrees(frame.worktrees) && validProducer(frame.producer);
}
function validUpload(value) {
  return isJsonObject(value) && isOneOf(value.state, ["queued", "uploading", "uploaded", "failed"]) && (value.organization_id === null || isNonEmptyString(value.organization_id)) && (value.error === null || validErrorObject(value.error));
}
function validErrorObject(error) {
  return isJsonObject(error) && typeof error.code === "string" && (error.reason === void 0 || typeof error.reason === "string") && typeof error.message === "string";
}
function validProducer(value) {
  return value === null || isJsonObject(value) && isNonEmptyString(value.source) && isNonEmptyString(value.external_id) && isSafeInteger(value.next_sequence) && value.next_sequence >= 1 && (value.actor_id === void 0 || value.actor_id === null || isNonEmptyString(value.actor_id)) && (value.turn === null || validTurn(value.turn));
}
function validWorktrees(value) {
  if (!isJsonObject(value)) return false;
  if (value.status === "unavailable") return validErrorObject(value.error);
  return value.status === "available" && Array.isArray(value.items) && value.items.every(
    (worktree) => isJsonObject(worktree) && isNonEmptyString(worktree.reference) && Array.isArray(worktree.checkouts) && worktree.checkouts.every(
      (checkout) => isJsonObject(checkout) && isNonEmptyString(checkout.directory) && isOneOf(checkout.state, ["attached", "inactive", "detached", "missing"]) && (checkout.active === void 0 || typeof checkout.active === "boolean")
    )
  );
}
function inspectionUnavailableMessage(error) {
  const label = error.reason && error.reason !== error.code ? `${error.code} (${error.reason})` : error.code;
  return `Delta checkout inspection unavailable (${label}): ${error.message}. Resolve the inspection failure and retry; the existing binding and queued messages were preserved.`;
}
var EXTENSION_CONTRACT_MIN = 8;
var EXTENSION_CONTRACT_MAX = 10;
function parseThreadContract(line) {
  let result;
  try {
    result = JSON.parse(line);
  } catch {
    throw new Error("Unexpected thread contract; use matching CLI and extension builds");
  }
  const failure = envelopeError(result);
  if (failure) throw failure;
  if (!isJsonObject(result) || result.operation !== "contract" || !isSafeInteger(result.min) || !isSafeInteger(result.max) || result.min < 0 || result.max < result.min)
    throw new Error("Unexpected thread contract; use matching CLI and extension builds");
  return { operation: "contract", min: result.min, max: result.max };
}
function contractRefusal(range) {
  if (!range || range.max < EXTENSION_CONTRACT_MIN)
    return "This Delta is too old for this extension. Update Delta to continue";
  if (range.min > EXTENSION_CONTRACT_MAX)
    return "This Delta is newer than this extension. Update the Delta extension for Codex to continue";
}
function contractVersion(range) {
  return Math.min(range.max, EXTENSION_CONTRACT_MAX);
}
var JoinNotReadyError = class extends Error {
};
function parseThreadMount(line, owner) {
  const result = JSON.parse(line);
  const failure = envelopeError(result);
  if (failure) throw failure;
  if (!isJsonObject(result) || result.operation !== "mounted" || !isNonEmptyString(result.thread_id) || result.owner !== owner || !isNonEmptyString(result.directory) || !Array.isArray(result.worktrees) || !result.worktrees.every(validMount))
    throw new Error("Unexpected thread mount result; use matching CLI and extension builds");
  return {
    thread_id: result.thread_id,
    owner,
    directory: result.directory,
    worktrees: result.worktrees.map((tree) => ({
      reference: tree.reference,
      name: tree.name,
      directory: tree.directory,
      state: tree.state
    }))
  };
}
function validateJoinedMounts(state, mounts) {
  if (state.access.state !== "granted")
    throw new Error("Access to the joined thread is not granted; check your Delta sign-in and thread access");
  if (state.worktrees.status === "unavailable")
    throw new DeltaCommandError(
      state.worktrees.error.code,
      inspectionUnavailableMessage(state.worktrees.error),
      {},
      state.worktrees.error.reason
    );
  const items = state.worktrees.items;
  for (const mount of mounts) {
    const ready = items.some(
      (tree) => tree.reference === mount.reference && tree.checkouts.some(
        (checkout) => samePath(checkout.directory, mount.directory) && checkout.active === true && ["attached", "detached"].includes(checkout.state)
      )
    );
    if (!ready)
      throw new JoinNotReadyError(
        `The worktree "${mount.name}" is not mounted at ${mount.directory} yet. Wait for Delta to finish mounting it, or run /delta-join with this thread's link to mount it again`
      );
  }
}
function validMount(tree) {
  return isJsonObject(tree) && isNonEmptyString(tree.reference) && isNonEmptyString(tree.name) && isNonEmptyString(tree.directory) && isNonEmptyString(tree.state);
}
function parseAppendReceipt(line, thread, sequence) {
  const ack = JSON.parse(line);
  if (!isJsonObject(ack) || !validReceipt(ack, thread, sequence))
    throw new Error("Invalid thread acknowledgment; no delivery assumed");
  return ack;
}
function validReceipt(ack, thread, sequence) {
  return ack.thread_id === thread && ack.sequence === sequence && isSafeInteger(ack.next_sequence) && ack.next_sequence > sequence && typeof ack.duplicate === "boolean" && isNonEmptyString(ack.version) && ack.operation === "appended" && isOneOf(ack.disposition, ["recorded", "fenced", "duplicate"]) && (ack.turn_sequence === null || isSafeInteger(ack.turn_sequence) && ack.turn_sequence > 0 && ack.turn_sequence <= sequence);
}
function validTurn(value) {
  return isJsonObject(value) && isSafeInteger(value.sequence) && value.sequence > 0 && isOneOf(value.status, ["running", "finished", "superseded"]);
}
function validateThreadFrontier(ready, binding) {
  if (binding.thread && binding.thread !== ready.thread_id)
    throw new Error("Delta returned a different conversation; the existing binding was preserved");
  if (!ready.producer || ready.producer.source !== SOURCE || ready.producer.external_id !== binding.session)
    throw new Error(
      "Delta returned a different or missing Codex producer; the existing binding was preserved"
    );
  const acknowledgedThrough = binding.pending.reduce(
    (frontier, entry) => Math.min(frontier, entry.sequence),
    binding.next
  );
  if (ready.producer.next_sequence < acknowledgedThrough)
    throw new Error(
      "Delta has lost acknowledged client history. Restore the common account store or start a new Codex session; do not reset the sequence."
    );
  if (ready.producer.next_sequence > binding.next)
    throw new Error(
      "Delta is ahead of this Codex outbox. Restore the matching producer state; do not reuse sequence numbers."
    );
}

// src/cli/delta.ts
var Delta = class {
  constructor(executable = process.env.DELTA_CODEX_DELTA_BIN || "delta", runner = run) {
    this.executable = executable;
    this.runner = runner;
  }
  executable;
  runner;
  async command(args, input) {
    const value = await this.query(args, input);
    if (!isJsonObject(value)) throw new Error("Delta returned an invalid response");
    return value;
  }
  async query(args, input) {
    const result = await this.runner([this.executable, "--json", ...args], {
      input,
      timeout: args[0] === "update" ? 66e4 : 12e4,
      ...args[0] === "update" || args[0] === "auth" && args[1] === "login" ? {
        onStderr: (text2) => {
          process.stderr.write(text2);
        }
      } : {}
    });
    let value;
    try {
      value = JSON.parse(result.stdout);
    } catch {
      throw new Error(
        `Delta ${args.slice(0, 2).join(" ")} returned invalid JSON: ${result.stderr.slice(-1e3)}`
      );
    }
    const error = isJsonObject(value) ? commandErrorFromEnvelope(value.error) : void 0;
    if (error) throw error;
    if (result.code !== 0)
      throw new DeltaCommandError("process_failed", result.stderr || `Delta exited ${result.code}`, {
        retryable: true
      });
    return value;
  }
  async contract() {
    const range = parseThreadContract(JSON.stringify(await this.command(["thread", "contract"])));
    const refusal = contractRefusal(range);
    if (refusal) throw new Error(refusal);
    return contractVersion(range);
  }
  async status(reference, session) {
    return parseThreadStatus(
      JSON.stringify(
        await this.command(["thread", "status", reference, "--source", SOURCE, "--external-id", session])
      )
    );
  }
  async append(reference, session, local, input) {
    try {
      return await this.runner(
        [
          this.executable,
          "--json",
          "thread",
          "append",
          reference,
          "--source",
          SOURCE,
          "--external-id",
          session,
          "--producer-name",
          PRODUCER_NAME,
          ...local ? ["--acknowledge", "local"] : []
        ],
        { input }
      );
    } catch (error) {
      throw new DeltaCommandError("process_failed", String(error), { retryable: true });
    }
  }
  watch(reference, session, onLine) {
    return stream(
      [
        this.executable,
        "--json",
        "thread",
        "watch",
        reference,
        "--source",
        SOURCE,
        "--external-id",
        session,
        "--participate",
        PRODUCER_NAME
      ],
      onLine
    );
  }
  async mount(args) {
    const process2 = stream([this.executable, "--json", ...args]);
    try {
      const value = await deadline(process2.ready, 12e4, "Delta mount");
      if (!isJsonObject(value)) throw new Error("Invalid mount response");
      const error = commandErrorFromEnvelope(value.error);
      if (error) throw error;
      if (value.operation !== "mounted") throw new Error("Delta did not confirm the mount");
      return { value, process: process2 };
    } catch (error) {
      await process2.stop();
      throw error;
    }
  }
};

// src/codex/rpc.ts
import { spawn as spawn2 } from "node:child_process";
import { createInterface as createInterface2 } from "node:readline";
import { EventEmitter } from "node:events";
var RpcError = class extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
  code;
};
var Codex = class extends EventEmitter {
  constructor(argv = [process.env.DELTA_CODEX_CODEX_BIN || "codex", "app-server", "proxy"], environment = {}) {
    super();
    this.argv = argv;
    this.environment = environment;
  }
  argv;
  environment;
  child;
  opening;
  next = 0;
  pending = /* @__PURE__ */ new Map();
  done = Promise.resolve();
  stderr = "";
  requests = /* @__PURE__ */ new Map();
  async connect() {
    if (this.opening) return this.opening;
    this.opening = this.open();
    try {
      await this.opening;
    } catch (error) {
      this.opening = void 0;
      throw error;
    }
  }
  async open() {
    const child = this.child = spawn2(this.argv[0], this.argv.slice(1), {
      stdio: "pipe",
      windowsHide: true,
      shell: false,
      env: { ...process.env, ...this.environment }
    });
    const lines = createInterface2({ input: child.stdout });
    child.stdin.on("error", () => {
    });
    child.stderr.on("data", (chunk) => {
      this.stderr = (this.stderr + chunk.toString()).slice(-2e3);
    });
    let length = 0;
    child.stdout.on("data", (chunk) => {
      const last = chunk.lastIndexOf(10);
      length = last < 0 ? length + chunk.length : chunk.length - last - 1;
      if (length > MAX_FRAME) child.kill();
    });
    lines.on("line", (line) => {
      try {
        if (line.length > MAX_FRAME) throw new Error("Oversize Codex frame");
        const message = JSON.parse(line);
        if ("id" in message && !message.method) {
          const request2 = this.pending.get(message.id);
          if (request2) {
            this.pending.delete(message.id);
            clearTimeout(request2.timer);
            message.error ? request2.reject(new RpcError(message.error.code, message.error.message)) : request2.resolve(message.result);
          }
        } else if ("id" in message) {
          this.requests.set(String(message.id), message);
          if (this.listenerCount("request")) this.emit("request", message);
          else this.respond(String(message.id), void 0, "No interactive approval handler is attached");
        } else this.emit("notification", message);
      } catch (error) {
        this.emit("diagnostic", String(error));
        child.kill();
      }
    });
    this.done = new Promise((resolve2) => {
      const closed = () => {
        for (const request2 of this.pending.values()) {
          clearTimeout(request2.timer);
          request2.reject(new Error(`Codex daemon disconnected. ${this.stderr}`));
        }
        this.pending.clear();
        this.requests.clear();
        this.opening = void 0;
        this.child = void 0;
        lines.close();
        resolve2();
      };
      child.once("error", closed);
      child.once("close", closed);
    });
    await this.request(
      "initialize",
      {
        clientInfo: { name: "delta_codex", title: "Delta for Codex", version: "0.1.0" },
        capabilities: { experimentalApi: true }
      },
      1e4
    );
    this.send({ method: "initialized", params: {} });
  }
  send(value) {
    if (!this.child?.stdin.writable)
      throw new Error("Codex daemon is not connected. Start Codex with its shared daemon enabled.");
    this.child.stdin.write(JSON.stringify(value) + "\n");
  }
  request(method, params, timeout) {
    return new Promise((resolve2, reject) => {
      const id = ++this.next;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Codex ${method} timed out`));
      }, timeout);
      this.pending.set(id, { resolve: resolve2, reject, timer });
      try {
        this.send({ id, method, params });
      } catch (error) {
        this.pending.delete(id);
        clearTimeout(timer);
        reject(error);
      }
    });
  }
  async call(method, params, timeout = 3e4) {
    await this.connect();
    return this.request(method, params, timeout);
  }
  respond(id, result, error) {
    const request2 = this.requests.get(id);
    if (!request2) throw new Error("This Codex approval request is no longer pending");
    this.send(
      error ? { id: request2.id, error: { code: -32601, message: error } } : { id: request2.id, result }
    );
    this.requests.delete(id);
  }
  async close() {
    if (this.child) await terminate(this.child, this.done);
  }
};
async function history(rpc, threadId, throughTurn) {
  const turns = [], cursors = /* @__PURE__ */ new Set();
  let cursor;
  try {
    do {
      const page = await rpc.call("thread/turns/list", {
        threadId,
        cursor,
        limit: throughTurn ? 20 : 100,
        sortDirection: throughTurn ? "desc" : "asc",
        itemsView: "full"
      });
      if (!Array.isArray(page.data)) throw new Error("Invalid Codex turn history");
      for (const turn of page.data) {
        if (turn.itemsView !== "full") {
          turn.items = [];
          let itemCursor;
          const seen = /* @__PURE__ */ new Set();
          do {
            const items = await rpc.call("thread/items/list", {
              threadId,
              turnId: turn.id,
              cursor: itemCursor,
              sortDirection: "asc",
              limit: 100
            });
            if (!Array.isArray(items.data)) throw new Error("Invalid Codex item history");
            turn.items.push(...items.data.map((entry) => entry.item));
            itemCursor = items.nextCursor ?? void 0;
            if (itemCursor && seen.has(itemCursor)) throw new Error("Codex repeated an item cursor");
            if (itemCursor) seen.add(itemCursor);
          } while (itemCursor);
        }
        turns.push(turn);
        if (throughTurn && turn.id === throughTurn) return turns.reverse();
      }
      cursor = page.nextCursor ?? void 0;
      if (cursor && cursors.has(cursor)) throw new Error("Codex repeated a turn cursor");
      if (cursor) cursors.add(cursor);
    } while (cursor);
    return throughTurn ? turns.reverse() : turns;
  } catch (error) {
    if (!(error instanceof RpcError) || ![-32601, -32600].includes(error.code)) throw error;
    const value = await rpc.call("thread/read", { threadId, includeTurns: true });
    if (!Array.isArray(value.thread?.turns)) throw new Error("Codex cannot provide this session history");
    return value.thread.turns;
  }
}

// src/core/storage.ts
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, rename, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
var digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
var dataDirectory = () => process.env.DELTA_CODEX_HOME || join(process.env.CODEX_HOME || join(homedir(), ".codex"), "delta");
async function atomicJson(path, value) {
  await mkdir(dirname(path), { recursive: true, mode: 448 });
  const temp = `${path}.${randomUUID()}.tmp`;
  const file = await open(temp, "wx", 384);
  try {
    await file.writeFile(JSON.stringify(value) + "\n");
    await file.sync();
  } finally {
    await file.close();
  }
  try {
    await rename(temp, path);
    if (process.platform !== "win32") {
      const directory = await open(dirname(path), "r");
      try {
        await directory.sync();
      } finally {
        await directory.close();
      }
    }
  } finally {
    await unlink(temp).catch(() => {
    });
  }
}
async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    if (error.code === "ENOENT") return void 0;
    throw error;
  }
}
var Serial = class {
  tail = Promise.resolve();
  run(work) {
    const next = this.tail.then(work);
    this.tail = next.catch(() => {
    });
    return next;
  }
};

// src/ipc.ts
import { createServer, createConnection } from "node:net";
import { mkdir as mkdir3, chmod, unlink as unlink2, open as open3, stat as stat2, lstat } from "node:fs/promises";
import { join as join4 } from "node:path";
import { tmpdir } from "node:os";
import { spawn as spawn3 } from "node:child_process";
import { randomBytes, timingSafeEqual } from "node:crypto";

// src/bridge.ts
import { randomUUID as randomUUID2 } from "node:crypto";

// src/recording/store.ts
import { join as join2 } from "node:path";
function freshBinding(input) {
  return {
    ...input,
    version: 1,
    next: 1,
    pending: [],
    seen: {},
    turns: {},
    ledger: { thread: input.thread, items: {} },
    failures: 0,
    created: (/* @__PURE__ */ new Date()).toISOString()
  };
}
function stage(state, update, turnSequence) {
  if (!Number.isSafeInteger(state.next) || state.next < 1 || state.next >= Number.MAX_SAFE_INTEGER)
    throw new Error("Invalid sequence frontier");
  const record = {
    schemaVersion: 1,
    sequence: state.next++,
    ...turnSequence ? { turnSequence } : {},
    update
  };
  state.pending.push(record);
  return record.sequence;
}
var Recording = class _Recording {
  constructor(path, state) {
    this.path = path;
    this.state = state;
  }
  path;
  state;
  serial = new Serial();
  static path(directory, session) {
    return join2(directory, "sessions", digest(session) + ".json");
  }
  static async load(directory, session) {
    const path = this.path(directory, session), value = await readJson(path);
    if (!value) return void 0;
    validateBinding(value, session);
    return new _Recording(path, value);
  }
  async change(fn) {
    return this.serial.run(async () => {
      const draft = structuredClone(this.state), result = await fn(draft);
      await atomicJson(this.path, draft);
      this.state = draft;
      return result;
    });
  }
  async reconcile(delta) {
    const state = await delta.status(this.state.reference, this.state.session);
    validateThreadFrontier(state, this.state);
    return state;
  }
  async begin(turn) {
    await this.change((state) => {
      if (state.turns[turn]?.superseded)
        throw new Error("This turn was taken over in Delta. Send a new prompt to take another turn.");
      if (!state.turns[turn])
        state.turns[turn] = {
          sequence: stage(state, { sessionUpdate: "state_update", state: "running" }, state.next)
        };
      state.active = turn;
    });
  }
  async finish(turn, reason = "end_turn") {
    await this.change((state) => {
      const saved = state.turns[turn];
      if (saved && !saved.finished) {
        stage(state, { sessionUpdate: "state_update", state: "idle", stopReason: reason }, saved.sequence);
        saved.finished = true;
      }
      if (state.active === turn) delete state.active;
    });
  }
  /** Valid receipts can precede a failed batch. Persist only that acknowledged prefix. */
  async drain(delta, onFenced) {
    const fenced = [];
    await this.serial.run(async () => {
      const state = structuredClone(this.state);
      if (!state.pending.length || state.paused || (state.retryAt ?? 0) > Date.now()) return;
      let bytes = 0;
      const batch = [];
      for (const record of state.pending) {
        const size = Buffer.byteLength(JSON.stringify(record));
        if (batch.length && (bytes + size > 1024 * 1024 || batch.length >= 128)) break;
        bytes += size;
        batch.push(record);
      }
      let failure;
      try {
        const result = await delta.append(
          state.reference,
          state.session,
          state.kind !== "join",
          batch.map((r) => JSON.stringify(r)).join("\n") + "\n"
        );
        const lines = result.stdout.trim().split("\n").filter(Boolean);
        let count = 0;
        for (const line of lines) {
          if (count >= batch.length)
            throw new DeltaCommandError("invalid_acknowledgment", "Unexpected extra append receipt");
          const record = batch[count];
          let receipt;
          try {
            receipt = parseAppendReceipt(line, state.thread, record.sequence);
          } catch {
            throw commandErrorFromOutput(line) ?? new DeltaCommandError("invalid_acknowledgment", "Malformed append receipt; no delivery assumed");
          }
          if (receipt.turn_sequence !== (record.turnSequence ?? null))
            throw new DeltaCommandError("invalid_acknowledgment", "Append receipt names a different turn");
          if (receipt.disposition === "fenced") {
            for (const [id, turn] of Object.entries(state.turns))
              if (turn.sequence === record.turnSequence && !turn.superseded) {
                turn.superseded = true;
                fenced.push(id);
              }
          }
          state.pending.shift();
          count++;
        }
        if (result.code !== 0 || count !== batch.length)
          throw appendFailure(result.stdout, result.stderr, result.code);
        state.failures = 0;
        delete state.retryAt;
      } catch (error) {
        failure = error;
      }
      if (failure) {
        const message = failure instanceof Error ? failure.message : String(failure);
        if (classifyCommandFailure(failure) === "transient") {
          state.failures++;
          const delay = failure instanceof DeltaCommandError ? failure.hints.retryAfterMs : void 0;
          state.retryAt = Date.now() + Math.max(delay ?? 0, Math.min(6e4, 500 * 2 ** Math.min(state.failures, 7)));
        } else state.paused = message;
      }
      await atomicJson(this.path, state);
      this.state = state;
    });
    for (const turn of fenced) await onFenced(turn);
  }
};
function validateBinding(value, session) {
  if (value.version !== 1 || value.session !== session || typeof value.thread !== "string" || typeof value.reference !== "string" || !Number.isSafeInteger(value.next) || value.next < 1 || !Array.isArray(value.pending) || !value.seen || !value.turns || !value.ledger)
    throw new Error(
      "Invalid saved Delta state. Preserve it for recovery; do not reset this session\u2019s sequence."
    );
  let previous = value.pending[0]?.sequence ?? value.next;
  for (const record of value.pending) {
    if (record.schemaVersion !== 1 || record.sequence !== previous++ || record.sequence >= value.next || !record.update?.sessionUpdate)
      throw new Error("Corrupt Delta outbox. Preserve it for recovery; start a new Codex session.");
  }
  if (previous !== value.next) throw new Error("Delta outbox has a sequence gap");
}

// src/recording/translate.ts
var REMOTE_PREFIX = "[Delta collaboration context";
var text = (value) => ({ type: "text", text: jsonText(value) });
var content = (value) => ({ type: "content", content: text(value) });
function translate(item, parent) {
  const id = String(item.id);
  switch (item.type) {
    case "userMessage": {
      const blocks = (item.content ?? []).map((part) => {
        if (part.type === "text") return text(part.text);
        if (part.type === "image" && typeof part.url === "string") {
          const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-zA-Z0-9+/=]+)$/.exec(part.url);
          if (match) return { type: "image", mimeType: match[1], data: match[2] };
        }
        return text(part);
      });
      if (blocks.some((b) => b.type === "text" && b.text.startsWith(REMOTE_PREFIX))) return [];
      return [
        {
          sessionUpdate: "user_message",
          messageId: id,
          content: blocks,
          ...parent ? { _meta: { delta: { sender: { external_id: parent } } } } : {}
        }
      ];
    }
    case "agentMessage":
      if (item.text?.startsWith(REMOTE_PREFIX)) return [];
      return [{ sessionUpdate: "agent_message", messageId: id, content: [text(item.text ?? "")] }];
    case "reasoning": {
      const visible = [...item.summary ?? [], ...item.content ?? []].filter(
        (s) => typeof s === "string"
      );
      return visible.length ? [{ sessionUpdate: "agent_thought", messageId: id, content: visible.map(text) }] : [];
    }
    case "plan":
      return [{ sessionUpdate: "agent_message", messageId: id, content: [text(item.text)] }];
    case "commandExecution":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: item.command,
          kind: "execute",
          status: status(item.status),
          rawInput: { command: item.command, cwd: item.cwd },
          rawOutput: { exitCode: item.exitCode, output: item.aggregatedOutput },
          content: item.aggregatedOutput ? [content(item.aggregatedOutput)] : []
        }
      ];
    case "fileChange":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "Apply patch",
          kind: "edit",
          status: status(item.status),
          rawInput: item.changes,
          locations: (item.changes ?? []).map((c) => ({ path: c.path })),
          content: (item.changes ?? []).map((c) => ({
            type: "diff",
            changes: [
              {
                path: c.path,
                operation: c.kind?.type === "add" ? "add" : c.kind?.type === "delete" ? "delete" : "modify"
              }
            ],
            patch: { format: "git_patch", text: c.diff }
          }))
        }
      ];
    case "mcpToolCall":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: `${item.server}/${item.tool}`,
          kind: "other",
          status: status(item.status),
          rawInput: item.arguments,
          rawOutput: item.result ?? item.error,
          content: item.result || item.error ? [content(item.result ?? item.error)] : []
        }
      ];
    case "dynamicToolCall":
    case "collabAgentToolCall":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: item.tool,
          kind: "other",
          status: status(item.status),
          rawInput: item.arguments ?? { prompt: item.prompt, receivers: item.receiverThreadIds },
          rawOutput: item.contentItems ?? item.agentsStates
        }
      ];
    case "functionCallOutput":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: item.name,
          kind: "other",
          status: "completed",
          rawOutput: item.output,
          content: [content(item.output)]
        }
      ];
    case "webSearch":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "Web search",
          kind: "search",
          status: "completed",
          rawInput: item.action ?? item.query
        }
      ];
    case "imageView":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "View image",
          kind: "read",
          status: "completed",
          rawInput: { path: item.path }
        }
      ];
    case "imageGeneration":
      return [
        {
          sessionUpdate: "tool_call_update",
          toolCallId: id,
          title: "Generate image",
          kind: "other",
          status: status(item.status),
          rawOutput: item.result ?? item.revisedPrompt
        }
      ];
    case "enteredReviewMode":
    case "exitedReviewMode":
      return [{ sessionUpdate: "agent_message", messageId: id, content: [text(item.review)] }];
    // Compaction and hook framing aren't user conversation. Future item types are deliberately skipped.
    default:
      return [];
  }
}
function status(value) {
  return ["failed", "declined", "cancelled"].includes(value) ? "failed" : value === "inProgress" ? "in_progress" : "completed";
}
function recordTurns(state, turns) {
  const children = /* @__PURE__ */ new Set();
  for (const turn of turns) {
    if (turn.status === "inProgress" && !state.turns[turn.id]) {
      state.turns[turn.id] = {
        sequence: stage(state, { sessionUpdate: "state_update", state: "running" }, state.next)
      };
      state.active = turn.id;
    }
    const sequence = state.turns[turn.id]?.sequence;
    for (const item of turn.items ?? []) {
      if (item.type === "collabAgentToolCall" && ["spawnAgent", "spawn_agent"].includes(item.tool))
        for (const child of item.receiverThreadIds ?? []) children.add(child);
      if (item.type === "subAgentActivity" && item.agentThreadId) children.add(item.agentThreadId);
      const updates = translate(item, state.parent);
      const key = `${turn.id}:${item.id}`, fingerprint2 = digest(updates);
      if (state.seen[key] === fingerprint2) continue;
      for (const update of updates) stage(state, update, sequence);
      state.seen[key] = fingerprint2;
    }
    if (turn.status !== "inProgress" && state.turns[turn.id] && !state.turns[turn.id].finished) {
      stage(
        state,
        {
          sessionUpdate: "state_update",
          state: "idle",
          stopReason: turn.status === "completed" ? "end_turn" : "cancelled"
        },
        sequence
      );
      state.turns[turn.id].finished = true;
      if (state.active === turn.id) delete state.active;
    }
  }
  return [...children];
}

// src/recording/images.ts
import { open as open2, stat } from "node:fs/promises";
var MAX_IMAGE = 20 * 1024 * 1024;
var Images = class {
  cache = /* @__PURE__ */ new Map();
  bytes = 0;
  async materialize(turns) {
    const result = structuredClone(turns);
    for (const turn of result)
      for (const item of turn.items ?? []) {
        if (item.type !== "userMessage" || !Array.isArray(item.content)) continue;
        item.content = await Promise.all(
          item.content.map(async (part) => {
            if (part.type !== "localImage" || typeof part.path !== "string") return part;
            try {
              return { type: "image", url: await this.load(part.path) };
            } catch (error) {
              return {
                type: "text",
                text: `[Image attachment: ${part.path}; not embedded: ${error instanceof Error ? error.message : String(error)}]`
              };
            }
          })
        );
      }
    return result;
  }
  async load(path) {
    const info = await stat(path);
    if (!info.isFile() || info.size > MAX_IMAGE) throw new Error("requires an image file of at most 20 MiB");
    const stamp = `${info.size}:${info.mtimeMs}`, cached = this.cache.get(path);
    if (cached?.stamp === stamp) return cached.url;
    const file = await open2(path, "r");
    let buffer;
    try {
      const data = Buffer.alloc(Math.min(info.size + 1, MAX_IMAGE + 1));
      let length = 0;
      while (length < data.length) {
        const read = await file.read(data, length, data.length - length, length);
        if (!read.bytesRead) break;
        length += read.bytesRead;
      }
      if (length > MAX_IMAGE) throw new Error("image grew beyond 20 MiB");
      buffer = data.subarray(0, length);
    } finally {
      await file.close();
    }
    const mime = imageMime(buffer);
    if (!mime) throw new Error("unsupported or invalid image signature");
    const url = `data:${mime};base64,${buffer.toString("base64")}`;
    if (cached) {
      this.bytes -= cached.bytes;
      this.cache.delete(path);
    }
    while (this.bytes + buffer.length > 40 * 1024 * 1024 && this.cache.size) {
      const oldest = this.cache.keys().next().value;
      this.bytes -= this.cache.get(oldest).bytes;
      this.cache.delete(oldest);
    }
    this.cache.set(path, { stamp, url, bytes: buffer.length });
    this.bytes += buffer.length;
    return url;
  }
};
function imageMime(data) {
  if (data.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return "image/png";
  if (data[0] === 255 && data[1] === 216 && data[2] === 255) return "image/jpeg";
  if (["GIF87a", "GIF89a"].includes(data.subarray(0, 6).toString())) return "image/gif";
  if (data.subarray(0, 4).toString() === "RIFF" && data.subarray(8, 12).toString() === "WEBP")
    return "image/webp";
}

// src/core/text.ts
function cutsSurrogatePair(text2, index) {
  return /[\uD800-\uDBFF]/.test(text2.charAt(index - 1));
}

// src/watch/conversation.ts
var MESSAGE_KINDS = /* @__PURE__ */ new Set(["user_message", "agent_message", "cross_agent_message"]);
var THOUGHT_KIND = "agent_thought";
var SECTION_LIMIT = 8e3;
var ROW_LIMIT = 24e3;
var DISPLAY_LIMIT = 2e3;
var TOOL_LINE_LIMIT = 200;
var TOOL_NAME_LIMIT = 60;
var SNAPSHOT_TAIL = 5;
var SNAPSHOT_BUDGET = 4e5;
function conversationText(text2) {
  return text2.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0008\u000b-\u001f\u007f-\u009f]/g, "");
}
function itemText(item) {
  return typeof item.content.text === "string" ? item.content.text : void 0;
}
function itemAuthor(item) {
  const name = conversationText(item.author?.name ?? "").trim();
  if (name) return name;
  return item.kind === "user_message" ? "Someone in Delta" : "Delta agent";
}
function isMessageItem(item) {
  return MESSAGE_KINDS.has(item.kind) && !!itemText(item)?.trim();
}
function isEventItem(item) {
  return (item.kind === "subthread_event" || item.kind === "land_result") && !!itemText(item)?.trim();
}
function isDrawnItem(item) {
  return isMessageItem(item) || isEventItem(item) || item.kind === "tool_call";
}
function isThoughtItem(item) {
  return item.kind === THOUGHT_KIND && !!itemText(item)?.trim();
}
function itemDisplay(item, thread) {
  if (item.kind === "tool_call") return toolCallDisplay(item);
  if (isEventItem(item)) return personLines("Delta activity:", personParagraphs(eventText(item)), thread);
  const paragraphs = personParagraphs(itemText(item) ?? "");
  if (!paragraphs.length) return;
  if (isThoughtItem(item)) return personLines(`${itemAuthor(item)} (thinking)`, paragraphs, thread);
  if (isMessageItem(item)) return personLines(`${itemAuthor(item)}:`, paragraphs, thread);
}
function personParagraphs(text2) {
  return conversationText(text2).split(/\n\s*\n+/).map((part) => withoutMarkdown(part).replace(/\s+/g, " ").trim()).filter(Boolean);
}
function eventText(item) {
  const text2 = itemText(item) ?? "";
  return (text2.split(/\n<(?:subthread-event|review-thread-event)\b/, 1)[0] ?? "").trim().replace(/:$/, "");
}
function withoutMarkdown(text2) {
  return text2.replace(/^(\s*)#{1,6}\s+/gm, "$1").replace(/\*\*|__|`/g, "").replace(/(^|[\s(])[*_](?=\S)/g, "$1").replace(/(\S)[*_](?=$|[\s.,;:!?)])/g, "$1").replace(/^\s*[-*+]\s+/gm, "\u2022 ").replace(/^\s*>\s?/gm, "");
}
function personLines(label, paragraphs, thread) {
  return [label, ...paragraphs.map((paragraph) => clipWithNote(paragraph, DISPLAY_LIMIT, thread))].join("\n");
}
function readMoreNote(omitted, thread) {
  return ` [\u2026 ${omitted} more characters; read with \`delta thread show ${thread} --format messages --messages 1-20\`]`;
}
function clipWithNote(text2, limit, thread) {
  if (text2.length <= limit) return text2;
  let end = Math.max(0, limit - readMoreNote(text2.length, thread).length);
  if (end < 1) return readMoreNote(text2.length, thread).trim();
  if (cutsSurrogatePair(text2, end)) end--;
  return text2.slice(0, end) + readMoreNote(text2.length - end, thread);
}
function toolCallDisplay(item) {
  const { name, detail, status: status2 } = toolCallParts(item);
  const fixed = `${itemAuthor(item)}: ${name}${status2 ? ` (${status2})` : ""}`;
  const shown = detail ? middleTruncate(detail, TOOL_LINE_LIMIT - fixed.length - 3) : "";
  return `${itemAuthor(item)}: ${name}${shown ? ` \xB7 ${shown}` : ""}${status2 ? ` (${status2})` : ""}`;
}
function toolName(tool) {
  return [tool.title, tool.name].find((value) => typeof value === "string" && !!value.trim()) ?? "tool";
}
function toolCallParts(item) {
  const tool = item.content;
  const status2 = typeof tool.status === "string" && tool.status !== "completed" ? singleLine(tool.status) : void 0;
  const title = singleLine(toolName(tool));
  const input = toolInput(tool.rawInput);
  const detail = input && !describesInput(title, input) ? input : void 0;
  return { name: middleTruncate(title, TOOL_NAME_LIMIT), detail, status: status2 };
}
function describesInput(title, input) {
  return title.includes(input) || title.split(" ").some((word) => word.includes("/") && input.endsWith(`/${word}`));
}
function middleTruncate(text2, width) {
  if (text2.length <= width) return text2;
  if (width < 3) return "";
  let head = Math.floor((width - 1) * 0.4);
  let tail = width - 1 - head;
  if (cutsSurrogatePair(text2, head)) head--;
  if (/[\uDC00-\uDFFF]/.test(text2.charAt(text2.length - tail))) tail--;
  return `${text2.slice(0, head)}\u2026${text2.slice(text2.length - tail)}`;
}
function toolInput(input) {
  if (input === void 0 || input === null) return;
  if (typeof input === "string") return singleLine(input) || void 0;
  if (isJsonObject(input))
    for (const field of ["command", "file_path", "path", "pattern", "query", "url"]) {
      const value = input[field];
      if (typeof value === "string" && value.trim()) return singleLine(value);
    }
  return singleLine(jsonText(input));
}
function singleLine(text2) {
  return conversationText(text2).replace(/\s+/g, " ").trim();
}
async function fingerprint(value) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify(value)));
  return Array.from(new Uint8Array(bytes).subarray(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join(
    ""
  );
}
async function itemFingerprint(item) {
  return fingerprint({ kind: item.kind, content: item.content });
}
function renderItem(item, thread, edited = false) {
  if (item.kind === "unknown" || item.kind === THOUGHT_KIND) return;
  const clip = (text2, limit) => clipForModel(text2, limit, thread);
  let label;
  let body;
  if (item.kind === "tool_call") {
    const tool = item.content;
    label = `tool call ${middleTruncate(singleLine(toolName(tool)), TOOL_LINE_LIMIT)}${typeof tool.status === "string" ? ` (${tool.status})` : ""}`;
    const sections = [];
    if (tool.rawInput !== void 0) sections.push(`Input: ${clip(jsonText(tool.rawInput), 2e3)}`);
    for (const entry of Array.isArray(tool.content) ? tool.content.filter(isJsonObject) : []) {
      if (entry.type === "diff") {
        const patch = typeof entry.patch === "string" ? entry.patch : typeof entry.newText === "string" ? entry.newText : "";
        sections.push(
          `Changed ${typeof entry.path === "string" ? entry.path : "a file"}:
${clip(patch, SECTION_LIMIT)}`
        );
      } else if (entry.type === "terminal")
        sections.push(`Terminal ${typeof entry.terminalId === "string" ? entry.terminalId : ""}`.trim());
      else if (entry.type === "content") {
        const block = entry.content;
        sections.push(
          clip(
            isJsonObject(block) && block.type === "text" && typeof block.text === "string" ? block.text : jsonText(block),
            SECTION_LIMIT
          )
        );
      }
    }
    if (tool.rawOutput !== void 0 && tool.rawOutput !== null)
      sections.push(`Output:
${clip(jsonText(tool.rawOutput), SECTION_LIMIT)}`);
    body = sections.join("\n");
  } else {
    label = item.kind.replace(/_/g, " ");
    const text2 = itemText(item);
    const details = Object.fromEntries(
      Object.entries(item.content).filter(([key]) => text2 === void 0 || key !== "text")
    );
    body = [text2, Object.keys(details).length ? clip(jsonText(details), SECTION_LIMIT) : void 0].filter((part) => part !== void 0).join("\n");
  }
  body = conversationText(body).trim();
  if (!body) return;
  const header = edited ? `[Delta] ${itemAuthor(item)} changed an earlier ${label} (item ${item.id}); it now reads:` : `[Delta] ${itemAuthor(item)}, ${label} (item ${item.id}):`;
  return clip(`${header}
${body}`, ROW_LIMIT);
}
function earlierItemsNotice(count, thread, omitted = 0) {
  const items = `${count} earlier item${count === 1 ? "" : "s"}`;
  const where = omitted >= count ? `${count === 1 ? "is" : "are"} not shown here or in Codex's context` : omitted ? `${count === 1 ? "is" : "are"} not shown here, and the oldest ${omitted} ${omitted === 1 ? "is" : "are"} not in Codex's context either` : `${count === 1 ? "is" : "are"} in Codex's context but not shown here`;
  return `Continuing a Delta thread: ${items} ${where}. Read them with \`delta thread show ${thread} --format messages --messages 1-20\`.`;
}
function omittedItemsRow(count, thread) {
  return `[Delta] ${count} earlier item${count === 1 ? "" : "s"} of this shared thread (messages, tool calls and comments) ${count === 1 ? "was" : "were"} left out of your context to save room; the newest ones follow. If you need them, read them with \`delta thread show ${thread} --format messages --messages 1-20\`; messages are numbered from 1 across the whole thread, at most 20 per call; page forward (21-40, \u2026).`;
}
function removedItemRow(id, item) {
  return `[Delta] An earlier item (item ${id})${item ? ` from ${itemAuthor(item)}` : ""} was removed from the shared thread; disregard it.`;
}
function clipForModel(text2, limit, thread) {
  if (text2.length <= limit) return text2;
  const end = cutsSurrogatePair(text2, limit) ? limit - 1 : limit;
  return text2.slice(0, end) + `
[\u2026 ${text2.length - end} more characters not shown. Read the full text with \`delta thread show ${thread} --format messages --messages 1-20\`; messages are numbered from 1 across the whole thread, at most 20 per call; page forward (21-40, \u2026).]`;
}
function commentKey(id) {
  return `comment:${id}`;
}
function keyedComment(key) {
  return key.startsWith("comment:") ? key.slice("comment:".length) : void 0;
}
function commentAuthor(comment) {
  const creator = commentCreator(comment);
  const others = comment.co_authors.map((person) => conversationText(person.name ?? "").trim()).filter(Boolean);
  return [creator, ...others.filter((name) => name !== creator)].join(", ");
}
function commentCreator(comment) {
  return conversationText(comment.author.name ?? "").trim() || (comment.agent ? "Delta agent" : "Someone in Delta");
}
function commentContextLines(target) {
  if (target?.kind !== "file") return [];
  return target.regions.flatMap((region) => {
    const mark = region.status === "added" ? "+" : region.status === "deleted" ? "-" : " ";
    return conversationText(region.text).split("\n").map((line, index) => `${region.first_line + index} ${mark} ${line}`);
  });
}
async function commentFingerprint(comment, target) {
  const shown = target?.kind === "transcript" ? { ...target, item_id: null } : target ?? null;
  return fingerprint({
    text: comment.text,
    target: shown,
    chain: comment.chain,
    routed_to: comment.routed_to
  });
}
function renderComment(comment, target, thread, edited = false, parent) {
  const text2 = conversationText(comment.text).trim();
  if (!text2) return;
  const author = commentAuthor(comment);
  const reply = comment.chain !== comment.id;
  const label = reply ? "reply to a comment" : "comment";
  const header = edited ? `[Delta] ${author} changed an earlier ${label} (comment ${comment.id}); it now reads:` : `[Delta] ${author}, ${label} (comment ${comment.id}):`;
  const lines = [header];
  if (comment.routed_to) lines.push(`It was sent to the Delta subthread ${comment.routed_to}, not to you.`);
  lines.push("<comments>");
  if (target?.kind === "file") {
    lines.push(`  <file>${escapeMarkup(target.path)}</file>`);
    const context = commentContextLines(target).join("\n");
    if (context)
      lines.push("  <context>", clipForModel(escapeMarkup(context), SECTION_LIMIT, thread), "  </context>");
    if (target.selected)
      lines.push(
        `  <selected>${escapeMarkup(clipForModel(target.selected, SECTION_LIMIT, thread))}</selected>`
      );
  } else if (target?.kind === "transcript" && target.quote.trim()) {
    lines.push(
      `  <context><quote>${escapeMarkup(clipForModel(conversationText(target.quote).trim(), SECTION_LIMIT, thread))}</quote></context>`
    );
  }
  const answered = reply && parent ? conversationText(parent.text).trim() : "";
  if (answered)
    lines.push(
      `  <comment from="${escapeMarkup(commentAuthor(parent))}">${escapeMarkup(clipForModel(answered, SECTION_LIMIT, thread))}</comment>`
    );
  lines.push(`  <comment from="${escapeMarkup(author)}">${escapeMarkup(text2)}</comment>`, "</comments>");
  return clipForModel(lines.join("\n"), ROW_LIMIT, thread);
}
function removedCommentRow(id, comment) {
  return `[Delta] An earlier comment (comment ${id})${comment ? ` from ${commentAuthor(comment)}` : ""} was withdrawn from the shared thread; disregard it.`;
}
function escapeMarkup(text2) {
  return text2.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
var OMITTED = "omitted";
var OMITTED_ROW = "delta:omitted";
var RemoteView = class {
  constructor(thread, ledger, budget = SNAPSHOT_BUDGET) {
    this.thread = thread;
    this.ledger = ledger;
    this.budget = budget;
  }
  thread;
  ledger;
  budget;
  /** The thread's current items, in the order they first arrived. */
  items = /* @__PURE__ */ new Map();
  comments = /* @__PURE__ */ new Map();
  /** Whether the current connection's snapshot is complete. */
  snapshotDone = false;
  /** Snapshot items added since they were last announced together. */
  quietlyAdded = 0;
  unsettled = /* @__PURE__ */ new Map();
  /** Recent explicit removals survive reconnects, but not a session restart. Older IDs use the placeholder. */
  removed = /* @__PURE__ */ new Set();
  /** The snapshot's newest first-seen items, which alone are drawn for the person. */
  tail = /* @__PURE__ */ new Set();
  /** First-seen snapshot items not drawn, until the notice naming them is offered. */
  hidden = 0;
  /** How many of the hidden items are not in the model's context either. */
  hiddenOmitted = 0;
  /** First-seen snapshot items past the budget, which reach the model only as one row. */
  omitted = /* @__PURE__ */ new Set();
  /** The omitted items whose stand-in row has not been offered yet. */
  omitting = [];
  /** Start a connection's snapshot. */
  reset() {
    this.items = /* @__PURE__ */ new Map();
    this.comments = /* @__PURE__ */ new Map();
    this.unsettled.clear();
    this.deferred = void 0;
    this.snapshotDone = false;
    this.tail.clear();
    this.hidden = 0;
    this.hiddenOmitted = 0;
    this.omitted.clear();
    this.omitting = [];
  }
  upsert(item) {
    this.removed.delete(item.id);
    this.items.set(item.id, item);
    this.mark(item.id, { removed: false, quiet: !this.snapshotDone });
  }
  /** Apply `item.append`, returning the updated item. */
  appendText(id, text2) {
    const item = this.items.get(id);
    if (!item) throw new Error("Delta appended text to an unknown item");
    const updated = { ...item, content: { ...item.content, text: (itemText(item) ?? "") + text2 } };
    this.upsert(updated);
    return updated;
  }
  remove(id) {
    const last = this.items.get(id);
    this.items.delete(id);
    this.forget(id, last);
  }
  upsertComment(comment) {
    const key = commentKey(comment.id);
    this.removed.delete(key);
    this.comments.set(comment.id, comment);
    this.mark(key, { removed: false, quiet: !this.snapshotDone });
  }
  removeComment(id) {
    const last = this.comments.get(id);
    this.comments.delete(id);
    this.forget(commentKey(id), last);
  }
  /** Also queues the correction the model needs if it was shown the item or comment. */
  forget(key, last) {
    this.removed.delete(key);
    this.removed.add(key);
    if (this.removed.size > 4096) this.removed.delete(this.removed.values().next().value);
    this.mark(key, { removed: true, last, quiet: false });
  }
  /** The comment a reply answers, while this view holds it. */
  commentParent(comment) {
    return comment.after_id === null ? void 0 : this.comments.get(comment.after_id);
  }
  /** Only a chain's first comment carries the target. */
  commentTarget(comment) {
    return comment.chain === comment.id ? comment.target : this.comments.get(comment.chain)?.target;
  }
  /** Whether an item, or a comment by its key, was removed during this session. */
  wasRemoved(id) {
    return this.removed.has(id);
  }
  /**
   * End the snapshot; items the model was shown that it no longer has were removed meanwhile. Of the
   * items the model has not seen, only the newest within the budget reach its context, and only the
   * newest few of those are drawn for the person, so joining a long thread does not replay it.
   */
  endSnapshot() {
    this.snapshotDone = true;
    const unseen = [...this.unsettled].flatMap(([id, change]) => {
      if (!change.quiet || this.ledger.items[id] !== void 0) return [];
      const commentId = keyedComment(id);
      if (commentId !== void 0) {
        const comment = this.comments.get(commentId);
        const text3 = comment && renderComment(comment, this.commentTarget(comment), this.thread);
        return text3 === void 0 ? [] : [{ id, text: text3, drawn: true }];
      }
      const item = this.items.get(id);
      const text2 = item && !item.open ? renderItem(item, this.thread) : void 0;
      return text2 === void 0 ? [] : [{ id, text: text2, drawn: isDrawnItem(item) }];
    });
    let used = 0;
    let kept = unseen.length;
    while (kept > 0 && (kept === unseen.length || used + unseen[kept - 1].text.length <= this.budget))
      used += unseen[--kept].text.length;
    this.omitting = unseen.slice(0, kept).map(({ id }) => id);
    this.omitted = new Set(this.omitting);
    const drawn = unseen.filter((entry) => entry.drawn).map(({ id }) => id);
    this.tail = new Set(drawn.filter((id) => !this.omitted.has(id)).slice(-SNAPSHOT_TAIL));
    this.hidden = drawn.length - this.tail.size;
    this.hiddenOmitted = drawn.filter((id) => this.omitted.has(id)).length;
    for (const id of Object.keys(this.ledger.items)) {
      const commentId = keyedComment(id);
      if (commentId === void 0 ? !this.items.has(id) : !this.comments.has(commentId))
        this.mark(id, { removed: true, quiet: false });
    }
  }
  /**
   * Whether no row is needed now. A snapshot adds nothing until it is complete, since which of its
   * items are drawn depends on which are the newest.
   */
  get settled() {
    return !this.snapshotDone || this.unsettled.size === 0 && this.deferred === void 0;
  }
  /** A row taken for the model that had to wait before it was added; it is the next row. */
  deferred;
  /** Keep `row`, taken but not added because rows must wait now, as the next row. */
  defer(row) {
    this.deferred = row;
  }
  /**
   * The next row the model's context needs, oldest change first, or undefined when none is
   * needed yet. Open items wait for completion; a changed or removed item the model was shown gets a
   * correction row.
   */
  async nextRow() {
    const deferred = this.deferred;
    this.deferred = void 0;
    if (deferred) return deferred;
    if (this.snapshotDone && this.omitting.length) {
      const omits = this.omitting;
      this.omitting = [];
      return { id: OMITTED_ROW, text: omittedItemsRow(omits.length, this.thread), quiet: false, omits };
    }
    while (!this.settled) {
      const [id, change] = this.unsettled.entries().next().value;
      this.unsettled.delete(id);
      const known = this.ledger.items[id];
      if (known === OMITTED || this.omitted.has(id)) {
        if (known === OMITTED && change.removed) delete this.ledger.items[id];
        continue;
      }
      const commentId = keyedComment(id);
      if (commentId !== void 0) {
        const row = await this.commentRow(id, commentId, change, known);
        if (row) return row;
        continue;
      }
      const item = change.removed ? void 0 : this.items.get(id);
      if (!item) {
        if (change.removed && known !== void 0)
          return { id, text: removedItemRow(id, change.last), quiet: false };
        continue;
      }
      if (item.open) continue;
      const fingerprint2 = await itemFingerprint(item);
      if (fingerprint2 === known) continue;
      const text2 = renderItem(item, this.thread, known !== void 0);
      if (text2 === void 0) continue;
      const first = known === void 0;
      const quiet = first && change.quiet;
      const commandItem = first && isDrawnItem(item) && (!quiet || this.tail.has(id)) ? id : void 0;
      let announcement = first && !change.quiet && !commandItem ? itemDisplay(item, this.thread) : void 0;
      if (quiet && commandItem && this.hidden) {
        announcement = earlierItemsNotice(this.hidden, this.thread, this.hiddenOmitted);
        this.hidden = 0;
      }
      return { id, text: text2, fingerprint: fingerprint2, commandItem, quiet, announcement };
    }
  }
  async commentRow(key, id, change, known) {
    const comment = change.removed ? void 0 : this.comments.get(id);
    if (!comment) {
      return change.removed && known !== void 0 ? { id: key, text: removedCommentRow(id, change.last), quiet: false } : void 0;
    }
    const target = this.commentTarget(comment);
    const fingerprint2 = await commentFingerprint(comment, target);
    if (fingerprint2 === known) return;
    const text2 = renderComment(comment, target, this.thread, known !== void 0, this.commentParent(comment));
    if (text2 === void 0) return;
    const first = known === void 0;
    const quiet = first && change.quiet;
    const commandItem = first && (!quiet || this.tail.has(key)) ? key : void 0;
    let announcement;
    if (quiet && commandItem && this.hidden) {
      announcement = earlierItemsNotice(this.hidden, this.thread, this.hiddenOmitted);
      this.hidden = 0;
    }
    return { id: key, text: text2, fingerprint: fingerprint2, commandItem, quiet, announcement };
  }
  /** Record that a row was added to Codex's context. */
  commit(row) {
    for (const id of row.omits ?? []) this.ledger.items[id] = OMITTED;
    if (row.fingerprint) this.ledger.items[row.id] = row.fingerprint;
    else delete this.ledger.items[row.id];
  }
  mark(id, change) {
    this.unsettled.delete(id);
    this.unsettled.set(id, change);
  }
};

// src/settings.ts
import { join as join3, isAbsolute } from "node:path";
import { readFile as readFile2, appendFile, mkdir as mkdir2 } from "node:fs/promises";
var NotRepositoryError = class extends Error {
};
async function repository(cwd) {
  const result = await run(["git", "-C", cwd, "rev-parse", "--show-toplevel"]);
  if (result.code !== 0)
    throw new NotRepositoryError(
      "Delta needs a Git checkout. Start Codex inside the repository to share its files."
    );
  return result.stdout.trim();
}
async function readPolicy(cwd) {
  const root = await repository(cwd);
  const value = await readJson(join3(root, ".delta", "settings.json"));
  if (!value) return { mode: "manual" };
  const threads = value.threads;
  if (!threads || !["manual", "private", "organization"].includes(threads.mode) || threads.mode !== "manual" && (typeof threads.organization !== "string" || !threads.organization.trim()))
    throw new Error(
      "Invalid .delta/settings.json: threads.mode must be manual, private or organization; automatic modes need threads.organization. Automatic syncing is disabled."
    );
  return { mode: threads.mode, organization: threads.organization };
}
async function writePolicy(cwd, policy) {
  if (!["manual", "private", "organization"].includes(policy.mode) || policy.mode !== "manual" && !policy.organization?.trim())
    throw new Error("Choose a mode and an organization ID for automatic sync");
  const root = await repository(cwd);
  const tracked = await run(["git", "-C", root, "ls-files", "--", ".delta/settings.json"]);
  if (tracked.stdout.trim())
    throw new Error(
      ".delta/settings.json is tracked by Git. Untrack it before saving a personal automatic-sharing policy."
    );
  const excludeResult = await run(["git", "-C", root, "rev-parse", "--git-path", "info/exclude"]);
  if (excludeResult.code !== 0) throw new Error("Cannot locate Git\u2019s local exclude file");
  const exclude = isAbsolute(excludeResult.stdout.trim()) ? excludeResult.stdout.trim() : join3(root, excludeResult.stdout.trim());
  const current = await readFile2(exclude, "utf8").catch((error) => {
    if (error.code === "ENOENT") return "";
    throw error;
  });
  if (!current.split("\n").includes("/.delta/")) {
    await mkdir2(join3(exclude, ".."), { recursive: true });
    await appendFile(exclude, `${current.endsWith("\n") || !current ? "" : "\n"}/.delta/
`);
  }
  const path = join3(root, ".delta", "settings.json"), previous = await readJson(path);
  await atomicJson(path, { ...previous, threads: policy });
  return { root, policy };
}

// src/bridge.ts
var Bridge = class {
  constructor(directory, delta = new Delta(), codex = new Codex()) {
    this.directory = directory;
    this.delta = delta;
    this.codex = codex;
    if (codex instanceof Codex)
      codex.on("request", (request2) => {
        if (!this.runs.has(request2.params?.threadId)) codex.requests.delete(String(request2.id));
      });
  }
  directory;
  delta;
  codex;
  sessions = /* @__PURE__ */ new Map();
  metadata = /* @__PURE__ */ new Map();
  commands = new Serial();
  timer;
  initializing = /* @__PURE__ */ new Map();
  runs = /* @__PURE__ */ new Set();
  images = new Images();
  notices = /* @__PURE__ */ new Map();
  async start() {
    try {
      const loaded = await this.codex.call("thread/loaded/list", {});
      for (const id of loaded.data ?? []) {
        const saved = await Recording.load(this.directory, id);
        if (saved && !saved.state.stopped) await this.activate(saved).catch(() => {
        });
      }
    } catch {
    }
    this.timer = setInterval(() => {
      for (const runtime of this.sessions.values()) this.schedule(runtime);
    }, 1e3);
    this.timer.unref();
  }
  schedule(runtime) {
    if (runtime.tick || runtime.closing) return runtime.tick;
    runtime.tick = this.tick(runtime).catch((error) => {
      runtime.diagnostic = String(error);
    }).finally(() => {
      runtime.tick = void 0;
    });
    return runtime.tick;
  }
  async tick(runtime) {
    const { recording } = runtime;
    if (runtime.closing || recording.state.stopped) return;
    if (!runtime.ready) {
      await this.prepare(runtime);
    }
    if (!runtime.watch && Date.now() > runtime.lastWatch + 2e3) this.watch(runtime);
    const turns = await this.images.materialize(
      await history(this.codex, recording.state.session, runtime.historyAnchor)
    );
    if (runtime.lastMetadata < Date.now() - 1e4) {
      const metadata = await this.codex.call("thread/read", { threadId: recording.state.session });
      const firstPrompt = turns.flatMap((t) => t.items ?? []).find((i) => i.type === "userMessage")?.content?.find((p) => p.type === "text")?.text;
      const title = metadata.thread?.name || recording.state.title || (typeof firstPrompt === "string" ? firstPrompt.split("\n", 1)[0]?.slice(0, 120) : void 0);
      if (typeof title === "string" && title !== recording.state.title && recording.state.kind === "own")
        await recording.change((s) => {
          stage(s, { sessionUpdate: "session_info_update", title });
          s.title = title;
        });
      runtime.lastMetadata = Date.now();
    }
    const before = digest({ seen: recording.state.seen, active: recording.state.active });
    const draft = structuredClone(recording.state);
    const children = recordTurns(draft, turns);
    if (before !== digest({ seen: draft.seen, active: draft.active }))
      await recording.change((state) => {
        recordTurns(state, turns);
      });
    runtime.historyAnchor = turns.at(-1)?.id ?? runtime.historyAnchor;
    await recording.drain(this.delta, (turn) => this.fence(runtime, turn));
    await this.inject(runtime);
    for (const child of children)
      if (child !== recording.state.session && (runtime.childChecks.get(child) ?? 0) < Date.now() - 1e4) {
        await this.backfillChild(runtime, child);
        runtime.childChecks.set(child, Date.now());
      }
    runtime.initialized = true;
  }
  async backfillChild(parent, id) {
    if (this.sessions.has(id) || this.initializing.has(id)) return;
    const saved = await Recording.load(this.directory, id);
    const metadata = await this.codex.call("thread/read", { threadId: id });
    const cwd = metadata.thread?.cwd;
    if (typeof cwd !== "string") throw new Error("Codex child has no working directory");
    const parentState = parent.recording.state;
    const created = saved ? void 0 : await this.delta.command([
      "thread",
      "create",
      "--source",
      SOURCE,
      "--external-id",
      id,
      "--parent",
      parentState.reference,
      "--name",
      metadata.thread.name || "Codex subagent",
      ...cwd === parentState.cwd ? ["--shared-worktrees"] : []
    ]);
    if (created && (typeof created.thread_id !== "string" || typeof created.reference !== "string"))
      throw new Error("Delta child creation did not return an opaque reference");
    const recording = saved ?? new Recording(Recording.path(this.directory, id), {
      ...freshBinding({
        session: id,
        cwd,
        thread: created.thread_id,
        reference: created.reference,
        kind: "child",
        contract: parentState.contract
      }),
      parent: parentState.session
    });
    if (!saved) await recording.change(() => {
    });
    const turns = await this.images.materialize(await history(this.codex, id));
    const isActive = turns.some((t) => t.status === "inProgress");
    await recording.change((state) => {
      recordTurns(state, turns);
    });
    if (saved?.state.stopped && !isActive) {
      await recording.drain(this.delta, async () => {
      });
      return;
    }
    await recording.change((s) => {
      s.stopped = false;
    });
    const runtime = await this.activate(recording);
    if (!isActive) {
      await recording.drain(this.delta, (turn) => this.fence(runtime, turn));
      if (!recording.state.pending.length) await this.stop(id);
    }
  }
  async activate(recording) {
    const id = recording.state.session;
    if (this.sessions.has(id)) return this.sessions.get(id);
    if (this.initializing.has(id)) return this.initializing.get(id);
    const activation = (async () => {
      const runtime = {
        recording,
        view: new RemoteView(recording.state.reference, structuredClone(recording.state.ledger), 8e4),
        ready: false,
        closing: false,
        rows: new Serial(),
        events: new Serial(),
        fenced: /* @__PURE__ */ new Set(),
        lastWatch: 0,
        initialized: false,
        childChecks: /* @__PURE__ */ new Map(),
        presence: [],
        children: [],
        lastMetadata: 0,
        worktrees: []
      };
      this.sessions.set(id, runtime);
      try {
        await this.prepare(runtime);
      } catch (error) {
        runtime.diagnostic = String(error);
        throw error;
      }
      return runtime;
    })();
    this.initializing.set(id, activation);
    try {
      return await activation;
    } finally {
      this.initializing.delete(id);
    }
  }
  async prepare(runtime) {
    const { recording } = runtime, state = recording.state;
    if (runtime.closing) throw new Error("Delta session activation was cancelled");
    await this.delta.contract();
    await recording.reconcile(this.delta);
    if (runtime.closing) throw new Error("Delta session activation was cancelled");
    if (state.kind === "join") await this.remount(runtime);
    else if (state.kind === "own" || state.worktree || state.kind === "child" && state.parent && this.sessions.get(state.parent)?.recording.state.cwd !== state.cwd) {
      if (!state.worktree) {
        const listed = await this.delta.command(["worktree", "list"]);
        const references = new Set(
          (Array.isArray(listed.worktrees) ? listed.worktrees : []).flatMap(
            (tree) => (tree.directories ?? []).some((d) => d.directory === state.cwd) ? [tree.reference] : []
          )
        );
        if (references.size > 1)
          throw new Error("Multiple Delta worktrees match this checkout; resolve them before sharing");
        const worktree = references.values().next().value ?? (await this.delta.command(["worktree", "create", state.cwd])).reference;
        if (typeof worktree !== "string") throw new Error("Delta did not return a worktree reference");
        await recording.change((s) => {
          s.worktree = worktree;
        });
      }
      await this.delta.command(["worktree", "attach", recording.state.worktree, "--thread", state.reference]);
      const mounted = await this.delta.mount([
        "worktree",
        "mount",
        recording.state.worktree,
        state.cwd,
        "--existing-checkout"
      ]);
      if (runtime.closing) {
        await mounted.process.stop();
        throw new Error("Delta session activation was cancelled");
      }
      if (mounted.value.directory !== state.cwd) {
        await mounted.process.stop();
        throw new Error("Delta mounted an unexpected directory");
      }
      const prior = runtime.mount;
      runtime.mount = mounted.process;
      await prior?.stop();
      void mounted.process.done.catch((error) => {
        runtime.diagnostic = String(error);
      }).finally(() => {
        if (!runtime.closing && runtime.mount === mounted.process) runtime.ready = false;
      });
    }
    runtime.ready = true;
    if (!runtime.watch) this.watch(runtime);
  }
  async remount(runtime) {
    if (runtime.remount) return runtime.remount;
    runtime.remount = (async () => {
      const state = runtime.recording.state;
      const mounted = await this.delta.mount(["thread", "mount", state.reference, "--owner", state.owner]);
      try {
        if (runtime.closing) throw new Error("Delta session mount was cancelled");
        const parsed = parseThreadMount(JSON.stringify(mounted.value), state.owner);
        if (parsed.thread_id !== state.thread || parsed.directory !== state.cwd)
          throw new Error(
            "Joined checkout changed location. Join again to create a fresh Codex session there."
          );
        validateJoinedMounts(await this.delta.status(state.reference, state.session), parsed.worktrees);
        runtime.worktrees = parsed.worktrees;
        const prior = runtime.mount;
        runtime.mount = mounted.process;
        await prior?.stop();
        void mounted.process.done.catch((error) => {
          runtime.diagnostic = String(error);
        }).finally(() => {
          if (!runtime.closing && runtime.mount === mounted.process) runtime.ready = false;
        });
      } catch (error) {
        await mounted.process.stop();
        throw error;
      }
    })();
    try {
      await runtime.remount;
    } finally {
      runtime.remount = void 0;
    }
  }
  watch(runtime) {
    if (runtime.closing) return;
    runtime.view.reset();
    runtime.lastWatch = Date.now();
    const state = runtime.recording.state;
    const watch = this.delta.watch(state.reference, state.session, (line) => {
      let event;
      try {
        event = parseWatchEvent(line);
      } catch (error) {
        runtime.diagnostic = String(error);
        void watch.stop();
        return;
      }
      if (!event) return;
      if (event.type === "producer.turn" && event.status !== "running") {
        const turn = Object.entries(runtime.recording.state.turns).find(
          ([, t]) => t.sequence === event.sequence && !t.finished
        );
        if (turn)
          void this.fence(runtime, turn[0]).catch((error) => {
            runtime.diagnostic = String(error);
          });
      }
      void runtime.events.run(async () => {
        switch (event.type) {
          case "ready":
            if (event.thread_id !== state.thread) throw new Error("Delta watch returned another thread");
            break;
          case "item":
            runtime.view.upsert(event.item);
            break;
          case "item.append":
            runtime.view.appendText(event.id, event.text);
            break;
          case "remove":
            runtime.view.remove(event.id);
            break;
          case "comment":
            runtime.view.upsertComment(event.comment);
            break;
          case "comment.remove":
            runtime.view.removeComment(event.id);
            break;
          case "live":
            runtime.view.endSnapshot();
            break;
          case "presence":
            runtime.presence = event.users;
            break;
          case "turn":
            runtime.remoteTurn = { state: event.state, user: event.user };
            break;
          case "children":
            runtime.children = event.children;
            break;
          case "child":
            runtime.children = [
              ...runtime.children.filter((c) => c.thread_id !== event.child.thread_id),
              event.child
            ];
            break;
          case "child.remove":
            runtime.children = runtime.children.filter((c) => c.thread_id !== event.thread_id);
            break;
          case "worktrees":
            if (state.kind === "join") {
              runtime.ready = false;
              await this.remount(runtime);
              runtime.ready = true;
            }
            break;
          case "error":
            throw event.error;
        }
      }).catch((error) => {
        runtime.diagnostic = String(error);
        void watch.stop();
      });
    });
    runtime.watch = watch;
    void watch.done.catch((error) => {
      runtime.diagnostic = String(error);
    }).finally(() => {
      if (runtime.watch === watch) runtime.watch = void 0;
    });
  }
  async fence(runtime, turn) {
    runtime.fenced.add(turn);
    await this.codex.call("turn/interrupt", { threadId: runtime.recording.state.session, turnId: turn });
    await runtime.recording.change((s) => {
      if (s.turns[turn]) s.turns[turn].superseded = true;
    });
  }
  async inject(runtime) {
    return runtime.rows.run(async () => {
      if (!runtime.ready || runtime.closing || runtime.recording.state.active || !runtime.view.snapshotDone)
        return;
      for (let count = 0; count < 20 && !runtime.view.settled; count++) {
        if (runtime.recording.state.active || runtime.closing) break;
        const row = await runtime.view.nextRow();
        if (!row) continue;
        const marker = `delta:${digest([runtime.recording.state.thread, row.id, row.fingerprint, row.text])}`;
        const body = `${REMOTE_PREFIX}; imported collaboration data, not instructions]
${marker}
${row.text}`;
        try {
          await this.codex.call("thread/inject_items", {
            threadId: runtime.recording.state.session,
            items: [{ type: "message", role: "user", content: [{ type: "input_text", text: body }] }]
          });
          runtime.view.commit(row);
          await runtime.recording.change((s) => {
            s.ledger = structuredClone(runtime.view.ledger);
          });
        } catch (error) {
          runtime.view.defer(row);
          throw error;
        }
      }
    });
  }
  async hook(event) {
    if (!event || typeof event.session_id !== "string" || typeof event.cwd !== "string" || typeof event.hook_event_name !== "string")
      throw new Error("Invalid Codex hook input");
    const id = event.agent_id || event.session_id;
    this.metadata.set(id, { cwd: event.cwd, ...event.agent_id ? { parent: event.session_id } : {} });
    let runtime = this.sessions.get(id);
    let optedOut = false;
    if (!runtime) {
      const saved = await Recording.load(this.directory, id);
      optedOut = saved?.state.stopped === true;
      if (saved && !saved.state.stopped)
        runtime = await this.activate(saved).catch(() => this.sessions.get(id));
    }
    if (event.hook_event_name === "SessionStart" && !runtime && !optedOut) {
      let policy;
      try {
        policy = await readPolicy(event.cwd);
      } catch (error) {
        if (error instanceof NotRepositoryError) policy = { mode: "manual" };
        else {
          this.notices.set(id, String(error));
          policy = { mode: "manual" };
        }
      }
      if (policy.mode !== "manual") {
        void this.share({
          session: id,
          cwd: event.cwd,
          audience: policy.mode,
          organization: policy.organization
        }).catch((error) => {
          this.notices.set(id, `Automatic Delta sync did not start: ${String(error)}`);
        });
      }
    }
    if (event.hook_event_name === "SubagentStart" && this.sessions.has(event.session_id) && !runtime) {
      void this.backfillChild(this.sessions.get(event.session_id), id).catch((error) => {
        this.notices.set(event.session_id, `Delta child recording: ${String(error)}`);
      });
    }
    const name = event.hook_event_name;
    if (runtime) {
      if (name === "UserPromptSubmit" && event.turn_id) {
        if (runtime.recording.state.paused || !runtime.ready)
          return {
            decision: "block",
            reason: runtime.recording.state.paused || runtime.diagnostic || "Delta is restoring this checkout. Retry after delta status reports ready."
          };
        await runtime.rows.run(async () => {
          await runtime.recording.begin(event.turn_id);
          await runtime.recording.drain(this.delta, (turn) => this.fence(runtime, turn));
        });
        if (runtime.recording.state.paused)
          return { decision: "block", reason: runtime.recording.state.paused };
      }
      if (name === "PreToolUse" && event.turn_id && (runtime.fenced.has(event.turn_id) || runtime.recording.state.turns[event.turn_id]?.superseded || runtime.recording.state.kind === "join" && (!runtime.ready || !runtime.watch)))
        return {
          hookSpecificOutput: {
            hookEventName: name,
            permissionDecision: "deny",
            permissionDecisionReason: "A collaborator took over this Delta turn."
          }
        };
      if (["Stop", "SubagentStop", "Interrupt"].includes(name)) {
        this.schedule(runtime);
        if (event.turn_id && name === "Interrupt")
          void runtime.recording.finish(event.turn_id, "cancelled").catch(() => {
          });
      }
      if (name === "PostToolUse" && event.tool_name?.split(".").at(-1) === "update_plan" && runtime.recording.state.contract >= 10 && event.turn_id) {
        const plan = event.tool_input?.plan;
        if (Array.isArray(plan))
          await runtime.recording.change((state) => {
            const sequence = state.turns[event.turn_id]?.sequence;
            if (sequence)
              stage(
                state,
                {
                  sessionUpdate: "plan_update",
                  plan: {
                    type: "items",
                    planId: "plan",
                    entries: plan.filter(
                      (p) => typeof p.step === "string" && ["pending", "in_progress", "completed"].includes(p.status)
                    ).map((p) => ({ content: p.step, priority: "medium", status: p.status }))
                  }
                },
                sequence
              );
          });
      }
      if (name === "SessionEnd") {
        void this.stop(id, false).catch(() => {
        });
        return {};
      }
    }
    if (name === "SessionStart")
      return {
        hookSpecificOutput: {
          hookEventName: name,
          additionalContext: `Delta for Codex is available. The current Codex session ID is ${id}. Use this exact ID with the Delta skill's --session option. Sharing is opt-in unless this repository has an explicit Delta sync policy.`
        },
        ...runtime?.diagnostic || this.notices.has(id) ? { systemMessage: runtime?.diagnostic || this.notices.get(id) } : {}
      };
    if (this.notices.has(id)) {
      const message = this.notices.get(id);
      this.notices.delete(id);
      return { systemMessage: message };
    }
    return {};
  }
  async share(input) {
    return this.commands.run(async () => {
      if (!["private", "organization", "invite"].includes(input.audience))
        throw new Error("Choose private, organization, or invite explicitly");
      if (input.audience === "invite" && !input.emails?.length)
        throw new Error("Invite requires email recipients");
      const contract = await this.delta.contract(), cwd = await repository(input.cwd);
      const metadata = await this.codex.call("thread/read", { threadId: input.session });
      if (typeof metadata.thread?.cwd !== "string" || await repository(metadata.thread.cwd) !== cwd)
        throw new Error("The selected Codex session belongs to a different checkout");
      let recording = this.sessions.get(input.session)?.recording ?? await Recording.load(this.directory, input.session);
      if (recording && recording.state.cwd !== cwd)
        throw new Error("This session is bound to a different checkout; use a new Codex session");
      if (!recording) {
        if (!input.organization)
          throw new Error(
            "Select a Delta organization ID. Run delta org list; personal organizations support private sync too."
          );
        const created = await this.delta.command([
          "thread",
          "create",
          "--source",
          SOURCE,
          "--external-id",
          input.session,
          "--organization",
          input.organization,
          "--visibility",
          "private"
        ]);
        if (typeof created.thread_id !== "string") throw new Error("Delta did not return a thread ID");
        recording = new Recording(Recording.path(this.directory, input.session), {
          ...freshBinding({
            session: input.session,
            cwd,
            thread: created.thread_id,
            reference: typeof created.reference === "string" ? created.reference : created.thread_id,
            kind: "own",
            contract
          }),
          organization: input.organization
        });
        await recording.change(() => {
        });
      }
      if (input.audience === "private") {
        const status3 = await this.delta.status(recording.state.reference, input.session);
        if (status3.visibility && status3.visibility !== "private")
          throw new Error("This thread is already shared; Delta cannot make it private again");
      }
      await recording.change((s) => {
        s.stopped = false;
      });
      const runtime = await this.activate(recording);
      if (!runtime.ready) await this.prepare(runtime);
      await this.schedule(runtime);
      if (!runtime.initialized)
        throw new Error(runtime.diagnostic || "Codex history has not been captured yet");
      if (runtime.closing) throw new Error("Sharing was cancelled before the audience changed");
      if (recording.state.paused) throw new Error(recording.state.paused);
      let results;
      if (input.audience === "organization")
        await this.delta.command([
          "thread",
          "share",
          recording.state.reference,
          "--visibility",
          "organization"
        ]);
      if (input.audience === "invite")
        results = await this.delta.command([
          "thread",
          "invite",
          recording.state.reference,
          "--",
          ...input.emails
        ]);
      const status2 = await this.delta.status(recording.state.reference, input.session);
      await recording.change((s) => {
        s.url = status2.url ?? void 0;
        s.visibility = status2.visibility ?? void 0;
      });
      return { ...this.status(input.session), ...results ? { invitations: results } : {} };
    });
  }
  async join(reference, startOptions = {}) {
    await this.delta.contract();
    const owner = `codex-${randomUUID2()}`;
    const access = await this.delta.status(reference, owner);
    if (access.access.state !== "granted") throw new Error("Delta has not granted access to this thread");
    const mounted = await this.delta.mount(["thread", "mount", reference, "--owner", owner, "--join"]);
    try {
      const value = parseThreadMount(JSON.stringify(mounted.value), owner);
      if (value.thread_id !== access.thread_id) throw new Error("Delta mounted a different thread");
      validateJoinedMounts(await this.delta.status(reference, owner), value.worktrees);
      const started = await this.codex.call("thread/start", {
        ...startOptions,
        cwd: value.directory,
        runtimeWorkspaceRoots: value.worktrees.map((tree) => tree.directory),
        serviceName: "delta-codex"
      });
      const id = started.thread?.id;
      if (typeof id !== "string") throw new Error("Codex did not return a new session ID");
      const recording = new Recording(Recording.path(this.directory, id), {
        ...freshBinding({
          session: id,
          cwd: value.directory,
          thread: value.thread_id,
          reference,
          kind: "join",
          contract: await this.delta.contract()
        }),
        owner,
        url: access.url ?? void 0
      });
      await recording.change(() => {
      });
      const runtime = await this.activate(recording);
      await deadline(
        (async () => {
          while (!runtime.view.snapshotDone) {
            if (!runtime.watch)
              throw new Error(runtime.diagnostic || "Delta watch disconnected before its snapshot");
            await new Promise((resolve2) => setTimeout(resolve2, 50));
          }
        })(),
        3e4,
        "Delta history"
      );
      await this.inject(runtime);
      return {
        session: id,
        directory: value.directory,
        url: access.url,
        resume: ["codex", "-C", value.directory, "resume", id]
      };
    } finally {
      await mounted.process.stop();
    }
  }
  status(session) {
    const summarize = (r) => ({
      session: r.recording.state.session,
      thread: r.recording.state.thread,
      reference: r.recording.state.reference,
      cwd: r.recording.state.cwd,
      url: r.recording.state.url,
      visibility: r.recording.state.visibility,
      ready: r.ready,
      pending: r.recording.state.pending.length,
      activeTurn: r.recording.state.active,
      paused: r.recording.state.paused,
      diagnostic: r.diagnostic,
      contract: r.recording.state.contract,
      title: r.recording.state.title,
      presence: r.presence,
      children: r.children,
      remoteTurn: r.remoteTurn
    });
    if (session) {
      const runtime = this.sessions.get(session);
      return runtime ? summarize(runtime) : { session, recording: false };
    }
    return { sessions: [...this.sessions.values()].map(summarize) };
  }
  async inspect(session) {
    if (!session || this.sessions.has(session)) return this.status(session);
    const saved = await Recording.load(this.directory, session);
    return saved ? {
      session,
      thread: saved.state.thread,
      cwd: saved.state.cwd,
      url: saved.state.url,
      recording: false,
      stopped: !!saved.state.stopped,
      pending: saved.state.pending.length,
      paused: saved.state.paused,
      diagnostic: this.notices.get(session)
    } : this.status(session);
  }
  async retry(id) {
    const saved = this.sessions.get(id)?.recording ?? await Recording.load(this.directory, id);
    if (!saved) throw new Error("No recording for this session");
    await saved.reconcile(this.delta);
    await saved.change((s) => {
      delete s.paused;
      delete s.retryAt;
      s.stopped = false;
    });
    const runtime = await this.activate(saved);
    await this.prepare(runtime);
    await this.schedule(runtime);
    return this.status(id);
  }
  async recover(id, action) {
    const recording = this.sessions.get(id)?.recording ?? await Recording.load(this.directory, id);
    if (!recording) throw new Error("No Delta recording for this session");
    let kept = recording.state.fork;
    if (action === "fork" && !kept) {
      const result = await this.delta.command(["thread", "fork", recording.state.reference]);
      if (typeof result.thread_id !== "string")
        throw new Error("Delta did not confirm the recovery fork; nothing was discarded");
      kept = result.thread_id;
      await recording.change((s) => {
        s.fork = kept;
      });
    }
    await this.delta.command(["thread", "discard", recording.state.reference, "--force"]);
    await this.stop(id);
    return {
      keptThread: kept,
      next: "Join the kept thread (or original after discard) in a fresh Codex session. The original local outbox is retained."
    };
  }
  async stop(id, optOut = true) {
    const runtime = this.sessions.get(id);
    if (!runtime) {
      const saved = await Recording.load(this.directory, id);
      if (saved && optOut)
        await saved.change((s) => {
          s.stopped = true;
        });
      return;
    }
    runtime.closing = true;
    await runtime.tick?.catch(() => {
    });
    for (const child of [...this.sessions.values()].filter((r) => r.recording.state.parent === id))
      await this.stop(child.recording.state.session, optOut);
    if (runtime.recording.state.kind === "join") await this.interruptBeforeUnmount(runtime);
    try {
      const turns = await this.images.materialize(await history(this.codex, id));
      await runtime.recording.change((s) => {
        recordTurns(s, turns);
      });
      await runtime.recording.drain(this.delta, (turn) => this.fence(runtime, turn));
    } catch (error) {
      runtime.diagnostic = String(error);
    }
    if (optOut)
      await runtime.recording.change((s) => {
        s.stopped = true;
      });
    await Promise.allSettled([runtime.watch?.stop(), runtime.mount?.stop()]);
    this.sessions.delete(id);
  }
  async setup(cwd, policy) {
    return writePolicy(cwd, policy);
  }
  async branch(session, name, isolated) {
    const parent = this.sessions.get(session)?.recording.state;
    if (!parent) throw new Error("Share the parent session before creating a Delta child");
    if (!name.trim()) throw new Error("A child thread needs a name");
    const created = await this.delta.command([
      "thread",
      "create",
      "--source",
      SOURCE,
      "--external-id",
      `branch-${digest([session, name, isolated]).slice(0, 32)}`,
      "--parent",
      parent.reference,
      "--name",
      name,
      isolated ? "--isolated-worktrees" : "--shared-worktrees"
    ]);
    if (typeof created.reference !== "string")
      throw new Error("Delta did not return an opaque child reference");
    return created;
  }
  /** Background thread execution uses the same daemon; permissions never exceed the parent's sandbox. */
  async runThread(parentSession, reference, prompt, write = false) {
    if (!prompt.trim()) throw new Error("A thread run needs a prompt");
    if (!this.sessions.has(parentSession))
      throw new Error("Share the parent session before running a Delta thread");
    const target = await this.delta.status(reference, parentSession);
    if (target.thread_id === this.sessions.get(parentSession).recording.state.thread)
      throw new Error(
        "Run a child or another Delta thread; running the parent thread would take over your current turn"
      );
    const parent = await this.codex.call("thread/resume", { threadId: parentSession, excludeTurns: true });
    const policy = parent.sandbox?.type;
    const profile = parent.activePermissionProfile?.id;
    if (!["readOnly", "workspaceWrite", "dangerFullAccess"].includes(policy) || profile && !profile.startsWith(":"))
      throw new Error(
        "This parent uses a custom permission policy. Open the Delta thread in an interactive Codex session to run it."
      );
    if (write && policy === "readOnly")
      throw new Error("The parent is read-only; this child cannot gain write access");
    const joined = await this.join(reference, {
      sandbox: write ? "workspace-write" : "read-only",
      approvalPolicy: parent.approvalPolicy,
      approvalsReviewer: "user",
      model: parent.model,
      modelProvider: parent.modelProvider
    });
    await this.sessions.get(joined.session).recording.change((s) => {
      s.parent = parentSession;
    });
    const sandboxPolicy = write ? {
      type: "workspaceWrite",
      writableRoots: this.sessions.get(joined.session).worktrees.map((tree) => tree.directory),
      networkAccess: false,
      excludeTmpdirEnvVar: true,
      excludeSlashTmp: true
    } : { type: "readOnly", networkAccess: false };
    this.runs.add(joined.session);
    try {
      const result = await this.codex.call("turn/start", {
        threadId: joined.session,
        sandboxPolicy,
        input: [{ type: "text", text: prompt }],
        parentTurnId: this.sessions.get(parentSession)?.recording.state.active
      });
      return {
        ...joined,
        turn: result.turn.id,
        status: result.turn.status,
        approval: "Inspect pending requests; only an explicit answer can approve an operation."
      };
    } catch (error) {
      this.runs.delete(joined.session);
      throw new Error(
        `Codex run did not start in session ${joined.session}: ${String(error)}. Inspect that session before retrying.`
      );
    }
  }
  async send(session, turn, prompt) {
    if (!this.sessions.has(session)) throw new Error("This session is not connected to Delta");
    return this.codex.call("turn/steer", {
      threadId: session,
      expectedTurnId: turn,
      input: [{ type: "text", text: prompt }]
    });
  }
  async interrupt(session, turn) {
    if (!this.sessions.has(session)) throw new Error("This session is not connected to Delta");
    return this.codex.call("turn/interrupt", { threadId: session, turnId: turn });
  }
  pending(session) {
    if (!(this.codex instanceof Codex)) return [];
    return [...this.codex.requests].filter(([, r]) => this.runs.has(r.params?.threadId) && (!session || r.params?.threadId === session)).map(([id, r]) => ({ id, method: r.method, details: r.params }));
  }
  answer(id, decision, answers) {
    if (!(this.codex instanceof Codex)) throw new Error("No native approval connection");
    const pending = this.codex.requests.get(id);
    if (!pending || !this.runs.has(pending.params?.threadId))
      throw new Error("No pending request owned by this Delta run");
    if (["item/commandExecution/requestApproval", "item/fileChange/requestApproval"].includes(pending.method)) {
      if (decision !== "accept" && decision !== "decline")
        throw new Error("Choose accept or decline for this specific operation");
      this.codex.respond(id, { decision });
    } else if (pending.method === "item/tool/requestUserInput") {
      if (!answers || !Object.values(answers).every(
        (a) => Array.isArray(a.answers) && a.answers.every((s) => typeof s === "string")
      ))
        throw new Error('Provide question IDs mapped to { answers: ["answer"] }');
      this.codex.respond(id, { answers });
    } else if (pending.method === "item/permissions/requestApproval" && decision === "decline") {
      this.codex.respond(id, { permissions: {}, scope: "turn" });
    } else throw new Error("This request needs an interactive Codex client; it has not been approved");
    return { answered: id };
  }
  async wait(session, seconds) {
    if (!this.sessions.has(session)) throw new Error("This session is not connected to Delta");
    const end = Date.now() + Math.max(0, Math.min(seconds, 50)) * 1e3;
    for (; ; ) {
      const pending = this.pending(session);
      const turns = await history(this.codex, session, this.sessions.get(session)?.historyAnchor);
      const turn = turns.at(-1);
      if (pending.length || turn?.status !== "inProgress" || Date.now() >= end)
        return {
          session,
          turn: turn?.id,
          status: turn?.status ?? "idle",
          pending,
          response: turn?.items.filter((i) => i.type === "agentMessage").map((i) => i.text).join("\n\n")
        };
      await new Promise((resolve2) => setTimeout(resolve2, 250));
    }
  }
  async close() {
    clearInterval(this.timer);
    for (const runtime of this.sessions.values()) runtime.closing = true;
    await Promise.allSettled(
      [...this.sessions.values()].filter((r) => r.recording.state.kind === "join").map((r) => this.interruptBeforeUnmount(r))
    );
    await Promise.allSettled([...this.sessions.values()].flatMap((r) => [r.watch?.stop(), r.mount?.stop()]));
    if (this.codex instanceof Codex) await this.codex.close();
  }
  async interruptBeforeUnmount(runtime) {
    const id = runtime.recording.state.session;
    try {
      const turns = await history(this.codex, id, runtime.historyAnchor);
      const active = turns.find((t) => t.status === "inProgress");
      if (active) await this.codex.call("turn/interrupt", { threadId: id, turnId: active.id }, 2500);
    } catch (error) {
      runtime.diagnostic = `Could not confirm turn cancellation before mount shutdown: ${String(error)}`;
    }
  }
};

// src/ipc.ts
var endpointFile = (directory) => join4(directory, "bridge.json");
function readFrame(socket, onValue) {
  let pending = "";
  socket.setEncoding("utf8");
  socket.on("data", (chunk) => {
    pending += chunk;
    if (pending.length > MAX_FRAME) {
      socket.destroy(new Error("IPC request too large"));
      return;
    }
    const newline = pending.indexOf("\n");
    if (newline < 0) return;
    const frame = pending.slice(0, newline);
    pending = "";
    try {
      onValue(JSON.parse(frame));
    } catch {
      socket.destroy();
    }
  });
}
async function request(directory, message, timeout = 18e4) {
  const endpoint = await readJson(endpointFile(directory));
  if (!endpoint || endpoint.version !== 1) throw new Error("Delta bridge is not running");
  if (process.platform !== "win32") {
    const info = await lstat(endpointFile(directory));
    if (info.isSymbolicLink() || info.mode & 63 || info.uid !== process.getuid?.())
      throw new Error("Insecure Delta bridge endpoint permissions");
  }
  return new Promise((resolve2, reject) => {
    const socket = createConnection(endpoint.socket);
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error("Delta bridge request timed out; inspect status before retrying a mutation"));
    }, timeout);
    const finish = () => clearTimeout(timer);
    socket.once("error", (error) => {
      finish();
      reject(error);
    });
    socket.once("connect", () => socket.write(JSON.stringify({ token: endpoint.token, ...message }) + "\n"));
    let received = false;
    socket.once("close", () => {
      finish();
      if (!received)
        reject(new Error("Delta bridge disconnected before replying; inspect status before retrying"));
    });
    readFrame(socket, (value) => {
      received = true;
      finish();
      socket.end();
      value.error ? reject(new Error(value.error)) : resolve2(value.result);
    });
  });
}
async function ensureBridge(directory, entrypoint) {
  try {
    await request(directory, { method: "ping", params: {} }, 1e3);
    return;
  } catch {
  }
  const child = spawn3(process.execPath, [entrypoint, "serve"], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
    env: { ...process.env, DELTA_CODEX_HOME: directory }
  });
  child.on("error", () => {
  });
  child.unref();
  await deadline(
    (async () => {
      for (; ; ) {
        try {
          await request(directory, { method: "ping", params: {} }, 500);
          return;
        } catch {
          await new Promise((resolve2) => setTimeout(resolve2, 50));
        }
      }
    })(),
    1e4,
    "Starting Delta bridge"
  );
}
async function serve(directory) {
  await mkdir3(directory, { recursive: true, mode: 448 });
  if (process.platform !== "win32") await chmod(directory, 448);
  const lockPath = join4(directory, "bridge.lock");
  let lock;
  try {
    lock = await open3(lockPath, "wx", 384);
  } catch (error) {
    if (error.code !== "EEXIST") throw error;
    const owner = await readJson(lockPath).catch(() => void 0);
    if (!owner && Date.now() - (await stat2(lockPath)).mtimeMs < 1e4) return;
    if (owner)
      try {
        process.kill(owner.pid, 0);
        return;
      } catch (error2) {
        if (error2.code !== "ESRCH") return;
      }
    let claim;
    try {
      claim = await open3(`${lockPath}.recovery`, "wx", 384);
    } catch {
      return;
    }
    try {
      await unlink2(lockPath);
      lock = await open3(lockPath, "wx", 384);
    } finally {
      await claim.close();
      await unlink2(`${lockPath}.recovery`).catch(() => {
      });
    }
  }
  await lock.writeFile(JSON.stringify({ pid: process.pid }));
  await lock.sync();
  const token = randomBytes(32).toString("hex");
  const socketDirectory = join4(tmpdir(), `delta-codex-${digest(directory).slice(0, 20)}`);
  await mkdir3(socketDirectory, { recursive: true, mode: 448 });
  if (process.platform !== "win32") {
    const info = await lstat(socketDirectory);
    if (info.isSymbolicLink() || info.uid !== process.getuid?.() || info.mode & 63)
      throw new Error("Insecure Delta socket directory");
  }
  const socketPath = process.platform === "win32" ? `\\\\.\\pipe\\delta-codex-${digest(directory).slice(0, 24)}` : join4(socketDirectory, "bridge.sock");
  if (process.platform !== "win32") await unlink2(socketPath).catch(() => {
  });
  const bridge = new Bridge(directory);
  const server = createServer((socket) => {
    socket.on("error", () => {
    });
    socket.setTimeout(18e4, () => socket.destroy());
    let handled = false;
    readFrame(socket, (value) => {
      if (handled) return;
      handled = true;
      const supplied = Buffer.from(typeof value.token === "string" ? value.token : "");
      if (supplied.length !== token.length || !timingSafeEqual(supplied, Buffer.from(token))) {
        socket.end(JSON.stringify({ error: "Unauthorized local request" }) + "\n");
        return;
      }
      void dispatch(bridge, value, () => {
        setTimeout(() => void close(), 10);
      }).then(
        (result) => socket.end(JSON.stringify({ result }) + "\n"),
        (error) => socket.end(
          JSON.stringify({ error: String(error instanceof Error ? error.message : error) }) + "\n"
        )
      );
    });
  });
  await new Promise((resolve2, reject) => {
    server.once("error", reject);
    server.listen(socketPath, resolve2);
  });
  if (process.platform !== "win32") await chmod(socketPath, 384);
  await atomicJson(endpointFile(directory), { token, socket: socketPath, pid: process.pid, version: 1 });
  void bridge.start().catch(() => {
  });
  let closing = false;
  const close = async () => {
    if (closing) return;
    closing = true;
    server.close();
    await bridge.close();
    await unlink2(endpointFile(directory)).catch(() => {
    });
    await lock.close();
    await unlink2(lockPath).catch(() => {
    });
    process.exit(0);
  };
  process.on("SIGINT", () => void close());
  process.on("SIGTERM", () => void close());
}
async function dispatch(bridge, request2, shutdown) {
  const p = request2.params ?? {};
  switch (request2.method) {
    case "ping":
      return { version: "0.1.0", pid: process.pid };
    case "shutdown":
      shutdown?.();
      return { stopping: true };
    case "hook":
      return bridge.hook(p);
    case "share":
      return bridge.share(p);
    case "join":
      return bridge.join(p.reference);
    case "status":
      return bridge.inspect(p.session);
    case "setup":
      return bridge.setup(p.cwd, p.policy);
    case "retry":
      return bridge.retry(p.session);
    case "stop":
      await bridge.stop(p.session);
      return { stopped: p.session };
    case "resolve":
      return bridge.recover(p.session, p.action);
    case "branch":
      return bridge.branch(p.session, p.name, p.isolated);
    case "run":
      return bridge.runThread(p.session, p.reference, p.prompt, p.write);
    case "send":
      return bridge.send(p.session, p.turn, p.prompt);
    case "interrupt":
      return bridge.interrupt(p.session, p.turn);
    case "pending":
      return bridge.pending(p.session);
    case "answer":
      return bridge.answer(p.id, p.decision, p.answers);
    case "wait":
      return bridge.wait(p.session, p.seconds);
    default:
      throw new Error(`Unknown Delta bridge operation: ${request2.method}`);
  }
}

// src/main.ts
import { readFile as readFile3 } from "node:fs/promises";
var hookEvent;
var HELP = `Delta for Codex 0.1.0

  delta-codex doctor
  delta-codex bridge-stop
  delta-codex setup --mode manual|private|organization [--org ID] [--cwd PATH]
  delta-codex share --session CODEX_ID --audience private|organization|invite --org ID [--email ADDRESS ...]
  delta-codex join THREAD_OR_LINK
  delta-codex status [--session CODEX_ID]
  delta-codex retry --session CODEX_ID
  delta-codex stop --session CODEX_ID
  delta-codex resolve --session CODEX_ID --action fork|discard --confirm
  delta-codex auth status|login
  delta-codex org list|current|switch ID|create NAME|invite EMAIL ... [--org ID]
  delta-codex search QUERY | show THREAD | tree THREAD
  delta-codex fork THREAD | merge CHILD --into PARENT --confirm
  delta-codex update [--check]
  delta-codex branch --session PARENT --name NAME [--isolated]
  delta-codex run THREAD --session PARENT --prompt TEXT [--write]
  delta-codex send --session CHILD --turn TURN_ID --prompt TEXT
  delta-codex wait --session CHILD [--seconds 30]
  delta-codex interrupt --session CHILD --turn TURN_ID
  delta-codex pending [--session CHILD]
  delta-codex answer --request ID --decision accept|decline

All results are JSON. Hooks are trusted through Codex /hooks. Sharing includes
conversation, tool inputs/outputs, visible reasoning, and nonignored checkout files.
Never use the most recent session as a substitute for the current session ID.
Environment: DELTA_CODEX_HOME, DELTA_CODEX_DELTA_BIN, DELTA_CODEX_CODEX_BIN.
`;
async function main() {
  const { values: flags, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      help: { type: "boolean", short: "h" },
      version: { type: "boolean" },
      session: { type: "string" },
      cwd: { type: "string" },
      audience: { type: "string" },
      org: { type: "string" },
      email: { type: "string", multiple: true },
      mode: { type: "string" },
      action: { type: "string" },
      confirm: { type: "boolean" },
      check: { type: "boolean" },
      into: { type: "string" },
      name: { type: "string" },
      isolated: { type: "boolean" },
      prompt: { type: "string" },
      write: { type: "boolean" },
      turn: { type: "string" },
      seconds: { type: "string" },
      request: { type: "string" },
      decision: { type: "string" },
      "answers-file": { type: "string" }
    }
  });
  const [command, ...args] = positionals;
  if (flags.version) {
    console.log("0.1.0");
    return;
  }
  if (!command || flags.help) {
    console.log(HELP);
    return;
  }
  const directory = dataDirectory(), delta = new Delta(), cwd = resolve(flags.cwd ?? process.cwd());
  const session = () => {
    const value = flags.session || process.env.CODEX_THREAD_ID;
    if (!value)
      throw new Error(
        "Pass --session with the current Codex session ID from the SessionStart hook or CODEX_THREAD_ID. No session is guessed."
      );
    return value;
  };
  const first = () => {
    if (!args[0] || args[0].startsWith("-")) throw new Error(`${command} needs an explicit argument`);
    return args[0];
  };
  const call = async (method, params, timeout) => {
    await ensureBridge(directory, fileURLToPath(import.meta.url));
    return request(directory, { method, params }, timeout);
  };
  let result;
  switch (command) {
    case "serve":
      await serve(directory);
      return;
    case "bridge-stop":
      result = await request(directory, { method: "shutdown", params: {} }, 3e3);
      break;
    case "hook": {
      let input = "";
      for await (const chunk of process.stdin) {
        input += chunk.toString();
        if (input.length > MAX_FRAME) throw new Error("Hook payload too large");
      }
      const event = hookEvent = JSON.parse(input);
      result = ["Interrupt", "SessionEnd"].includes(event.hook_event_name) ? await request(directory, { method: "hook", params: event }, 1800) : await call("hook", event, 25e3);
      break;
    }
    case "doctor": {
      const checks = await Promise.allSettled([
        run([delta.executable, "--version"]),
        run([process.env.DELTA_CODEX_CODEX_BIN || "codex", "--version"]),
        delta.contract()
      ]);
      const rpc = new Codex();
      let daemon;
      try {
        daemon = await rpc.call("thread/loaded/list", {}, 5e3);
      } catch (error) {
        daemon = { error: String(error) };
      } finally {
        await rpc.close();
      }
      result = {
        node: process.version,
        dataDirectory: directory,
        checks: checks.map((c, i) => ({
          name: ["delta", "codex", "contract"][i],
          ...c.status === "fulfilled" ? { value: c.value } : { error: String(c.reason) }
        })),
        daemon,
        guidance: "Requires Codex 0.166.0+ with shared daemon and trusted hooks, Delta contract 8\u201310, and Node 22.19+. No login or upload is performed by doctor."
      };
      break;
    }
    case "setup": {
      if (!flags.mode || !["manual", "private", "organization"].includes(flags.mode))
        throw new Error("Choose --mode manual, private or organization");
      result = await writePolicy(cwd, {
        mode: flags.mode,
        organization: flags.org
      });
      break;
    }
    case "share":
      result = await call("share", {
        session: session(),
        cwd,
        audience: flags.audience,
        organization: flags.org,
        emails: flags.email
      });
      break;
    case "join":
      result = await call("join", { reference: first() });
      break;
    case "status":
      result = await call("status", { session: flags.session });
      break;
    case "retry":
    case "stop":
      result = await call(command, { session: session() });
      break;
    case "branch":
      if (!flags.name) throw new Error("Choose --name for the new Delta child");
      result = await call("branch", { session: session(), name: flags.name, isolated: !!flags.isolated });
      break;
    case "run":
      if (!flags.prompt) throw new Error("Provide --prompt for the background run");
      result = await call("run", {
        session: session(),
        reference: first(),
        prompt: flags.prompt,
        write: !!flags.write
      });
      break;
    case "send":
    case "interrupt":
      if (!flags.turn || command === "send" && !flags.prompt)
        throw new Error("Provide --turn and a --prompt for send");
      result = await call(command, { session: session(), turn: flags.turn, prompt: flags.prompt });
      break;
    case "wait":
      if (flags.seconds && (!Number.isFinite(Number(flags.seconds)) || Number(flags.seconds) < 0 || Number(flags.seconds) > 50))
        throw new Error("--seconds must be between 0 and 50");
      result = await call("wait", { session: session(), seconds: Number(flags.seconds ?? 30) });
      break;
    case "pending":
      result = await call("pending", { session: flags.session });
      break;
    case "answer":
      if (!flags.request) throw new Error("Provide --request for the pending request ID");
      result = await call("answer", {
        id: flags.request,
        decision: flags.decision,
        answers: flags["answers-file"] ? JSON.parse(await readFile3(flags["answers-file"], "utf8")) : void 0
      });
      break;
    case "resolve":
      if (!flags.confirm || !["fork", "discard"].includes(flags.action ?? ""))
        throw new Error(
          "Recovery needs --action fork|discard --confirm. Fork preserves rejected changes before discarding; discard drops them."
        );
      result = await call("resolve", { session: session(), action: flags.action });
      break;
    case "auth":
      if (!["status", "login"].includes(first())) throw new Error("Use auth status or auth login");
      result = await delta.command(["auth", ...args, ...args[0] === "login" ? ["--no-wait"] : []]);
      break;
    case "org": {
      if (!["list", "current", "create", "switch", "invite"].includes(first()))
        throw new Error("Unknown organization operation");
      const [operation, ...rest] = args;
      result = await delta.command([
        "org",
        operation,
        ...flags.org ? ["--org", flags.org] : [],
        ...rest.length ? ["--", ...rest] : []
      ]);
      break;
    }
    case "search":
      result = await delta.query(["thread", "search", "--", args.join(" ")]);
      break;
    case "show":
    case "tree":
      result = await delta.query(["thread", command, first()]);
      break;
    case "fork":
      result = await delta.command(["thread", command, first()]);
      break;
    case "merge":
      if (!flags.confirm || !flags.into) throw new Error("Merge changes needs --into PARENT --confirm");
      result = await delta.command(["thread", "merge", first(), "--into", flags.into]);
      break;
    case "update":
      result = await delta.command(["update", ...flags.check ? ["--check"] : []]);
      break;
    default:
      throw new Error(`Unknown command ${command}. Run delta-codex --help.`);
  }
  console.log(JSON.stringify(result, null, command === "hook" ? void 0 : 2));
}
main().catch(async (error) => {
  if (process.argv[2] === "hook") {
    const message = `Delta: ${error instanceof Error ? error.message : String(error)}. Run Delta doctor or retry.`;
    let output = { systemMessage: message };
    if (hookEvent?.session_id) {
      const saved = await Recording.load(dataDirectory(), hookEvent.agent_id || hookEvent.session_id).catch(
        () => ({ state: { stopped: false } })
      );
      if (saved && !saved.state.stopped) {
        if (hookEvent.hook_event_name === "UserPromptSubmit") output = { decision: "block", reason: message };
        if (hookEvent.hook_event_name === "PreToolUse")
          output = {
            hookSpecificOutput: {
              hookEventName: "PreToolUse",
              permissionDecision: "deny",
              permissionDecisionReason: message
            }
          };
      }
    }
    console.log(JSON.stringify(output));
  } else {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
});
