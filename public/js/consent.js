/* ======================================================
   İLKKAN SPORTS — Çerez onayı
   Site kendi işleyişi için çerez kullanmaz. Bant yalnızca panelde
   "reklam kodu" modunda bir alan varsa çıkar; kod onay gelmeden yüklenmez.
   ====================================================== */
import { $$, esc, store } from "./core.js";
import { t } from "./i18n.js";

const KEY = "ilkkan:cerez";
const listeners = new Set();
let banner = null;

export const consentGiven = () => store.get(KEY) === "evet";
export const onConsentChange = (fn) => listeners.add(fn);

function decide(value) {
  store.set(KEY, value);
  close();
  listeners.forEach((fn) => fn(value === "evet"));
}

function close() {
  if (!banner) return;
  banner.remove();
  banner = null;
}

function open() {
  if (banner) return;
  banner = document.createElement("section");
  banner.className = "consent";
  banner.setAttribute("role", "dialog");
  banner.setAttribute("aria-labelledby", "consent-title");
  banner.setAttribute("aria-describedby", "consent-text");
  banner.innerHTML = `
    <div class="consent__body">
      <p class="consent__title" id="consent-title">${esc(t("consent.title"))}</p>
      <p class="consent__text" id="consent-text">${esc(t("consent.text"))} <a href="${esc(t("consent.policy"))}">${esc(t("consent.more"))}</a></p>
    </div>
    <div class="consent__actions">
      <button class="consent__btn consent__btn--no" type="button" data-choice="hayir">${esc(t("consent.no"))}</button>
      <button class="consent__btn consent__btn--yes" type="button" data-choice="evet">${esc(t("consent.yes"))}</button>
    </div>`;
  banner.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-choice]");
    if (btn) decide(btn.dataset.choice);
  });
  document.body.append(banner);
  banner.querySelector('[data-choice="evet"]').focus({ preventScroll: true });
}

/** @param {{ needed: boolean }} options  needed: sayfada çerez kullanan reklam kodu var mı */
export function initConsent({ needed }) {
  // "Çerez tercihleri" bağlantısı her zaman çalışır (onayı geri çekmek için)
  $$("[data-consent-open]").forEach((btn) => btn.addEventListener("click", open));
  if (needed && store.get(KEY) === null) open();
}
