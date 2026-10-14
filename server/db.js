// Veritabanı bağlantısı (Node'un yerleşik SQLite'ı) + şema + işlem yardımcısı
import { DatabaseSync } from "node:sqlite";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const SCHEMA = readFileSync(resolve(HERE, "migrations.sql"), "utf8");

// Sonradan eklenen sütunlar: eski veritabanlarına da (veri kaybı olmadan) eklenir
const ADDED_COLUMNS = Object.freeze([
  ["channels", "genre_en"],
  ["channels", "now_en"],
  ["channels", "next_en"],
  ["ad_units", "alt_en"],
  ["matches", "league_en"],
]);

function ensureColumns(db) {
  ADDED_COLUMNS.forEach(([table, column]) => {
    const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((c) => c.name === column);
    if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} TEXT NOT NULL DEFAULT ''`);
  });
}

/** @param {string} file  Dosya yolu ya da ":memory:" (testler) */
export function openDb(file) {
  if (file !== ":memory:") mkdirSync(dirname(resolve(file)), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 3000;");
  db.exec(SCHEMA);
  ensureColumns(db);
  return db;
}

/** Fonksiyonu tek işlem (transaction) içinde çalıştırır; hata olursa geri alır. */
export function tx(db, fn) {
  db.exec("BEGIN");
  try {
    const result = fn();
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export const readJson = (text, fallback) => {
  try {
    return JSON.parse(text);
  } catch {
    return fallback; // bozuk kayıt sitenin tamamını düşürmesin
  }
};

export function getSetting(db, key, fallback = null) {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key);
  return row ? readJson(row.value, fallback) : fallback;
}

export function setSetting(db, key, value) {
  db.prepare("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(key, JSON.stringify(value));
}

export function getContent(db, kind) {
  const row = db.prepare("SELECT items FROM content WHERE kind = ?").get(kind);
  return row ? readJson(row.items, []) : [];
}

export function setContent(db, kind, items) {
  db.prepare("INSERT INTO content (kind, items) VALUES (?, ?) ON CONFLICT(kind) DO UPDATE SET items = excluded.items")
    .run(kind, JSON.stringify(items));
}

/* ---------- Dile göre içerik ----------
   Türkçe ana kayıt: "quotes", "site"…  İngilizce katman: "quotes:en", "site:en"…
   İngilizce boşsa (ya da yoksa) Türkçesi kullanılır. */
export const langKey = (key, lang) => (lang === "en" ? `${key}:en` : key);

export function getContentLang(db, kind, lang) {
  if (lang !== "en") return getContent(db, kind);
  const en = getContent(db, langKey(kind, "en"));
  return en.length ? en : getContent(db, kind);
}

/** Türkçe ayarın üstüne İngilizce katmanın dolu alanlarını koyar */
export function getSettingLang(db, key, lang, fallback = {}) {
  const base = getSetting(db, key, fallback) || fallback;
  if (lang !== "en") return base;
  const overlay = getSetting(db, langKey(key, "en"), {}) || {};
  const filled = Object.fromEntries(Object.entries(overlay).filter(([, v]) => typeof v === "string" ? v.trim() !== "" : v != null));
  return { ...base, ...filled };
}

export function audit(db, admin, action, target = "") {
  db.prepare("INSERT INTO audit_log (admin, action, target) VALUES (?, ?, ?)").run(admin, action, target);
}
