// SEO: yapılandırılmış veri (JSON-LD), çok dilli sitemap.xml (hreflang), robots.txt
import { LANGS, LOCALE, matchPath, PATHS } from "./i18n/index.js";
import { dayKey, shiftDay } from "./stats.js";
import { escapeHtml } from "./render/template.js";

// Yasal sayfalar: adres ve gövde dosyası dile göre (server/pages/… , server/pages/en/…)
export const LEGAL_PAGES = Object.freeze([
  { id: "privacy", titleKey: "legal.privacy", file: { tr: "kvkk.html", en: "en/privacy.html" } },
  { id: "cookies", titleKey: "legal.cookies", file: { tr: "cerez-politikasi.html", en: "en/cookies.html" } },
  { id: "terms", titleKey: "legal.terms", file: { tr: "kullanim-kosullari.html", en: "en/terms.html" } },
]);

const SPORT = Object.freeze({
  tr: { futbol: "Futbol", basketbol: "Basketbol", voleybol: "Voleybol" },
  en: { futbol: "Football", basketbol: "Basketball", voleybol: "Volleyball" },
});
const MATCH_DESC = Object.freeze({
  tr: (m) => `${m.league}: ${m.home} – ${m.away} canlı yayın ve skor.`,
  en: (m) => `${m.league}: ${m.home} vs ${m.away} live stream and score.`,
});

const ISTANBUL_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit", hour12: false });

/** Maçın başlama zamanı (Türkiye saati, UTC+3). Saati geçmiş "yakında" maç ertesi güne aittir. */
export function kickoffIso(match, now = new Date()) {
  const today = dayKey(now);
  const passed = ISTANBUL_TIME.format(now) > match.time;
  const day = match.status === "upcoming" && passed ? shiftDay(today, 1) : today;
  return `${day}T${match.time}:00+03:00`;
}

export function matchJsonLd(match, { siteUrl, siteName, now, lang = "tr" }) {
  return {
    "@context": "https://schema.org",
    "@type": "SportsEvent",
    name: `${match.home} – ${match.away}`,
    description: MATCH_DESC[lang](match),
    sport: SPORT[lang][match.cat] || match.cat,
    startDate: kickoffIso(match, now),
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OnlineEventAttendanceMode",
    inLanguage: LOCALE[lang],
    location: { "@type": "VirtualLocation", url: `${siteUrl}${matchPath(lang, match.id)}` },
    homeTeam: { "@type": "SportsTeam", name: match.home },
    awayTeam: { "@type": "SportsTeam", name: match.away },
    organizer: { "@type": "Organization", name: siteName, url: siteUrl },
  };
}

export function siteJsonLd({ siteUrl, site, lang = "tr" }) {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: site.title,
    description: site.description,
    url: `${siteUrl}${PATHS.home[lang]}`,
    inLanguage: LOCALE[lang],
  };
}

export function sitemapXml({ siteUrl, matches, today = dayKey() }) {
  const pages = [
    { paths: PATHS.home, freq: "always", priority: "1.0" },
    ...matches.map((m) => ({
      paths: Object.fromEntries(LANGS.map((l) => [l, matchPath(l, m.id)])),
      freq: m.status === "live" ? "always" : "hourly",
      priority: "0.8",
    })),
    ...LEGAL_PAGES.map((p) => ({ paths: PATHS[p.id], freq: "yearly", priority: "0.2" })),
  ];
  // Her dil kendi <url>'i; her birinde tüm dillerin xhtml:link alternatifleri (Google'ın önerdiği biçim)
  const body = pages.flatMap((page) => {
    const links = [
      ...LANGS.map((l) => `<xhtml:link rel="alternate" hreflang="${l}" href="${escapeHtml(siteUrl + page.paths[l])}"/>`),
      `<xhtml:link rel="alternate" hreflang="x-default" href="${escapeHtml(siteUrl + page.paths.tr)}"/>`,
    ].join("");
    return LANGS.map((l) =>
      `  <url><loc>${escapeHtml(siteUrl + page.paths[l])}</loc>${links}<lastmod>${today}</lastmod><changefreq>${page.freq}</changefreq><priority>${page.priority}</priority></url>`);
  }).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${body}\n</urlset>\n`;
}

export const robotsTxt = ({ siteUrl }) =>
  `User-agent: *\nDisallow: /yonetim\nDisallow: /api/\n\nSitemap: ${siteUrl}/sitemap.xml\n`;
