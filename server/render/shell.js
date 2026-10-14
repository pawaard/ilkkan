// Alt sayfaların ortak iskeleti (maç detayı, yasal sayfalar, 404): sitenin başlığı + jeneriği, iki dilde
import { escapeHtml as e } from "./template.js";
import { safeJson } from "../site-data.js";
import { LEGAL_PAGES } from "../seo.js";
import { OG_LOCALE, otherLang, PATHS, t } from "../i18n/index.js";

const FAVICON = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 40 40'%3E%3Ccircle cx='20' cy='20' r='19' fill='%230b0c18'/%3E%3Cg fill='none' stroke='%237ee2b8' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M13.6 11.5h12.8c-.4 4-2.8 6.1-3 9.5-.2 3 2.2 4.6 2.2 7.4H14.4c0-2.8 2.4-4.4 2.2-7.4-.2-3.4-2.6-5.5-3-9.5z'/%3E%3Cpath d='M10.5 31h19'/%3E%3C/g%3E%3C/svg%3E";

const CREST = `<svg class="brand__crest" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18.6" fill="none" stroke="currentColor" stroke-opacity=".4" stroke-width="1.2"/><g fill="none" stroke="#7ee2b8" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M13.6 11.5h12.8c-.4 4-2.8 6.1-3 9.5-.2 3 2.2 4.6 2.2 7.4H14.4c0-2.8 2.4-4.4 2.2-7.4-.2-3.4-2.6-5.5-3-9.5z"/><path d="M14.5 15h11M10.6 31h18.8M18 8.6c-.7-.9.7-1.6 0-2.6M22 8.6c-.7-.9.7-1.6 0-2.6"/></g></svg>`;

const brand = (lang) => `<a class="brand" href="${PATHS.home[lang]}" aria-label="${e(t(lang, "brand.home"))}">${CREST}<span class="brand__lockup"><span class="brand__name">İlkkan</span><span class="brand__sports">Sports</span></span></a>`;

// Diğer dildeki karşılığa giden anahtar (karşılık yoksa o dilin ana sayfası)
function langSwitch(lang, alternates) {
  const alt = otherLang(lang);
  const href = (alternates && alternates[alt]) || PATHS.home[alt];
  return `<a class="lang-switch" href="${e(href)}" hreflang="${alt}" lang="${alt}" title="${e(t(lang, "lang.switchTitle"))}"><span class="sr-only">${e(t(lang, "lang.switchLabel"))} </span>${alt.toUpperCase()}</a>`;
}

function hreflangLinks(siteUrl, alternates) {
  if (!alternates) return "";
  return [
    ...Object.entries(alternates).map(([l, path]) => `<link rel="alternate" hreflang="${l}" href="${e(siteUrl + path)}" />`),
    `<link rel="alternate" hreflang="x-default" href="${e(siteUrl + alternates.tr)}" />`,
  ].join("\n  ");
}

/**
 * @param {{ lang?: "tr"|"en", title: string, description: string, canonical?: string, ogImage: string, version: string,
 *   site: { title: string }, body: string, jsonLd?: object|null, noindex?: boolean, ogType?: string,
 *   siteUrl?: string, alternates?: { tr: string, en: string } | null }} page
 */
export function pageShell({
  lang = "tr", title, description, canonical = "", ogImage, version, site, body,
  jsonLd = null, noindex = false, ogType = "website", siteUrl = "", alternates = null,
}) {
  const legal = LEGAL_PAGES.map((p) => `<a href="${PATHS[p.id][lang]}">${e(t(lang, p.titleKey))}</a>`).join("");
  return `<!doctype html>
<html lang="${lang}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${e(title)}</title>
  <meta name="description" content="${e(description)}" />
  <meta name="theme-color" content="#0a0b16" />
  ${noindex ? '<meta name="robots" content="noindex" />' : ""}
  ${canonical ? `<link rel="canonical" href="${e(canonical)}" />` : ""}
  ${noindex ? "" : hreflangLinks(siteUrl, alternates)}
  <meta property="og:type" content="${e(ogType)}" />
  <meta property="og:site_name" content="${e(site.title)}" />
  <meta property="og:locale" content="${OG_LOCALE[lang]}" />
  <meta property="og:title" content="${e(title)}" />
  <meta property="og:description" content="${e(description)}" />
  ${canonical ? `<meta property="og:url" content="${e(canonical)}" />` : ""}
  <meta property="og:image" content="${e(ogImage)}" />
  <meta name="twitter:card" content="summary_large_image" />
  <link rel="icon" href="${FAVICON}" />
  <link rel="stylesheet" href="/css/fonts.css?v=${e(version)}" />
  <link rel="stylesheet" href="/css/styles.css?v=${e(version)}" />
  <link rel="stylesheet" href="/css/page.css?v=${e(version)}" />
  ${jsonLd ? `<script type="application/ld+json">${safeJson(jsonLd)}</script>` : ""}
</head>
<body class="subpage">
  <a class="skip-link" href="#icerik">${e(t(lang, "page.skip"))}</a>
  <div class="grain" aria-hidden="true"></div>
  <header class="masthead">
    <div class="masthead__inner wrap">
      ${brand(lang)}
      <div class="page-actions">
        ${langSwitch(lang, alternates)}
        <a class="page-back" href="${PATHS.home[lang]}#canli"><i class="pulse" aria-hidden="true"></i>${e(t(lang, "page.back"))}</a>
      </div>
    </div>
  </header>
  <main id="icerik">
${body}
  </main>
  <footer class="page-foot">
    <div class="wrap page-foot__inner">
      <nav class="page-foot__nav" aria-label="${e(t(lang, "footer.legalNav"))}">${legal}</nav>
      <p>${e(t(lang, "footer.legal"))}</p>
    </div>
  </footer>
  <script type="module" src="/js/pageview.js?v=${e(version)}"></script>
</body>
</html>
`;
}
