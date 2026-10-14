/* Reji (yönetim paneli) — giriş, menü, panel dili ve görünüm yönlendirmesi */
import { api, setCsrf, setSiteUrl, siteHref, whenUnauthorized } from "./api.js";
import { applyStatic, locale, onLangChange, setLang, t } from "./i18n.js";
import { $, $$, bindModal, readForm, toast, toastError } from "./ui.js";

const VIEWS = Object.freeze({
  ozet: () => import("./views/ozet.js"),
  maclar: () => import("./views/maclar.js"),
  kanallar: () => import("./views/kanallar.js"),
  reklam: () => import("./views/reklam.js"),
  metinler: () => import("./views/metinler.js"),
  ayarlar: () => import("./views/ayarlar.js"),
  hesap: () => import("./views/hesap.js"),
});

const el = {
  login: $("#login"), loginForm: $("#loginForm"), loginError: $("#loginError"),
  app: $("#app"), view: $("#view"), whoami: $("#whoami"), clock: $("#clock"),
  onairCount: $("#onairCount"), logout: $("#logoutBtn"),
};

let session = null;
let renderToken = 0;

const currentView = () => {
  const name = window.location.hash.replace("#", "");
  return Object.hasOwn(VIEWS, name) ? name : "ozet";
};

export async function refreshOnAir() {
  try {
    const matches = await api("/matches");
    el.onairCount.textContent = String(matches.filter((m) => m.status === "live").length);
  } catch {
    // üst bilgi sayacı kritik değil
  }
}

async function route() {
  if (!session) return;
  const name = currentView();
  const token = ++renderToken;
  $$(".side__link").forEach((a) => a.setAttribute("aria-current", a.dataset.view === name ? "page" : "false"));
  el.view.dataset.view = name;
  document.title = `${t(`nav.${name}`)} · ${t("top.brand")} · İlkkan Sports`;
  // Her görünüm yeni bir kapta çizilir: eski görünümün olay dinleyicileri kapla birlikte gider
  const root = document.createElement("div");
  root.className = "view__inner";
  const loading = document.createElement("p");
  loading.className = "loading";
  loading.textContent = t("common.loading");
  root.append(loading);
  el.view.replaceChildren(root);
  try {
    const mod = await VIEWS[name]();
    if (token !== renderToken) return; // bu arada başka sayfaya geçildi
    await mod.render(root, { refreshOnAir });
  } catch (error) {
    if (token !== renderToken) return;
    const p = document.createElement("p");
    p.className = "empty-state";
    p.textContent = t("common.viewFailed", { error: error instanceof Error ? error.message : error });
    root.replaceChildren(p);
  }
}

function showLogin() {
  session = null;
  setCsrf("");
  el.app.hidden = true;
  el.login.hidden = false;
  el.loginForm.reset();
  $("input[name=username]", el.loginForm).focus();
}

function linkSite(url) {
  setSiteUrl(url);
  $$("[data-site-link]").forEach((a) => { a.href = siteHref("/"); });
}

function showApp(me) {
  session = me;
  setCsrf(me.csrf);
  linkSite(me.siteUrl);
  el.whoami.textContent = me.username;
  el.login.hidden = true;
  el.app.hidden = false;
  refreshOnAir();
  route();
}

function bindLogin() {
  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const body = readForm(el.loginForm);
    const submit = $("button[type=submit]", el.loginForm);
    submit.disabled = true;
    el.loginError.hidden = true;
    try {
      showApp(await api("/login", { method: "POST", body }));
      toast(t("login.welcome", { name: body.username }));
    } catch (error) {
      el.loginError.textContent = error.message;
      el.loginError.hidden = false;
    } finally {
      submit.disabled = false;
    }
  });
}

let clockFmt = null;
const tick = () => {
  if (!clockFmt) clockFmt = new Intl.DateTimeFormat(locale(), { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  el.clock.textContent = clockFmt.format(Date.now());
};

function bindShell() {
  el.logout.addEventListener("click", async () => {
    try {
      await api("/logout", { method: "POST" });
    } catch (error) {
      toastError(error);
    }
    showLogin();
  });
  window.addEventListener("hashchange", route);
  // Panel dili: TR | EN düğmeleri (giriş ekranında ve üst çubukta)
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-lang]");
    if (btn) setLang(btn.dataset.lang);
  });
  onLangChange(() => {
    clockFmt = null;
    tick();
    route(); // açık ekranı yeni dilde yeniden çiz
  });
  tick();
  setInterval(tick, 1000);
}

async function boot() {
  applyStatic();
  bindModal();
  bindLogin();
  bindShell();
  whenUnauthorized(() => {
    if (session) toast(t("login.expired"), "error");
    showLogin();
  });
  try {
    const probe = await api("/session");
    linkSite(probe.siteUrl);
    if (probe.authenticated) showApp(probe);
    else showLogin();
  } catch {
    showLogin();
  }
}

boot();
