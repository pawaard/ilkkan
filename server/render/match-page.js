// Maç detay sayfası /mac/:id ve /en/match/:id — sunucuda üretilir (arama motorları ve paylaşım kartları için)
import { escapeHtml as e } from "./template.js";
import { pageShell } from "./shell.js";
import { matchJsonLd } from "../seo.js";
import { LANGS, matchPath, PATHS, t } from "../i18n/index.js";

const CAT_DOT = Object.freeze({ futbol: "var(--c-futbol)", basketbol: "var(--c-basketbol)", voleybol: "var(--c-voleybol)" });
const scoreOf = (m) => (m.score ? `${m.score[0]}–${m.score[1]}` : "–");

// Dile göre sayfa metinleri (maç verisi zaten dile göre gelir: İngilizcede dakika/durum çevrili)
const COPY = Object.freeze({
  tr: {
    time: (hhmm) => hhmm.replace(":", "."),
    chip: { live: (m) => `Canlı${m.clock ? ` · ${m.clock}` : ""}`, upcoming: (m, time) => `Bugün ${time}`, finished: () => "Maç sonu" },
    meta: {
      live: (m, time) => `${m.period || "Canlı"} · Başlama ${time}`,
      upcoming: (m, time) => `${m.period || `Başlama ${time}`} · Erken geldin. İlkkan da; su ısıtıyor.`,
      finished: (m) => `Maç ${scoreOf(m)} bitti. İlkkan iki takımı da tebrik etti.`,
    },
    cta: { live: "Canlı izle", upcoming: "Yayın sayfasına git", finished: "Diğer maçlara bak" },
    ilkkan: {
      live: "Skor ne olursa olsun, dostluk kazanıyor.",
      upcoming: "Maç başlamadı. Acele yok; sabreden derviş muradına ermiş.",
      finished: "Bitti. Kazanan kazandı, kaybeden de tecrübe kazandı.",
    },
    tail: { live: () => "canlı izle", upcoming: (time) => `${time} canlı yayın`, finished: () => "maç sonucu" },
    description: (m, site) => `${m.league}: ${m.home} – ${m.away}. Canlı skor, yayın saati ve İlkkan'ın yorumları ${site}'ta.`,
    derby: "✦ İlkkan'ın seçimi",
    score: "Skor",
    others: "Bugün <em>başka</em> maçlar",
    finishedShort: "MS",
    liveShort: "Canlı",
  },
  en: {
    time: (hhmm) => hhmm,
    chip: { live: (m) => `Live${m.clock ? ` · ${m.clock}` : ""}`, upcoming: (m, time) => `Today ${time}`, finished: () => "Full time" },
    meta: {
      live: (m, time) => `${m.period || "Live"} · Kick-off ${time}`,
      upcoming: (m, time) => `${m.period || `Kick-off ${time}`} · You're early. So is İlkkan; he's boiling the kettle.`,
      finished: (m) => `Finished ${scoreOf(m)}. İlkkan congratulated both teams.`,
    },
    cta: { live: "Watch live", upcoming: "Go to the stream page", finished: "See other matches" },
    ilkkan: {
      live: "Whatever the score, friendship is winning.",
      upcoming: "Not started yet. No rush; good things come to those who wait.",
      finished: "It's over. The winner won, and the loser won experience.",
    },
    tail: { live: () => "live stream", upcoming: (time) => `${time} live stream`, finished: () => "result" },
    description: (m, site) => `${m.league}: ${m.home} vs ${m.away}. Live score, kick-off time and İlkkan's commentary on ${site}.`,
    derby: "✦ İlkkan's pick",
    score: "Score",
    others: "Other matches <em>today</em>",
    finishedShort: "FT",
    liveShort: "Live",
  },
});

const pageTitle = (m, c, siteTitle) => {
  const time = c.time(m.time);
  const head = m.status === "upcoming" ? `${m.home} – ${m.away}` : `${m.home} ${scoreOf(m)} ${m.away}`;
  return `${head} ${c.tail[m.status](time)} · ${siteTitle}`;
};

function otherList(others, lang, c) {
  if (others.length === 0) return "";
  const stub = (m) => (m.status === "live" ? m.clock || c.liveShort : m.status === "upcoming" ? c.time(m.time) : c.finishedShort);
  const items = others.map((m) => `<li><a class="other" href="${matchPath(lang, e(m.id))}" style="--dot:${CAT_DOT[m.cat] || "var(--c-kanal)"}">
      <span class="other__state" data-status="${e(m.status)}">${e(stub(m))}</span>
      <span class="other__teams">${e(m.home)} <b>${e(scoreOf(m))}</b> ${e(m.away)}</span>
      <span class="other__league">${e(m.league)}</span>
    </a></li>`).join("");
  return `<section class="others" aria-labelledby="others-title">
      <h2 class="others__title" id="others-title">${c.others}</h2>
      <ul class="others__list">${items}</ul>
    </section>`;
}

export function renderMatchPage({ lang = "tr", match: m, matches, site, siteUrl, version, ogImage, now = new Date() }) {
  const c = COPY[lang];
  const time = c.time(m.time);
  const home = PATHS.home[lang];
  const cta = m.status === "finished" ? `${home}#fikstur` : `${home}?mac=${encodeURIComponent(m.id)}#canli`;
  const others = matches.filter((x) => x.id !== m.id).slice(0, 8);
  const body = `    <div class="page wrap">
      <nav class="crumbs" aria-label="${e(t(lang, "page.crumbs"))}"><a href="${home}">${e(t(lang, "page.home"))}</a><span aria-hidden="true">›</span><a href="${home}#fikstur">${e(t(lang, "page.fixtures"))}</a><span aria-hidden="true">›</span><span aria-current="page">${e(m.home)} – ${e(m.away)}</span></nav>
      <article class="match${m.derby ? " match--derby" : ""}" style="--dot:${CAT_DOT[m.cat] || "var(--c-kanal)"}">
        <p class="match__league"><i class="match__dot" aria-hidden="true"></i>${e(m.league)}${m.derby ? ` <span class="match__derby">${e(c.derby)}</span>` : ""}</p>
        <p class="match__chip" data-status="${e(m.status)}"><i class="pulse" aria-hidden="true"></i>${e(c.chip[m.status](m, time))}</p>
        <h1 class="match__teams">
          <span class="match__team">${e(m.home)}</span>
          <span class="match__score" aria-label="${e(c.score)} ${e(scoreOf(m))}">${e(scoreOf(m))}</span>
          <span class="match__team">${e(m.away)}</span>
        </h1>
        <p class="match__meta">${e(c.meta[m.status](m, time))}</p>
        <a class="btn btn--ticket match__cta" href="${e(cta)}">${e(c.cta[m.status])} <span aria-hidden="true">▸</span></a>
        <blockquote class="match__quote"><p>${e(c.ilkkan[m.status])}</p><footer>İlkkan</footer></blockquote>
      </article>
      ${otherList(others, lang, c)}
    </div>`;
  const alternates = Object.fromEntries(LANGS.map((l) => [l, matchPath(l, m.id)]));
  return pageShell({
    lang,
    title: pageTitle(m, c, site.title),
    description: c.description(m, site.title),
    canonical: `${siteUrl}${matchPath(lang, m.id)}`,
    ogImage,
    version,
    site,
    body,
    siteUrl,
    alternates,
    ogType: "article",
    jsonLd: matchJsonLd(m, { siteUrl, siteName: site.title, now, lang }),
  });
}
