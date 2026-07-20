import { ipcMain as b, BrowserWindow as $, app as l, systemPreferences as N, globalShortcut as R, clipboard as ne, dialog as x, nativeImage as oe, Tray as ie, Menu as re, screen as G } from "electron";
import { spawnSync as H, spawn as se } from "node:child_process";
import D from "node:fs";
import K from "node:net";
import a from "node:path";
import { fileURLToPath as ae } from "node:url";
const F = a.dirname(ae(import.meta.url));
process.env.APP_ROOT = a.join(F, "..");
const m = process.env.VITE_DEV_SERVER_URL, Re = a.join(process.env.APP_ROOT, "dist"), y = a.join(process.env.APP_ROOT, "dist");
process.env.VITE_PUBLIC = m ? a.join(process.env.APP_ROOT, "public") : y;
let o = null, n = null, I = null, k = !1, A = !1, B = !1, O = !1, w = null, P = null, v = !1, c = null, f = null, T = "", Y = !1;
const L = {
  backendHost: "127.0.0.1",
  backendPort: 48763
};
function q() {
  return a.resolve(process.env.APP_ROOT || a.join(F, ".."), "..");
}
function z() {
  return l.isPackaged ? a.join(process.resourcesPath, "app-config.json") : a.join(q(), "app-config.json");
}
function le() {
  try {
    const e = D.readFileSync(z(), "utf8"), t = JSON.parse(e);
    return {
      backendHost: t.backendHost || L.backendHost,
      backendPort: Number(t.backendPort || L.backendPort)
    };
  } catch {
    return L;
  }
}
function V() {
  return a.join(l.getPath("userData"), "backend-data");
}
function E() {
  return a.join(l.getPath("userData"), "logs", "backend.log");
}
function W() {
  const e = process.platform === "win32" ? "chalbolreflow-backend.exe" : "chalbolreflow-backend";
  return a.join(process.resourcesPath, "backend", e);
}
function Q() {
  const e = E();
  D.mkdirSync(a.dirname(e), { recursive: !0 }), f || (f = D.createWriteStream(e, { flags: "a" }));
}
function p(e) {
  Q(), f == null || f.write(`${(/* @__PURE__ */ new Date()).toISOString()} ${e}
`);
}
function r(e, t) {
  t === void 0 ? console.log(`[main] ${e}`) : console.log(`[main] ${e}`, t);
}
function ce(e) {
  return new Promise((t, s) => {
    const i = K.createServer();
    i.unref(), i.on("error", s), i.listen(0, e, () => {
      const u = i.address();
      i.close(() => {
        typeof u == "object" && u && "port" in u ? t(u.port) : s(new Error("Unable to resolve a free backend port."));
      });
    });
  });
}
function de(e, t) {
  return new Promise((s) => {
    const i = K.createServer();
    i.unref(), i.once("error", () => s(!1)), i.listen(e, t, () => {
      i.close(() => s(!0));
    });
  });
}
async function ue(e, t) {
  return await de(e, t) ? e : await ce(t);
}
async function pe(e, t = 6e4) {
  const s = Date.now() + t;
  for (; Date.now() < s; ) {
    try {
      if ((await fetch(`${e}/api/v1/health`)).ok)
        return;
    } catch {
    }
    await new Promise((i) => setTimeout(i, 400));
  }
  throw new Error(`Backend did not become ready within ${t}ms.`);
}
async function fe() {
  const e = le(), t = process.env.CBR_BACKEND_HOST || e.backendHost, s = Number(process.env.CBR_BACKEND_PORT || e.backendPort), i = await ue(s, t);
  T = `http://${t}:${i}`, D.mkdirSync(V(), { recursive: !0 }), Q();
  const u = {
    ...process.env,
    CBR_BACKEND_HOST: t,
    CBR_BACKEND_PORT: String(i),
    CBR_DATA_DIR: V(),
    CBR_CONFIG_PATH: z()
  }, g = l.isPackaged ? W() : process.platform === "win32" ? "python" : "python3", C = l.isPackaged ? ["--host", t, "--port", String(i)] : ["-m", "app.serve", "--host", t, "--port", String(i)], _ = l.isPackaged ? a.dirname(W()) : a.join(q(), "backend");
  p(`Starting backend: ${g} ${C.join(" ")}`), p(`  cwd: ${_}`), p(`  port: ${i} (preferred: ${s})`), r("startBackend:spawn", { backendCommand: g, backendArgs: C, backendCwd: _, resolvedPort: i, preferredPort: s }), c = se(g, C, {
    cwd: _,
    env: u,
    stdio: ["ignore", "pipe", "pipe"]
  }), c.stdout.on("data", (d) => p(`[stdout] ${d.toString().trimEnd()}`)), c.stderr.on("data", (d) => p(`[stderr] ${d.toString().trimEnd()}`)), c.once("exit", (d, h) => {
    p(`backend exited code=${d ?? "null"} signal=${h ?? "null"}`), c = null, Y || (x.showErrorBox(
      "ChalBolReFlow — Backend Error",
      `The backend process exited unexpectedly (code ${d ?? "unknown"}).

Check the log at:
${E()}`
    ), l.exit(d ?? 1));
  }), c.once("error", (d) => {
    const h = d instanceof Error ? d.message : String(d);
    p(`backend failed to start: ${h}`), x.showErrorBox(
      "ChalBolReFlow — Backend Error",
      `Could not start the backend process.

${h}

Check the log at:
${E()}`
    ), l.exit(1);
  });
  try {
    await pe(T), r("startBackend:ready", { backendBaseUrl: T });
  } catch (d) {
    const h = d instanceof Error ? d.message : String(d);
    p(`Backend readiness check failed: ${h}`), x.showErrorBox(
      "ChalBolReFlow — Backend Timeout",
      `The backend did not become ready in time.

${h}

Check the log at:
${E()}`
    ), await J(), l.exit(1);
  }
}
async function J() {
  Y = !0, c && !c.killed && (p("Sending SIGTERM to backend…"), c.kill("SIGTERM"), await new Promise((e) => {
    const t = setTimeout(() => {
      c && !c.killed && (p("Backend did not exit in 5 s — sending SIGKILL"), c.kill("SIGKILL")), e();
    }, 5e3);
    c == null || c.once("exit", () => {
      clearTimeout(t), e();
    });
  })), c = null, f == null || f.end(), f = null;
}
function ge(e) {
  return e.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}
function he() {
  if (process.platform !== "darwin") return null;
  const e = H("osascript", [
    "-e",
    'tell application "System Events" to get name of first application process whose frontmost is true'
  ], { encoding: "utf8" });
  return e.status !== 0 ? null : e.stdout.trim() || null;
}
function we(e, t) {
  if (!e || (ne.writeText(t), process.platform !== "darwin"))
    return;
  const s = ge(e), i = H("osascript", [
    "-e",
    `tell application "${s}" to activate`,
    "-e",
    "delay 0.15",
    "-e",
    'tell application "System Events" to keystroke "v" using command down'
  ], { encoding: "utf8" });
  i.status !== 0 && console.warn("Could not restore the original app focus for paste. Clipboard still contains the dictation text.", i.stderr || i.stdout);
}
function me() {
  const e = oe.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAABmJLR0QA/wD/AP+gvaeTAAAAI0lEQVQ4y2NgFAUMDP8ZGBgYGBgYGBgYGBgYGBgYGBgYGBgWADtqAAV18C28AAAAAElFTkSuQmCC"
  );
  I = new ie(e);
  const t = re.buildFromTemplate([
    {
      label: "Open ChalBolReFlow",
      click: () => {
        S();
      }
    },
    {
      label: "Pause Listening",
      type: "checkbox",
      checked: k,
      click: (s) => {
        k = s.checked, o && o.webContents.send("tray-pause-toggle", k), n && n.webContents.send("tray-pause-toggle", k);
      }
    },
    {
      label: "Settings",
      click: () => {
        S(), o && o.webContents.send("navigate-to", "settings");
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        l.quit();
      }
    }
  ]);
  I.setToolTip("ChalBolReFlow"), I.setContextMenu(t);
}
function j() {
  r("createMainWindow:start"), o = new $({
    width: 900,
    height: 750,
    minWidth: 800,
    minHeight: 550,
    frame: !1,
    transparent: !0,
    roundedCorners: !0,
    hasShadow: !0,
    titleBarStyle: "hidden",
    trafficLightPosition: { x: 16, y: 16 },
    backgroundColor: "#00000000",
    show: !1,
    webPreferences: {
      preload: a.join(F, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    },
    icon: a.join(process.env.VITE_PUBLIC, "icon.png")
  }), Z(o, "main"), o.webContents.on("did-finish-load", () => {
    r("mainWindow:did-finish-load"), O = !0, o == null || o.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString()), te();
  }), m ? (r("mainWindow:loadURL", { url: m }), o.loadURL(m)) : (r("mainWindow:loadFile", { file: a.join(y, "index.html") }), o.loadFile(a.join(y, "index.html"))), o.once("ready-to-show", () => {
    r("mainWindow:ready-to-show"), o == null || o.show();
  }), o.on("closed", () => {
    r("mainWindow:closed"), o = null, O = !1;
  });
}
function be() {
  r("createFloatingWindow:start");
  const { width: e, height: t } = G.getPrimaryDisplay().workAreaSize;
  A = !1, B = !1, v = !1, n = new $({
    width: 344,
    height: 164,
    frame: !1,
    resizable: !1,
    alwaysOnTop: !0,
    transparent: !0,
    hasShadow: !1,
    backgroundColor: "#00000000",
    show: !1,
    webPreferences: {
      preload: a.join(F, "preload.mjs"),
      nodeIntegration: !1,
      contextIsolation: !0
    }
  }), Z(n, "floating"), n.setVisibleOnAllWorkspaces(!0, { visibleOnFullScreen: !0 }), n.setPosition(
    e - 364,
    t - 184
  ), m ? (r("floatingWindow:loadURL", { url: `${m}#/floating` }), n.loadURL(`${m}#/floating`)) : (r("floatingWindow:loadFile", { file: a.join(y, "index.html"), hash: "/floating" }), n.loadFile(a.join(y, "index.html"), { hash: "/floating" })), n.once("ready-to-show", () => {
    r("floatingWindow:ready-to-show"), A = !0, M();
  }), n.on("closed", () => {
    r("floatingWindow:closed"), n = null, A = !1, B = !1, v = !1;
  });
}
function Z(e, t) {
  e.webContents.on("console-message", (s, i, u, g, C) => {
    console.log(`[renderer:${t}] level=${i} ${u} (${C}:${g})`);
  }), e.webContents.on("render-process-gone", (s, i) => {
    console.error(`[renderer:${t}] render-process-gone`, i);
  }), e.webContents.on("did-fail-load", (s, i, u, g) => {
    console.error(`[renderer:${t}] did-fail-load`, { errorCode: i, errorDescription: u, validatedURL: g });
  }), e.webContents.on("unresponsive", () => {
    console.warn(`[renderer:${t}] unresponsive`);
  });
}
function X() {
  r("showFloatingWindow:called", {
    hasFloatingWindow: !!n,
    isFloatingReady: A,
    isLoading: n == null ? void 0 : n.webContents.isLoading()
  }), n || be(), v = !0, ee(), M();
}
function ee() {
  if (!n) return;
  const { width: e, height: t } = G.getPrimaryDisplay().workAreaSize;
  n.setPosition(e - 364, t - 184), n.showInactive();
}
function M() {
  if (!n || !v) return;
  const e = A && B && !n.webContents.isLoading();
  r("sendPendingFloatingStart:check", {
    canStart: e,
    isFloatingReady: A,
    isFloatingRendererReady: B,
    isLoading: n.webContents.isLoading()
  }), e && (v = !1, ee(), setTimeout(() => {
    n && (r("sendPendingFloatingStart:send"), n.webContents.send("global-shortcut-start"));
  }, 50));
}
function ke() {
  r("beginShortcutDictation:called"), P = he(), X(), o == null || o.hide();
}
function S() {
  r("showMainWindow:called", { hasMainWindow: !!o }), o ? (o.isMinimized() && o.restore(), o.show(), o.focus()) : j();
}
b.handle("get-backend-base-url", () => T);
function te() {
  var e;
  !o || !O || !w || (r("flushPendingDictationCompletion:send", {
    hasText: !!((e = w.text) != null && e.trim()),
    duration: w.duration,
    app: w.app
  }), o.webContents.send("navigate-to", "home"), o.webContents.send("dictation-completed-event", w), w = null);
}
function Ae() {
  r("registerShortcuts:start"), R.unregisterAll();
  const e = R.register("Alt+Space", () => {
    U();
  }), t = R.register("Control+Space", () => {
    U();
  });
  r("registerShortcuts:done", { altRegistered: e, ctrlRegistered: t });
}
function U() {
  r("toggleDictationViaShortcut:called", {
    isPaused: k,
    floatingVisible: !!(n && n.isVisible())
  }), !k && (n && n.isVisible() ? n.webContents.send("global-shortcut-stop") : ke());
}
b.on("window-action", (e, t) => {
  r("ipc:window-action", { action: t });
  const s = $.fromWebContents(e.sender);
  s && (t === "minimize" ? s.minimize() : t === "close" ? s === o ? process.platform === "darwin" ? o.hide() : l.quit() : s.close() : t === "hide" && s.hide());
});
b.on("start-dictation", () => {
  r("ipc:start-dictation"), X(), o == null || o.hide();
});
b.on("stop-dictation", () => {
  r("ipc:stop-dictation"), n && n.isVisible() ? n.webContents.send("global-shortcut-stop") : (n == null || n.hide(), S());
});
b.on("cancel-dictation", () => {
  r("ipc:cancel-dictation"), n == null || n.hide(), P = null, S(), o && o.webContents.send("dictation-cancelled-event");
});
b.on("floating-renderer-ready", () => {
  r("ipc:floating-renderer-ready"), B = !0, M();
});
b.on("dictation-complete", (e, t) => {
  var s;
  r("ipc:dictation-complete", {
    hasText: !!((s = t == null ? void 0 : t.text) != null && s.trim()),
    duration: t == null ? void 0 : t.duration,
    app: t == null ? void 0 : t.app
  }), n == null || n.hide(), P ? we(P, t.text) : S(), P = null, w = t, te();
});
l.whenReady().then(async () => {
  if (process.platform === "darwin")
    try {
      l.setActivationPolicy("regular");
    } catch (t) {
      console.warn("Failed to set a regular activation policy on macOS.", t);
    }
  r("app:ready"), console.log("Mic Status:", N.getMediaAccessStatus("microphone"));
  const e = await N.askForMediaAccess("microphone");
  console.log("Mic Granted:", e), await fe(), r("app:create-ui"), me(), j(), Ae(), l.on("activate", () => {
    $.getAllWindows().length === 0 ? j() : S();
  });
});
l.on("before-quit", () => {
  J();
});
l.on("will-quit", () => {
  R.unregisterAll();
});
l.on("window-all-closed", () => {
  process.platform !== "darwin" && l.quit();
});
export {
  Re as MAIN_DIST,
  y as RENDERER_DIST,
  m as VITE_DEV_SERVER_URL
};
