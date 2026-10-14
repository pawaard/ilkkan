// İlk açılış: veritabanı boşsa mevcut site içeriğini (seed-data.js) yükler
import { SEED } from "./seed-data.js";
import { tx, setContent, setSetting } from "./db.js";

// Sitedeki reklam alanları — numaralar index.html'deki data-ad-no ile birebir aynı
export const AD_UNITS = Object.freeze([
  { id: "01", slot: "ust-banner", label: "Üst banner", size: "970×90" },
  { id: "02", slot: "video-ust", label: "Video üstü 1", size: "468×60" },
  { id: "03", slot: "video-ust", label: "Video üstü 2", size: "468×60" },
  { id: "04", slot: "video-ust", label: "Video üstü 3", size: "468×60" },
  { id: "05", slot: "video-ust", label: "Video üstü 4", size: "468×60" },
  { id: "06", slot: "video-alt", label: "Video altı 1", size: "468×60" },
  { id: "07", slot: "video-alt", label: "Video altı 2", size: "468×60" },
  { id: "08", slot: "video-alt", label: "Video altı 3", size: "468×60" },
  { id: "09", slot: "video-alt", label: "Video altı 4", size: "468×60" },
  { id: "10", slot: "fikstur-kutu", label: "Fikstür kutusu", size: "300×250" },
  { id: "11", slot: "yayin-sonrasi", label: "Yayın sonrası banner", size: "970×90" },
  { id: "12", slot: "kose-kutu", label: "İlkkan'ın köşesi kutusu", size: "300×250" },
  { id: "13", slot: "alt-billboard", label: "Alt billboard", size: "970×250" },
  { id: "14", slot: "sol-ray", label: "Sol ray (geniş ekran)", size: "160×600" },
  { id: "15", slot: "sag-ray", label: "Sağ ray (geniş ekran)", size: "160×600" },
  { id: "16", slot: "mobil-alt", label: "Mobil alt şerit", size: "320×50" },
  { id: "mac-arasi", slot: "mac-arasi", label: "Maç arası (her 3 maçta bir)", size: "320×50" },
]);

const IMG = { portre: "/assets/img/ilkkan-portre.jpg", sahne: "/assets/img/ilkkan-sahne.jpg" };

function insertMatches(db) {
  const stmt = db.prepare(`INSERT INTO matches
    (id, cat, league, home, away, home_short, away_short, time, status, clock, period, score_home, score_away, derby, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  SEED.matches.forEach((m, i) => stmt.run(
    m.id, m.cat, m.league, m.home, m.away, m.homeShort, m.awayShort, m.time, m.status, m.clock, m.period,
    m.score ? m.score[0] : null, m.score ? m.score[1] : null, m.derby ? 1 : 0, i,
  ));
}

function insertChannels(db) {
  const stmt = db.prepare(`INSERT INTO channels (id, no, name, genre, cat, now, next, progress, match_id, feature, sort)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  SEED.channels.forEach((c, i) => stmt.run(
    c.id, c.no, c.name, c.genre, c.cat, c.now, c.next, c.progress, c.matchId || null, c.feature ? 1 : 0, i,
  ));
}

function insertContent(db) {
  Object.entries(seedContentTr()).forEach(([kind, items]) => setContent(db, kind, items));
}

function insertAdUnits(db) {
  const stmt = db.prepare("INSERT INTO ad_units (id, slot, label, size, sort) VALUES (?, ?, ?, ?, ?)");
  AD_UNITS.forEach((u, i) => stmt.run(u.id, u.slot, u.label, u.size, i));
}

// Türkçe başlangıç ayarları — İngilizce göçü "hâlâ ilk hâlinde mi?" kontrolü için de kullanılır
export const SEED_SITE = Object.freeze({
  title: "İlkkan Sports",
  tagline: "Herkes kazanmış gibi.",
  description: "İlkkan Sports: canlı maçlar, günün fikstürü ve İlkkan'ın sakin, gönülden yorumları. Herkes kazanmış gibi.",
  telegramUrl: "",
  xUrl: "",
  contactNote: "Bize Telegram'dan yaz. İlkkan cevaplar — kimseyi kırmadan.",
});
export const SEED_ALTS = Object.freeze({
  heroAlt: "Gibi dizisinden bir kare: kel ve sakallı İlkkan, elinde mavi bir kupayla koltukta oturuyor.",
  cardAlt: "Gibi dizisinden bir kare: çizgili gömlekli, kel ve sakallı İlkkan kanepede oturmuş, hafifçe gülümsüyor.",
});

function insertSettings(db) {
  setSetting(db, "site", { ...SEED_SITE });
  setSetting(db, "derby", { ...SEED.derby });
  setSetting(db, "player", { sponsor: SEED.ads.playerSponsor });
  setSetting(db, "images", {
    posterLeft: IMG.portre,
    posterRight: IMG.sahne,
    hero: IMG.sahne,
    card: IMG.portre,
    ...SEED_ALTS,
    rentPhotos: [{ src: IMG.portre, focus: "50% 26%" }, { src: IMG.sahne, focus: "50% 22%" }],
  });
  setSetting(db, "ads", {
    creatives: SEED.ads.creatives,
    slots: SEED.ads.slots,
    tones: [...SEED.ads.rent.tones],
    rentHref: SEED.ads.rent.href,
    clickNote: SEED.ads.clickNote,
  });
}

// Türkçe içerik listelerinin veritabanındaki biçimi (İngilizce göçünde karşılaştırma için)
export const seedContentTr = () => ({
  subtitles: SEED.subtitles.map(([a, b]) => ({ a, b })),
  quotes: [...SEED.quotes],
  liveComments: [...SEED.liveComments],
  tickerNotes: [...SEED.tickerNotes],
  commentary: SEED.commentary.map((c) => ({ ago: c.ago, text: c.text })),
  tickerAds: [...SEED.ads.ticker],
  rentCopies: SEED.ads.rent.copies.map((c) => ({ ...c })),
});

/** Veritabanı boşsa doldurur. @returns {boolean} tohumlama yapıldı mı */
export function seedIfEmpty(db) {
  const { n } = db.prepare("SELECT COUNT(*) AS n FROM settings").get();
  if (n > 0) return false;
  tx(db, () => {
    insertMatches(db);
    insertChannels(db);
    insertContent(db);
    insertAdUnits(db);
    insertSettings(db);
  });
  return true;
}
