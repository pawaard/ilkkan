// Dil altyapısı: desteklenen diller, adresler, sözlük erişimi
import siteEn from "./site.en.js";
import siteTr from "./site.tr.js";

export const LANGS = Object.freeze(["tr", "en"]);
export const DEFAULT_LANG = "tr";
export const isLang = (value) => LANGS.includes(value);
export const otherLang = (lang) => (lang === "en" ? "tr" : "en");

export const LOCALE = Object.freeze({ tr: "tr-TR", en: "en-GB" });
export const OG_LOCALE = Object.freeze({ tr: "tr_TR", en: "en_GB" });

const SITE = Object.freeze({ tr: siteTr, en: siteEn });
export const siteDict = (lang) => SITE[lang] || SITE[DEFAULT_LANG];

/** Sözlükten metin; {ad} yer tutucuları doldurulur. Eksik anahtar = programlama hatası. */
export function t(lang, key, vars = {}) {
  const dict = siteDict(lang);
  if (!Object.hasOwn(dict, key)) throw new Error(`Çeviri anahtarı yok: ${lang}.${key}`);
  return dict[key].replace(/\{(\w+)\}/g, (_, name) => (Object.hasOwn(vars, name) ? String(vars[name]) : `{${name}}`));
}

// Türkçe ve İngilizce adresler (Türkçe kök, İngilizce /en/ altında)
export const PATHS = Object.freeze({
  home: { tr: "/", en: "/en/" },
  privacy: { tr: "/kvkk", en: "/en/privacy" },
  cookies: { tr: "/cerez-politikasi", en: "/en/cookies" },
  terms: { tr: "/kullanim-kosullari", en: "/en/terms" },
});
export const matchPath = (lang, id) => (lang === "en" ? `/en/match/${id}` : `/mac/${id}`);

/** Adres hangi dilde? (/en/… → en) */
export const langOfPath = (path) => (path === "/en" || path.startsWith("/en/") ? "en" : DEFAULT_LANG);

/** Yönetim API'si için istek dili: panel X-Lang başlığı ya da ?lang= ; bilinmeyen → tr */
export function requestLang(req) {
  const raw = String(req.get("x-lang") || req.query.lang || "").toLowerCase();
  return isLang(raw) ? raw : DEFAULT_LANG;
}
