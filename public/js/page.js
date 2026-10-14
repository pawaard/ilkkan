/* ======================================================
   İLKKAN SPORTS — Sayfa: menü, saat, derbi, hatırlatıcı, başa sar
   ====================================================== */
import { $, $$, pad, prose, store, toast } from "./core.js";
import { LOCALE, t } from "./i18n.js";
import { byId, DATA, getChannels, liveMatches } from "./state.js";

const el = {
  nav: $("#nav"), burger: $("#burger"), clock: $("#clock"), today: $("#today"), year: $("#year"),
  cdH: $("#cdH"), cdM: $("#cdM"), cdS: $("#cdS"), prediction: $("#derbyPrediction"),
  derbyHome: $("#derbyHome"), derbyAway: $("#derbyAway"), derbyMeta: $("#derbyMeta"),
  aside: $(".derby__aside"), remind: $("#remindBtn"), ics: $("#icsBtn"), rewind: $("#rewind"),
};

const derbyMatch = () => byId(DATA.derby.matchId) || null;

const ISTANBUL_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });
const DAY_MS = 24 * 3600 * 1000;

/**
 * Başlama anı. Maç saatleri Türkiye saatidir (UTC+3, yaz saati uygulanmaz):
 * yurt dışındaki ziyaretçide de geri sayım aynı ana kurulur. Saat geçtiyse ertesi gün (gece maçları).
 */
function nextKickoff(hhmm) {
  const target = Date.parse(`${ISTANBUL_DAY.format(new Date())}T${hhmm}:00+03:00`);
  return target <= Date.now() ? target + DAY_MS : target;
}

/* ---------- Statik alanlar ---------- */
export function refreshCounts() {
  const n = String(liveMatches().length);
  $$("[data-live-count]").forEach((node) => { node.textContent = n; });
}

export function fillStatic() {
  const now = new Date();
  refreshCounts();
  el.today.textContent = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "long", weekday: "long" }).format(now);
  el.today.dateTime = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  el.prediction.textContent = DATA.derby.prediction;
  el.year.textContent = String(now.getFullYear());
  const m = derbyMatch();
  if (!m) return;
  el.derbyHome.textContent = m.home;
  el.derbyAway.textContent = m.away;
  const on = getChannels().filter((c) => c.matchId === m.id).map((c) => c.name);
  el.derbyMeta.textContent = [m.league, t("derby.today", { time: prose(DATA.derby.kickoff) }), on.join(" & ")].filter(Boolean).join(" · ");
}

/* ---------- Saat + derbi sayacı ---------- */
const DERBY_ASIDE = Object.freeze({
  upcoming: t("derby.upcoming"),
  live: t("derby.live"),
  finished: t("derby.finished"),
});

export function runClocks() {
  const timeFmt = new Intl.DateTimeFormat(LOCALE, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  const kickoff = nextKickoff(DATA.derby.kickoff);
  const tick = () => {
    const now = Date.now();
    el.clock.textContent = timeFmt.format(now);
    const m = derbyMatch();
    const status = m ? m.status : "upcoming";
    const s = status === "upcoming" ? Math.max(0, Math.floor((kickoff - now) / 1000)) : 0;
    el.cdH.textContent = pad(Math.floor(s / 3600));
    el.cdM.textContent = pad(Math.floor(s / 60) % 60);
    el.cdS.textContent = pad(s % 60);
    if (el.aside) el.aside.textContent = DERBY_ASIDE[status] || DERBY_ASIDE.upcoming;
  };
  tick();
  setInterval(tick, 1000);
}

/* ---------- Hatırlatıcı: sayfa açıkken bildirim + her durumda takvim dosyası ---------- */
let remindTimer = 0;

function notify(title, body) {
  toast(`${title} ${body}`);
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: "ilkkan-derbi" });
  } catch {
    // Bazı mobil tarayıcılar sayfa içinden bildirime izin vermez; toast yeterli
  }
}

function schedule(on) {
  clearTimeout(remindTimer);
  if (!on) return;
  const wait = nextKickoff(DATA.derby.kickoff) - Date.now() - 60_000;
  if (wait < 0 || wait > 24 * 3600 * 1000) return;
  const m = derbyMatch();
  const name = m ? `${m.home} – ${m.away}` : t("derby.name");
  remindTimer = setTimeout(() => notify(t("remind.title"), t("remind.body", { name })), wait);
}

async function askPermission() {
  if (!("Notification" in window) || Notification.permission !== "default") return;
  try {
    await Notification.requestPermission();
  } catch {
    // İzin penceresi açılamadı; hatırlatma yine toast olarak gelir
  }
}

export function bindRemind() {
  const key = `ilkkan:hatirlat:${DATA.derby.matchId}`;
  const label = el.remind.querySelector("span");
  const paint = (on) => {
    el.remind.setAttribute("aria-pressed", String(on));
    label.textContent = t(on ? "remind.on" : "remind.off");
  };
  const initial = store.get(key) === "1";
  paint(initial);
  schedule(initial);
  el.remind.addEventListener("click", async () => {
    const on = el.remind.getAttribute("aria-pressed") !== "true";
    paint(on);
    schedule(on);
    const saved = store.set(key, on ? "1" : "0");
    const message = t(on ? "remind.set" : "remind.cancel");
    toast(saved ? message : `${message} ${t("remind.notSaved")}`);
    if (on) await askPermission();
  });
  el.ics.addEventListener("click", downloadIcs);
}

/* ---------- Takvim dosyası (.ics) ---------- */
const icsText = (value) => String(value).replace(/[\\,;]/g, (ch) => `\\${ch}`).replace(/\r?\n/g, "\\n");
const icsDate = (ms) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

function downloadIcs() {
  const m = derbyMatch();
  if (!m) {
    toast(t("ics.missing"));
    return;
  }
  const start = nextKickoff(DATA.derby.kickoff);
  const url = `${window.location.origin}/mac/${encodeURIComponent(m.id)}`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//İlkkan Sports//TR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${m.id}-${icsDate(start).slice(0, 8)}@ilkkan-sports`,
    `DTSTAMP:${icsDate(Date.now())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(start + 2 * 3600 * 1000)}`,
    `SUMMARY:${icsText(`${m.home} – ${m.away}`)}`,
    `DESCRIPTION:${icsText(`${t("ics.description", { league: m.league })}\n${url}`)}`,
    `URL:${url}`,
    "BEGIN:VALARM", "TRIGGER:-PT10M", "ACTION:DISPLAY", `DESCRIPTION:${icsText(t("ics.alarm"))}`, "END:VALARM",
    "END:VEVENT", "END:VCALENDAR",
  ];
  const blob = new Blob([`${lines.join("\r\n")}\r\n`], { type: "text/calendar;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `ilkkan-${m.id}.ics`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(link.href), 4000);
  toast(t("ics.done"));
}

/* ---------- Menü + bölüm takibi ---------- */
export function bindNav() {
  const close = () => {
    el.nav.classList.remove("is-open");
    el.burger.setAttribute("aria-expanded", "false");
    el.burger.setAttribute("aria-label", t("menu.open"));
  };
  el.burger.addEventListener("click", () => {
    const open = el.burger.getAttribute("aria-expanded") !== "true";
    el.nav.classList.toggle("is-open", open);
    el.burger.setAttribute("aria-expanded", String(open));
    el.burger.setAttribute("aria-label", t(open ? "menu.close" : "menu.open"));
  });
  el.nav.addEventListener("click", (e) => {
    if (e.target.closest("a")) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  if (!("IntersectionObserver" in window)) return;
  const links = $$(".nav__link", el.nav);
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((a) => a.classList.toggle("is-active", a.hash === `#${entry.target.id}`));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  ["canli", "kanallar", "kose", "iletisim"]
    .map((id) => document.getElementById(id))
    .filter(Boolean)
    .forEach((section) => spy.observe(section));
}

export function bindRewind() {
  let queued = false;
  const update = () => {
    el.rewind.classList.toggle("is-shown", window.scrollY > 900);
    queued = false;
  };
  window.addEventListener("scroll", () => {
    if (queued) return;
    queued = true;
    requestAnimationFrame(update);
  }, { passive: true });
  update();
}
