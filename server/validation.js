// Panelden ve siteden gelen her girdinin şeması (Zod).
// Özel mesajlar "@anahtar" ya da "@anahtar|sayı" belirteçleridir; parse() isteğin diline çevirir (i18n/messages.js).
import { z } from "zod";
import { MIN_PASSWORD } from "./auth.js";
import { message } from "./i18n/messages.js";

z.config(z.locales.tr());
const ZOD_LOCALE = Object.freeze({ tr: z.locales.tr().localeError, en: z.locales.en().localeError });

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const ID = /^[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$/;

const isUrl = (value, protocols) => {
  try {
    return protocols.includes(new URL(value).protocol);
  } catch {
    return false;
  }
};

const text = (max, min = 0) => {
  const base = z.string().trim().max(max, `@v.max|${max}`);
  return min > 0 ? base.min(min, "@v.required") : base;
};
const line = (max) => text(max, 1);
const bool = z.boolean().default(false);

export const idSchema = z.string().trim().regex(ID, "@v.id");
const timeSchema = z.string().trim().regex(TIME, "@v.time");
const scorePart = z.number().int().min(0).max(999);
const scoreSchema = z.tuple([scorePart, scorePart]);
const shortName = line(5).transform((s) => s.toLocaleUpperCase("tr"));

// Yayın https olmalı (https sitede http içerik tarayıcıda engellenir); yalnızca yerel denemede http serbest
const isLocalHttp = (v) => isUrl(v, ["http:"]) && ["localhost", "127.0.0.1", "[::1]"].includes(new URL(v).hostname);
const streamUrl = z.string().trim().max(1000)
  .refine((v) => v === "" || isUrl(v, ["https:"]) || isLocalHttp(v), "@v.stream");
const streams = z.array(streamUrl).max(2).default([]).transform((list) => list.filter(Boolean));

const externalUrl = z.string().trim().max(500)
  .refine((v) => v === "" || isUrl(v, ["https:"]), "@v.external");

// Reklam / kiralık bağlantısı: sayfa içi çapa, http(s) ya da e-posta
export const linkSchema = z.string().trim().max(500)
  .refine((v) => v === "" || /^#[\w-]{1,40}$/.test(v) || isUrl(v, ["https:", "http:", "mailto:"]), "@v.link");

// Görsel: sitedeki hazır görseller, panelden yüklenenler ya da https adresi
export const imagePath = z.string().trim().max(500)
  .refine((v) => /^\/(assets\/img|uploads)\/[\w.-]{1,80}$/.test(v) || isUrl(v, ["https:"]), "@v.image");

const matchFields = {
  cat: z.enum(["futbol", "basketbol", "voleybol"]),
  league: line(60),
  leagueEn: text(60).default(""),
  home: line(40),
  away: line(40),
  homeShort: shortName,
  awayShort: shortName,
  time: timeSchema,
  status: z.enum(["live", "upcoming", "finished"]),
  clock: text(8).default(""),
  period: text(40).default(""),
  score: scoreSchema.nullable().default(null),
  derby: bool,
  streams,
  sort: z.number().int().min(0).max(9999).optional(),
};
export const matchSchema = z.object({ id: idSchema, ...matchFields });
export const matchUpdateSchema = z.object(matchFields);

export const liveSchema = z.object({
  status: matchFields.status.optional(),
  clock: text(8).optional(),
  period: text(40).optional(),
  score: scoreSchema.nullable().optional(),
  goal: z.enum(["home", "away"]).optional(),
  undo: z.enum(["home", "away"]).optional(),
}).refine((o) => Object.values(o).some((v) => v !== undefined), "@v.atLeastOne");

const channelFields = {
  no: z.string().trim().regex(/^\d{1,3}$/, "@v.channelNo"),
  name: line(30),
  genre: line(30),
  genreEn: text(30).default(""),
  cat: z.enum(["futbol", "basketbol", "voleybol", "kanal"]),
  now: text(80).default(""),
  nowEn: text(80).default(""),
  next: text(80).default(""),
  nextEn: text(80).default(""),
  progress: z.number().min(0).max(1).default(0),
  matchId: idSchema.nullable().default(null),
  feature: bool,
  streams,
  sort: z.number().int().min(0).max(9999).optional(),
};
export const channelSchema = z.object({ id: idSchema, ...channelFields });
export const channelUpdateSchema = z.object(channelFields);

// Metin listeleri. Türkçe: sitedeki döngüler boş listeyle çalışamaz, çoğu en az 1 öğe ister.
// İngilizce: boş liste serbest — boşsa sitede Türkçesi gösterilir.
const CONTENT_RULES = Object.freeze({
  subtitles: { item: z.object({ a: line(80), b: line(80) }), min: 1, max: 30 },
  quotes: { item: line(120), min: 1, max: 40 },
  liveComments: { item: line(120), min: 1, max: 40 },
  tickerNotes: { item: line(120), min: 0, max: 20 },
  tickerAds: { item: line(120), min: 0, max: 2 }, // skorbordda en fazla 2 sponsor yazısı gösterilir
  commentary: { item: z.object({ ago: z.number().int().min(0).max(999), text: line(200) }), min: 0, max: 40 },
  rentCopies: { item: z.object({ brand: line(40), tagline: line(80), note: text(80), cta: line(24) }), min: 1, max: 12 },
});
export const CONTENT_KINDS = Object.freeze(Object.keys(CONTENT_RULES));
export const contentSchema = (kind, lang = "tr") => {
  if (!Object.hasOwn(CONTENT_RULES, kind)) return null;
  const rule = CONTENT_RULES[kind];
  return z.array(rule.item).min(lang === "en" ? 0 : rule.min).max(rule.max);
};
export const CONTENT_SCHEMAS = Object.freeze(Object.fromEntries(CONTENT_KINDS.map((k) => [k, contentSchema(k, "tr")])));

export const adUnitSchema = z.object({
  mode: z.enum(["kiralik", "image", "code", "off"]),
  imageUrl: z.union([z.literal(""), imagePath]).default(""),
  linkUrl: linkSchema.default(""),
  alt: text(120).default(""),
  altEn: text(120).default(""),
  code: z.string().max(20000, "@v.codeMax").default(""),
}).superRefine((unit, ctx) => {
  if (unit.mode === "image" && !unit.imageUrl) {
    ctx.addIssue({ code: "custom", path: ["imageUrl"], message: "@v.imageMode" });
  }
  if (unit.mode === "code" && !unit.code.trim()) {
    ctx.addIssue({ code: "custom", path: ["code"], message: "@v.codeMode" });
  }
});

export const SETTINGS_SCHEMAS = Object.freeze({
  site: z.object({
    title: line(60),
    tagline: line(80),
    description: line(200),
    telegramUrl: externalUrl.default(""),
    xUrl: externalUrl.default(""),
    contactNote: text(160).default(""),
  }),
  derby: z.object({ matchId: idSchema, kickoff: timeSchema, prediction: text(160).default("") }),
  player: z.object({ sponsor: z.union([z.literal(""), idSchema]) }),
  images: z.object({
    posterLeft: imagePath,
    posterRight: imagePath,
    hero: imagePath,
    card: imagePath,
    heroAlt: text(200).default(""),
    cardAlt: text(200).default(""),
    rentPhotos: z.array(z.object({
      src: imagePath,
      focus: z.string().trim().regex(/^\d{1,3}% \d{1,3}%$/, "@v.focus").default("50% 20%"),
    })).min(1).max(6),
  }),
  ads: z.object({ rentHref: linkSchema, clickNote: text(200).default("") }),
});

// Ayarların İngilizce katmanı: yalnızca çevrilebilir metinler, hepsi isteğe bağlı (boş = Türkçesi)
export const SETTINGS_EN_SCHEMAS = Object.freeze({
  site: z.object({ tagline: text(80).default(""), description: text(200).default(""), contactNote: text(160).default("") }),
  derby: z.object({ prediction: text(160).default("") }),
  images: z.object({ heroAlt: text(200).default(""), cardAlt: text(200).default("") }),
  ads: z.object({ clickNote: text(200).default("") }),
});

export const loginSchema = z.object({ username: line(40), password: z.string().min(1).max(200) });
export const passwordSchema = z.object({
  current: z.string().min(1, "@v.currentPassword").max(200),
  newPassword: z.string().min(MIN_PASSWORD, `@v.passwordMin|${MIN_PASSWORD}`).max(200),
});
export const uploadSchema = z.object({
  name: line(120),
  data: z.string().min(16).max(1_500_000, "@v.tooBig"),
});
export const trackSchema = z.object({
  e: z.enum(["view", "imp", "click", "play"]),
  k: z.string().max(80).regex(/^[\w/-]*$/).default(""),
});

const LABELS = Object.freeze({
  tr: {
    id: "Kimlik", cat: "Kategori", league: "Lig", leagueEn: "Lig (English)", home: "Ev sahibi", away: "Deplasman",
    homeShort: "Ev kısa ad", awayShort: "Dep. kısa ad", time: "Saat", status: "Durum", clock: "Dakika",
    period: "Durum yazısı", score: "Skor", streams: "Yayın adresi", no: "Kanal no", name: "Ad",
    genre: "Tür", genreEn: "Tür (English)", now: "Şimdi", nowEn: "Şimdi (English)", next: "Sonra",
    nextEn: "Sonra (English)", progress: "İlerleme", matchId: "Bağlı maç",
    imageUrl: "Görsel", linkUrl: "Bağlantı", alt: "Görsel açıklaması", altEn: "Görsel açıklaması (English)", code: "Reklam kodu",
    title: "Site adı", tagline: "Slogan", description: "Açıklama", telegramUrl: "Telegram", xUrl: "X",
    contactNote: "İletişim notu", kickoff: "Başlama saati", prediction: "Tahmin", sponsor: "Sponsor",
    username: "Kullanıcı adı", password: "Şifre", current: "Mevcut şifre", newPassword: "Yeni şifre",
    rentHref: "Kiralık bağlantısı", clickNote: "Tıklama notu", heroAlt: "Tanıtım görseli açıklaması",
    cardAlt: "Kart görseli açıklaması", posterLeft: "Afiş sol", posterRight: "Afiş sağ", hero: "Tanıtım görseli",
    card: "Kart görseli", rentPhotos: "Kiralık fotoğrafları", src: "Görsel", focus: "Odak", items: "Liste",
    en: "English", a: "Soru", b: "Cevap", ago: "Kaç dk önce", text: "Metin", brand: "Başlık", note: "Not", cta: "Düğme",
  },
  en: {
    id: "ID", cat: "Category", league: "League", leagueEn: "League (English)", home: "Home", away: "Away",
    homeShort: "Home short name", awayShort: "Away short name", time: "Time", status: "Status", clock: "Minute",
    period: "Status text", score: "Score", streams: "Stream address", no: "Channel no", name: "Name",
    genre: "Genre", genreEn: "Genre (English)", now: "Now", nowEn: "Now (English)", next: "Next",
    nextEn: "Next (English)", progress: "Progress", matchId: "Linked match",
    imageUrl: "Image", linkUrl: "Link", alt: "Image description", altEn: "Image description (English)", code: "Ad code",
    title: "Site name", tagline: "Tagline", description: "Description", telegramUrl: "Telegram", xUrl: "X",
    contactNote: "Contact note", kickoff: "Kick-off time", prediction: "Prediction", sponsor: "Sponsor",
    username: "Username", password: "Password", current: "Current password", newPassword: "New password",
    rentHref: "For-rent link", clickNote: "Click note", heroAlt: "Hero image description",
    cardAlt: "Card image description", posterLeft: "Poster left", posterRight: "Poster right", hero: "Hero image",
    card: "Card image", rentPhotos: "For-rent photos", src: "Image", focus: "Focus", items: "List",
    en: "English", a: "Question", b: "Answer", ago: "Minutes ago", text: "Text", brand: "Title", note: "Note", cta: "Button",
  },
});

const describePath = (path, lang) => path
  .map((p) => (typeof p === "number" ? message(lang, "v.row", { n: p + 1 }) : LABELS[lang][p] || p))
  .join(" › ");

// "@v.max|60" → dile göre metin; Zod'un kendi mesajları zaten istenen dilde gelir
const translate = (text, lang) => {
  if (!text.startsWith("@")) return text;
  const [key, n] = text.slice(1).split("|");
  return message(lang, key, { n });
};

/** Şemayla doğrular; başarısızsa okunur ilk hatayı (isteğin dilinde) döndürür */
export function parse(schema, input, lang = "tr") {
  const result = schema.safeParse(input, { error: ZOD_LOCALE[lang] || ZOD_LOCALE.tr });
  if (result.success) return { ok: true, data: result.data };
  const issue = result.error.issues[0];
  const where = issue.path.length ? `${describePath(issue.path, lang === "en" ? "en" : "tr")}: ` : "";
  return { ok: false, error: `${where}${translate(issue.message, lang)}` };
}
