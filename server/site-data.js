// Veritabanından sitenin beklediği veri şeklini üretir (eski data.js ile aynı şekil + yeni alanlar).
// Dil: "tr" ana kayıt; "en" İngilizce katmanı Türkçenin üstüne koyar (boş İngilizce → Türkçe).
import { getContentLang, getSetting, getSettingLang } from "./db.js";
import { clockEn, periodEn } from "./i18n/live-en.js";

const CATEGORY_LABELS = Object.freeze({
  tr: { all: "Hepsi", futbol: "Futbol", basketbol: "Basketbol", voleybol: "Voleybol", kanal: "Kanallar" },
  en: { all: "All", futbol: "Football", basketbol: "Basketball", voleybol: "Volleyball", kanal: "Channels" },
});
export const categories = (lang = "tr") =>
  Object.entries(CATEGORY_LABELS[lang] || CATEGORY_LABELS.tr).map(([id, label]) => ({ id, label }));
export const CATEGORIES = Object.freeze(categories("tr"));

const streamsOf = (row) => [row.stream_1, row.stream_2].filter(Boolean);
const pick = (en, tr) => (en && en.trim() ? en : tr);

/** Panelin gördüğü ham maç (Türkçe) */
export const toMatch = (r) => ({
  id: r.id,
  cat: r.cat,
  league: r.league,
  leagueEn: r.league_en || "",
  home: r.home,
  away: r.away,
  homeShort: r.home_short,
  awayShort: r.away_short,
  time: r.time,
  status: r.status,
  clock: r.clock,
  period: r.period,
  score: r.score_home == null || r.score_away == null ? null : [r.score_home, r.score_away],
  derby: Boolean(r.derby),
  streams: streamsOf(r),
});

/** Sitede gösterilen maç: İngilizcede lig adı (girildiyse), dakika ve durum yazısı (otomatik) çevrilir */
const localizeMatch = ({ leagueEn, ...m }, lang) => (lang === "en"
  ? { ...m, league: pick(leagueEn, m.league), clock: clockEn(m.clock), period: periodEn(m) }
  : m);

/** Panelin gördüğü ham kanal (Türkçe + İngilizce alanlar) */
export const toChannel = (r) => ({
  id: r.id,
  no: r.no,
  name: r.name,
  genre: r.genre,
  cat: r.cat,
  now: r.now,
  next: r.next,
  progress: r.progress,
  ...(r.match_id ? { matchId: r.match_id } : {}),
  feature: Boolean(r.feature),
  streams: streamsOf(r),
  genreEn: r.genre_en || "",
  nowEn: r.now_en || "",
  nextEn: r.next_en || "",
});

const localizeChannel = ({ genreEn, nowEn, nextEn, ...c }, lang) => (lang === "en"
  ? { ...c, genre: pick(genreEn, c.genre), now: pick(nowEn, c.now), next: pick(nextEn, c.next) }
  : c);

export const toAdUnit = (r) => ({
  id: r.id,
  slot: r.slot,
  label: r.label,
  size: r.size,
  mode: r.mode,
  imageUrl: r.image_url,
  linkUrl: r.link_url,
  alt: r.alt,
  altEn: r.alt_en || "",
  code: r.code,
});

export const listMatches = (db) => db.prepare("SELECT * FROM matches ORDER BY sort, id").all().map(toMatch);
export const listChannels = (db) => db.prepare("SELECT * FROM channels ORDER BY sort, id").all().map(toChannel);
export const listAdUnits = (db) => db.prepare("SELECT * FROM ad_units ORDER BY sort, id").all().map(toAdUnit);

export const siteMatches = (db, lang = "tr") => listMatches(db).map((m) => localizeMatch(m, lang));
export const siteChannels = (db, lang = "tr") => listChannels(db).map((c) => localizeChannel(c, lang));

// Parodi markaların İngilizcesi: Türkçe kreatifin üstüne alan alan
function creativesFor(db, lang, base) {
  if (lang !== "en") return base;
  const overlay = (getSetting(db, "ads:en", {}) || {}).creatives || {};
  return Object.fromEntries(Object.entries(base).map(([id, c]) => [id, { ...c, ...(overlay[id] || {}) }]));
}

function buildAds(db, images, lang) {
  const ads = getSettingLang(db, "ads", lang, {});
  const units = Object.fromEntries(listAdUnits(db).map(({ id, mode, imageUrl, linkUrl, alt, altEn, code }) =>
    [id, { mode, imageUrl, linkUrl, alt: lang === "en" ? pick(altEn, alt) : alt, code }]));
  return {
    creatives: creativesFor(db, lang, (getSetting(db, "ads", {}) || {}).creatives || {}),
    slots: ads.slots || {},
    clickNote: ads.clickNote || "",
    rent: {
      href: ads.rentHref || "#iletisim",
      tones: ads.tones || ["mint"],
      photos: images.rentPhotos || [],
      copies: getContentLang(db, "rentCopies", lang),
    },
    playerSponsor: getSetting(db, "player", {}).sponsor || "",
    ticker: getContentLang(db, "tickerAds", lang),
    units,
  };
}

export function buildSiteData(db, lang = "tr") {
  const images = getSettingLang(db, "images", lang, {});
  return {
    lang,
    categories: categories(lang),
    matches: siteMatches(db, lang),
    channels: siteChannels(db, lang),
    subtitles: getContentLang(db, "subtitles", lang).map((s) => [s.a, s.b]),
    quotes: getContentLang(db, "quotes", lang),
    liveComments: getContentLang(db, "liveComments", lang),
    tickerNotes: getContentLang(db, "tickerNotes", lang),
    commentary: getContentLang(db, "commentary", lang),
    derby: getSettingLang(db, "derby", lang, { matchId: "", kickoff: "20:00", prediction: "" }),
    site: getSettingLang(db, "site", lang, {}),
    images,
    ads: buildAds(db, images, lang),
  };
}

// Canlı yenileme için hafif veri (site 30 sn'de bir sorar)
export function buildLiveData(db, lang = "tr") {
  return {
    at: Date.now(),
    matches: siteMatches(db, lang).map(({ id, status, clock, period, score, streams }) => ({ id, status, clock, period, score, streams })),
    channels: siteChannels(db, lang).map(({ id, now, next, progress, streams }) => ({ id, now, next, progress, streams })),
  };
}

const LINE_SEP = new RegExp(String.fromCharCode(0x2028), "g");
const PARA_SEP = new RegExp(String.fromCharCode(0x2029), "g");

// JSON'u <script> içine güvenle gömmek için (</script> ve satır ayırıcı kaçışı)
export const safeJson = (value) => JSON.stringify(value)
  .replace(/</g, "\\u003c")
  .replace(LINE_SEP, "\\u2028")
  .replace(PARA_SEP, "\\u2029");

export const siteDataScript = (db, lang = "tr") => `window.ILKKAN_DATA = Object.freeze(${safeJson(buildSiteData(db, lang))});\n`;
