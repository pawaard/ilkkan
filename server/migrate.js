// Sürümlü veri göçleri (PRAGMA user_version). Her adım bir kez çalışır; mevcut veriyi bozmaz.
import { getContent, getSetting, langKey, setContent, setSetting, tx } from "./db.js";
import { SEED } from "./seed-data.js";
import { SEED_EN } from "./seed-data.en.js";
import { SEED_ALTS, SEED_SITE, seedContentTr, seedIfEmpty } from "./seed.js";

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// İngilizce içerik listeleri (veritabanı biçiminde)
const contentEn = () => ({
  subtitles: SEED_EN.subtitles.map(([a, b]) => ({ a, b })),
  quotes: [...SEED_EN.quotes],
  liveComments: [...SEED_EN.liveComments],
  tickerNotes: [...SEED_EN.tickerNotes],
  commentary: SEED_EN.commentary.map((c) => ({ ...c })),
  tickerAds: [...SEED_EN.tickerAds],
  rentCopies: SEED_EN.rentCopies.map((c) => ({ ...c })),
});

// Yalnızca Türkçesi hâlâ ilk hâlinde olan alanların İngilizcesi yazılır (değiştirilmiş Türkçeye eski çeviri basılmaz)
const untouched = (current, seedTr, value) => (current === seedTr ? value : "");

function seedEnglishContent(db) {
  const tr = seedContentTr();
  Object.entries(contentEn()).forEach(([kind, items]) => {
    const key = langKey(kind, "en");
    if (db.prepare("SELECT 1 FROM content WHERE kind = ?").get(key)) return;
    setContent(db, key, same(getContent(db, kind), tr[kind]) ? items : []);
  });
}

function seedEnglishSettings(db) {
  const site = getSetting(db, "site", {});
  if (!getSetting(db, "site:en")) {
    setSetting(db, "site:en", Object.fromEntries(["tagline", "description", "contactNote"]
      .map((k) => [k, untouched(site[k], SEED_SITE[k], SEED_EN.site[k])])));
  }
  if (!getSetting(db, "derby:en")) {
    const derby = getSetting(db, "derby", {});
    setSetting(db, "derby:en", { prediction: untouched(derby.prediction, SEED.derby.prediction, SEED_EN.derby.prediction) });
  }
  if (!getSetting(db, "images:en")) {
    const images = getSetting(db, "images", {});
    setSetting(db, "images:en", Object.fromEntries(["heroAlt", "cardAlt"]
      .map((k) => [k, untouched(images[k], SEED_ALTS[k], SEED_EN.images[k])])));
  }
  if (!getSetting(db, "ads:en")) {
    const ads = getSetting(db, "ads", {});
    setSetting(db, "ads:en", {
      creatives: SEED_EN.creatives, // parodi markalar panelden düzenlenmez
      clickNote: untouched(ads.clickNote, SEED.ads.clickNote, SEED_EN.clickNote),
    });
  }
}

function seedEnglishChannels(db) {
  const update = db.prepare("UPDATE channels SET genre_en = ?, now_en = ?, next_en = ? WHERE id = ?");
  SEED.channels.forEach((seedTr) => {
    const row = db.prepare("SELECT genre, now, next, genre_en, now_en, next_en FROM channels WHERE id = ?").get(seedTr.id);
    const en = SEED_EN.channels[seedTr.id];
    if (!row || !en) return;
    update.run(
      row.genre_en || untouched(row.genre, seedTr.genre, en.genre),
      row.now_en || untouched(row.now, seedTr.now, en.now),
      row.next_en || untouched(row.next, seedTr.next, en.next),
      seedTr.id,
    );
  });
}

// Başlangıç maçlarının lig adları (yalnızca Türkçesi değişmemiş ve İngilizcesi boş olanlar)
function seedEnglishLeagues(db) {
  const update = db.prepare("UPDATE matches SET league_en = ? WHERE id = ? AND league = ? AND league_en = ''");
  SEED.matches.forEach((m) => {
    const en = SEED_EN.leagues[m.league];
    if (en) update.run(en, m.id, m.league);
  });
}

const STEPS = Object.freeze([
  // v1: İngilizce ikinci dil
  (db) => {
    seedEnglishContent(db);
    seedEnglishSettings(db);
    seedEnglishChannels(db);
  },
  // v2: İngilizce lig adları
  (db) => seedEnglishLeagues(db),
]);

export function migrateData(db) {
  const from = db.prepare("PRAGMA user_version").get().user_version;
  for (let version = from; version < STEPS.length; version += 1) {
    tx(db, () => {
      STEPS[version](db);
      db.exec(`PRAGMA user_version = ${version + 1}`);
    });
  }
  return STEPS.length - from;
}

/** Açılışta: boşsa Türkçe başlangıç içeriği, sonra bekleyen göçler. @returns {boolean} ilk kurulum mu */
export function initData(db) {
  const seeded = seedIfEmpty(db);
  migrateData(db);
  return seeded;
}
