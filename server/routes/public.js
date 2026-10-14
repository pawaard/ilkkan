// Sitenin herkese açık sayfaları ve verisi — Türkçe kökte, İngilizce /en/ altında
import express from "express";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { getSettingLang } from "../db.js";
import { isLang, LANGS, langOfPath, matchPath, OG_LOCALE, otherLang, PATHS, siteDict, t } from "../i18n/index.js";
import { buildLiveData, safeJson, siteDataScript, siteMatches } from "../site-data.js";
import { renderMatchPage } from "../render/match-page.js";
import { pageShell } from "../render/shell.js";
import { renderTemplate, templateLoader } from "../render/template.js";
import { LEGAL_PAGES, robotsTxt, siteJsonLd, sitemapXml } from "../seo.js";

const PAGES_DIR = fileURLToPath(new URL("../pages/", import.meta.url));

const DEFAULT_SITE = Object.freeze({
  title: "İlkkan Sports",
  tagline: "",
  description: "",
  telegramUrl: "",
  xUrl: "",
  contactNote: "",
});
const DEFAULT_IMAGES = Object.freeze({
  posterLeft: "/assets/img/ilkkan-portre.jpg",
  posterRight: "/assets/img/ilkkan-sahne.jpg",
  hero: "/assets/img/ilkkan-sahne.jpg",
  card: "/assets/img/ilkkan-portre.jpg",
  heroAlt: "",
  cardAlt: "",
});
const ALT_FALLBACK = Object.freeze({
  tr: { hero: "İlkkan Sports tanıtım görseli", card: "İlkkan oyuncu kartı görseli" },
  en: { hero: "İlkkan Sports promo image", card: "İlkkan player card image" },
});

const noStore = (res) => res.setHeader("Cache-Control", "no-store");
const queryLang = (req) => (isLang(String(req.query.lang)) ? String(req.query.lang) : "tr");
const homeAlternates = Object.freeze({ ...PATHS.home });

// server/pages/*.html gövde parçaları (üretimde bir kez okunur)
function createPartials(cache) {
  const store = new Map();
  return (name) => {
    if (cache && store.has(name)) return store.get(name);
    const html = readFileSync(join(PAGES_DIR, name), "utf8");
    if (cache) store.set(name, html);
    return html;
  };
}

export function publicRouter(db, { config, publicDir, version }) {
  const router = express.Router();
  const cache = config.production;
  const indexTemplate = templateLoader(join(publicDir, "index.html"), { cache });
  const partial = createPartials(cache);
  const ogImage = (lang) => `${config.siteUrl}/assets/img/${lang === "en" ? "og-en" : "og"}.jpg`;
  const site = (lang) => ({ ...DEFAULT_SITE, ...getSettingLang(db, "site", lang, {}) });

  function renderHome(lang) {
    const s = site(lang);
    const img = { ...DEFAULT_IMAGES, ...getSettingLang(db, "images", lang, {}) };
    const alt = otherLang(lang);
    const url = (path) => `${config.siteUrl}${path}`;
    return renderTemplate(indexTemplate(), {
      V: version(),
      LANG: lang,
      OG_LOCALE: OG_LOCALE[lang],
      OG_LOCALE_ALT: OG_LOCALE[alt],
      URL_TR: url(PATHS.home.tr),
      URL_EN: url(PATHS.home.en),
      ALT_URL: PATHS.home[alt],
      ALT_LANG: alt,
      ALT_LANG_LABEL: alt.toUpperCase(),
      DATA_SRC: lang === "tr" ? "/data.js" : `/data.js?lang=${lang}`,
      URL_PRIVACY: PATHS.privacy[lang],
      URL_COOKIES: PATHS.cookies[lang],
      URL_TERMS: PATHS.terms[lang],
      TITLE: s.tagline ? `${s.title} — ${s.tagline}` : s.title,
      SITE_NAME: s.title,
      DESCRIPTION: s.description,
      CANONICAL: url(PATHS.home[lang]),
      OG_IMAGE: ogImage(lang),
      JSONLD: safeJson(siteJsonLd({ siteUrl: config.siteUrl, site: s, lang })),
      IMG_POSTER_L: img.posterLeft,
      IMG_POSTER_R: img.posterRight,
      IMG_HERO: img.hero,
      IMG_HERO_ALT: img.heroAlt || ALT_FALLBACK[lang].hero,
      IMG_CARD: img.card,
      IMG_CARD_ALT: img.cardAlt || ALT_FALLBACK[lang].card,
      TG_URL: s.telegramUrl || "#iletisim",
      TG_HIDDEN: s.telegramUrl ? "" : "hidden",
      X_URL: s.xUrl || "#iletisim",
      X_HIDDEN: s.xUrl ? "" : "hidden",
      CONTACT_NOTE: s.contactNote,
    }, siteDict(lang));
  }

  router.get("/", (req, res) => {
    noStore(res);
    res.type("html").send(renderHome("tr"));
  });

  // "/en" ve "/en/" aynı rota (Express katı olmayan yönlendirme): kanonik adres "/" ile biter
  router.get("/en/", (req, res) => {
    if (!req.originalUrl.split("?")[0].endsWith("/")) return res.redirect(301, "/en/");
    noStore(res);
    return res.type("html").send(renderHome("en"));
  });

  // Şablon dosyasının kendisi dışarı açılmasın
  router.get(["/index.html", "/index"], (req, res) => res.redirect(301, "/"));

  router.get("/data.js", (req, res) => {
    noStore(res);
    res.type("application/javascript; charset=utf-8").send(siteDataScript(db, queryLang(req)));
  });

  router.get("/api/live", (req, res) => {
    noStore(res);
    res.json({ success: true, data: buildLiveData(db, queryLang(req)) });
  });

  LANGS.forEach((lang) => {
    router.get(matchPath(lang, ":id"), (req, res, next) => {
      const matches = siteMatches(db, lang);
      const match = matches.find((m) => m.id === req.params.id);
      if (!match) return next();
      res.setHeader("Cache-Control", "no-cache");
      return res.type("html").send(renderMatchPage({
        lang, match, matches, site: site(lang), siteUrl: config.siteUrl, version: version(), ogImage: ogImage(lang),
      }));
    });

    LEGAL_PAGES.forEach((page) => {
      router.get(PATHS[page.id][lang], (req, res) => {
        const s = site(lang);
        const title = t(lang, page.titleKey);
        res.setHeader("Cache-Control", "no-cache");
        res.type("html").send(pageShell({
          lang,
          title: `${title} · ${s.title}`,
          description: t(lang, "legal.description", { site: s.title, title: title.toLocaleLowerCase(lang) }),
          canonical: `${config.siteUrl}${PATHS[page.id][lang]}`,
          siteUrl: config.siteUrl,
          alternates: PATHS[page.id],
          ogImage: ogImage(lang),
          version: version(),
          site: s,
          body: partial(page.file[lang]),
        }));
      });
    });
  });

  router.get("/sitemap.xml", (req, res) => {
    res.type("application/xml").send(sitemapXml({ siteUrl: config.siteUrl, matches: siteMatches(db) }));
  });

  router.get("/robots.txt", (req, res) => {
    res.type("text/plain").send(robotsTxt({ siteUrl: config.siteUrl }));
  });

  return router;
}

/** Bulunamayan sayfa: API için JSON, diğerleri için temalı 404 sayfası (adresin dilinde) */
export function notFound(db, { config, version }) {
  const partial = createPartials(config.production);
  return (req, res) => {
    if (req.path.startsWith("/api/")) return res.status(404).json({ success: false, error: "Bulunamadı." });
    const lang = langOfPath(req.path);
    const s = { ...DEFAULT_SITE, ...getSettingLang(db, "site", lang, {}) };
    return res.status(404).type("html").send(pageShell({
      lang,
      title: `${t(lang, "notFound.title")} · ${s.title}`,
      description: t(lang, "notFound.description"),
      ogImage: `${config.siteUrl}/assets/img/${lang === "en" ? "og-en" : "og"}.jpg`,
      version: version(),
      site: s,
      noindex: true,
      alternates: homeAlternates,
      body: partial(lang === "en" ? "en/404.html" : "404.html"),
    }));
  };
}
