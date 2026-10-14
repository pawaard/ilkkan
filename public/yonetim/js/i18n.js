/* Panel arayüz dili (TR / EN) — içerik dilinden bağımsız; tarayıcıda hatırlanır */
import en from "./lang/en.js";
import tr from "./lang/tr.js";

const DICTS = Object.freeze({ tr, en });
const KEY = "ilkkan:panel-dil";
const listeners = new Set();

const stored = () => {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
};

let lang = stored() === "en" ? "en" : "tr";

export const getLang = () => lang;
export const locale = () => (lang === "en" ? "en-GB" : "tr-TR");
export const onLangChange = (fn) => listeners.add(fn);

/** Metin; {ad} yer tutucuları doldurulur. Değerler ekrana html`` ile basılırken kaçışlanır. */
export function t(key, vars = {}) {
  const text = DICTS[lang][key] ?? DICTS.tr[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : ""));
}

/** index.html'deki sabit metinler: data-i18n (metin), data-i18n-html (koddaki güvenilir HTML), data-i18n-attr="aria-label:anahtar" */
export function applyStatic(root = document) {
  document.documentElement.lang = lang;
  root.querySelectorAll("[data-i18n]").forEach((node) => { node.textContent = t(node.dataset.i18n); });
  root.querySelectorAll("[data-i18n-html]").forEach((node) => { node.innerHTML = t(node.dataset.i18nHtml); });
  root.querySelectorAll("[data-i18n-attr]").forEach((node) => {
    node.dataset.i18nAttr.split(";").forEach((pair) => {
      const [attr, key] = pair.split(":");
      if (attr && key) node.setAttribute(attr.trim(), t(key.trim()));
    });
  });
  root.querySelectorAll("[data-lang]").forEach((btn) => btn.setAttribute("aria-pressed", String(btn.dataset.lang === lang)));
}

export function setLang(next) {
  if (next !== "tr" && next !== "en") return;
  lang = next;
  try {
    window.localStorage.setItem(KEY, next);
  } catch {
    // gizli sekme: dil bu oturumda geçerli, hatırlanmaz
  }
  applyStatic();
  listeners.forEach((fn) => fn(next));
}
