// Küçük HTML şablon yardımcıları:
//   {{ad}} kaçışlı değişken, {{{ad}}} ham değişken (yalnızca güvenli üretilmiş içerik)
//   {{t:anahtar}} kaçışlı çeviri, {{{t:anahtar}}} ham çeviri (yalnızca koddaki sözlükten — kullanıcı girdisi değil)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const ESCAPES = Object.freeze({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" });
export const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (ch) => ESCAPES[ch]);

const PLACEHOLDER = /\{\{\{(t:)?([\w.]+)\}\}\}|\{\{(t:)?([\w.]+)\}\}/g;

/**
 * @param {string} template
 * @param {Record<string, unknown>} vars
 * @param {Record<string, string>} [dict] çeviri sözlüğü ({{t:…}} için)
 */
export function renderTemplate(template, vars, dict = {}) {
  return template.replace(PLACEHOLDER, (_, rawT, rawKey, escT, escKey) => {
    const raw = rawKey !== undefined;
    const key = raw ? rawKey : escKey;
    const source = (raw ? rawT : escT) ? dict : vars;
    if (!Object.hasOwn(source, key)) throw new Error(`Şablon ${source === dict ? "çevirisi" : "değişkeni"} eksik: ${key}`);
    return raw ? String(source[key]) : escapeHtml(source[key]);
  });
}

/**
 * Şablon dosyası okuyucu: üretimde bir kez okur, geliştirmede her istekte (dosya değişikliği hemen görünsün).
 * @param {string} file
 * @param {{ cache: boolean }} options
 */
export function templateLoader(file, { cache }) {
  let cached = "";
  return () => {
    if (cache && cached) return cached;
    cached = readFileSync(file, "utf8");
    return cached;
  };
}

/**
 * CSS/JS dosyalarının en son değişme zamanından sürüm etiketi (?v=) üretir.
 * Böylece dosya değişince tarayıcı eski önbelleği kullanmaz — elle sürüm artırmaya gerek yok.
 */
export function assetVersioner(publicDir, { cacheMs }) {
  let value = "";
  let at = 0;
  const newest = (dir) => readdirSync(dir, { withFileTypes: true }).reduce((max, entry) => {
    const path = join(dir, entry.name);
    const time = entry.isDirectory() ? newest(path) : statSync(path).mtimeMs;
    return Math.max(max, time);
  }, 0);
  return () => {
    const now = Date.now();
    if (value && now - at < cacheMs) return value;
    value = Math.floor(Math.max(newest(join(publicDir, "css")), newest(join(publicDir, "js")))).toString(36);
    at = now;
    return value;
  };
}
