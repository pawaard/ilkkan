/* ======================================================
   İLKKAN SPORTS — Ortak yardımcılar
   DOM kısayolları · kaçış · bildirim · depolama · sayaç
   ====================================================== */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

export const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export const scrollMode = reduceMotion ? "auto" : "smooth";

const ESCAPES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });
export const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
export const pad = (n) => String(n).padStart(2, "0");
// Saat yazımı dile göre: Türkçe "20.00", İngilizce "20:00"
export { formatTime as prose } from "./i18n.js";

const CAT_COLORS = Object.freeze({
  futbol: "var(--c-futbol)",
  basketbol: "var(--c-basketbol)",
  voleybol: "var(--c-voleybol)",
  kanal: "var(--c-kanal)",
});
export const dotOf = (cat) => CAT_COLORS[cat] || CAT_COLORS.kanal;

// Türkçe karakterleri sadeleştir: "besiktas" → "Beşiktaş" eşleşir
const FOLD = Object.freeze({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" });
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");
export const fold = (text) =>
  String(text)
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (ch) => FOLD[ch])
    .normalize("NFD")
    .replace(COMBINING, "");

/* ---------- Bildirim (toast) ----------
   Canlı bölge baştan sayfada durur: ekran okuyucular ilk mesajı da duyurur */
const toastNode = document.createElement("div");
toastNode.className = "toast";
toastNode.setAttribute("role", "status");
toastNode.setAttribute("aria-live", "polite");
document.body.append(toastNode);
let toastTimer = 0;
export function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.add("is-shown");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastNode.classList.remove("is-shown"), 3400);
}

/* ---------- Depolama: gizli sekmede erişilemeyebilir, bunu açıkça döndürür ---------- */
const storage = (kind) => ({
  get(key) {
    try { return window[kind].getItem(key); } catch { return null; }
  },
  set(key, value) {
    try { window[kind].setItem(key, value); return true; } catch { return false; }
  },
});
export const store = storage("localStorage");
export const sessionStore = storage("sessionStorage");

/* ---------- Çerezsiz sayaç: görüntüleme, reklam gösterim/tıklama, oynatma ---------- */
export function track(event, key = "") {
  const body = JSON.stringify({ e: event, k: key });
  try {
    if (navigator.sendBeacon && navigator.sendBeacon("/api/t", body)) return;
    fetch("/api/t", { method: "POST", body, keepalive: true }).catch(() => {});
  } catch {
    // Sayaç çalışmazsa site etkilenmesin
  }
}
