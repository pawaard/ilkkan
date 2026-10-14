// Panel: metinler, reklam alanları, ayarlar, görsel yükleme, istatistik, denetim kaydı
import express from "express";
import { randomBytes } from "node:crypto";
import { mkdirSync, readdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { audit, getContent, getSetting, langKey, setContent, setSetting } from "../db.js";
import { requestLang } from "../i18n/index.js";
import { msg } from "../i18n/messages.js";
import { listAdUnits } from "../site-data.js";
import { getStats } from "../stats.js";
import { adUnitSchema, CONTENT_KINDS, contentSchema, parse, SETTINGS_EN_SCHEMAS, SETTINGS_SCHEMAS, uploadSchema } from "../validation.js";
import { fail, ok, validated } from "./respond.js";

export const MAX_UPLOAD = 1024 * 1024; // 1 MB
export const MAX_UPLOAD_FILES = 500; // disk dolmasın
const UPLOAD_NAME = /^[\w-]{1,60}\.(png|jpg|webp)$/;

/** Dosyanın gerçek türünü ilk baytlarından anlar (uzantıya güvenmez) */
export function sniffImage(buf) {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "png";
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") return "webp";
  return null;
}

// Metin listeleri iki dilde: { tr: { quotes: [...] }, en: { quotes: [...] } } — İngilizce boşsa sitede Türkçesi görünür
function contentRoutes(router, db) {
  const byLang = (lang) => Object.fromEntries(CONTENT_KINDS.map((kind) => [kind, getContent(db, langKey(kind, lang))]));
  router.get("/content", (req, res) => ok(res, { tr: byLang("tr"), en: byLang("en") }));

  const save = (contentLang) => (req, res) => {
    const schema = contentSchema(req.params.kind, contentLang);
    if (!schema) return fail(res, 404, msg(req, "noSuchContent"));
    const items = validated(res, parse(schema, req.body && req.body.items, requestLang(req)));
    if (!items) return undefined;
    setContent(db, langKey(req.params.kind, contentLang), items);
    audit(db, req.admin.username, "metin listesi güncellendi", contentLang === "en" ? `${req.params.kind} (en)` : req.params.kind);
    return ok(res, items);
  };
  router.put("/content/:kind", save("tr"));
  router.put("/content/:kind/en", save("en"));
}

function adRoutes(router, db) {
  router.get("/ads", (req, res) => ok(res, listAdUnits(db)));

  router.put("/ads/:id", (req, res) => {
    if (!db.prepare("SELECT 1 FROM ad_units WHERE id = ?").get(req.params.id)) return fail(res, 404, msg(req, "adNotFound"));
    const u = validated(res, parse(adUnitSchema, req.body, requestLang(req)));
    if (!u) return undefined;
    db.prepare("UPDATE ad_units SET mode = ?, image_url = ?, link_url = ?, alt = ?, alt_en = ?, code = ? WHERE id = ?")
      .run(u.mode, u.imageUrl, u.linkUrl, u.alt, u.altEn, u.code, req.params.id);
    audit(db, req.admin.username, `reklam alanı: ${u.mode}`, req.params.id);
    return ok(res, listAdUnits(db).find((x) => x.id === req.params.id));
  });
}

const creativesOf = (db) => Object.entries(getSetting(db, "ads", {}).creatives || {})
  .map(([id, c]) => ({ id, brand: c.brand, tagline: c.tagline }));

function settingsRoutes(router, db) {
  router.get("/settings", (req, res) => {
    const ads = getSetting(db, "ads", {});
    const adsEn = getSetting(db, "ads:en", {}) || {};
    return ok(res, {
      site: getSetting(db, "site", {}),
      derby: getSetting(db, "derby", {}),
      player: getSetting(db, "player", {}),
      images: getSetting(db, "images", {}),
      ads: { rentHref: ads.rentHref || "", clickNote: ads.clickNote || "" },
      creatives: creativesOf(db),
      // İngilizce katman (boş alan = sitede Türkçesi)
      en: {
        site: getSetting(db, "site:en", {}) || {},
        derby: getSetting(db, "derby:en", {}) || {},
        images: getSetting(db, "images:en", {}) || {},
        ads: { clickNote: adsEn.clickNote || "" },
      },
    });
  });

  // Ayar türüne özel ek kontroller (şemanın bilemeyeceği, veritabanına bağlı olanlar)
  const CHECKS = {
    derby: (v) => (db.prepare("SELECT 1 FROM matches WHERE id = ?").get(v.matchId) ? null : "derbyNotFound"),
    player: (v) => (!v.sponsor || creativesOf(db).some((c) => c.id === v.sponsor) ? null : "noSuchSponsor"),
  };
  // Mevcut kaydın üstüne yazılanlar (ör. reklam ayarında kreatifler ve slotlar korunur)
  const MERGED = new Set(["ads", "ads:en"]);
  const store = (key, value) => setSetting(db, key, MERGED.has(key) ? { ...getSetting(db, key, {}), ...value } : value);

  router.put("/settings/:key", (req, res) => {
    const { key } = req.params;
    const lang = requestLang(req);
    if (!Object.hasOwn(SETTINGS_SCHEMAS, key)) return fail(res, 404, msg(req, "noSuchSetting"));
    const { en, ...body } = req.body || {};
    const value = validated(res, parse(SETTINGS_SCHEMAS[key], body, lang));
    if (!value) return undefined;
    const problem = CHECKS[key] ? CHECKS[key](value) : null;
    if (problem) return fail(res, 400, msg(req, problem));
    const enSchema = Object.hasOwn(SETTINGS_EN_SCHEMAS, key) ? SETTINGS_EN_SCHEMAS[key] : null;
    const english = en !== undefined && enSchema ? validated(res, parse(enSchema, en, lang)) : null;
    if (en !== undefined && enSchema && !english) return undefined;
    store(key, value);
    if (english) store(langKey(key, "en"), english);
    audit(db, req.admin.username, "ayar güncellendi", key);
    return ok(res, english ? { ...value, en: english } : value);
  });
}

function uploadRoutes(router, db, uploadDir) {
  router.post("/uploads", express.json({ limit: "2mb" }), (req, res) => {
    const body = validated(res, parse(uploadSchema, req.body, requestLang(req)));
    if (!body) return undefined;
    const base64 = body.data.replace(/^data:[\w/+.-]+;base64,/, "");
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) return fail(res, 400, msg(req, "fileUnreadable"));
    const buf = Buffer.from(base64, "base64");
    if (buf.length > MAX_UPLOAD) return fail(res, 400, msg(req, "fileTooBig"));
    const ext = sniffImage(buf);
    if (!ext) return fail(res, 400, msg(req, "fileType"));
    mkdirSync(uploadDir, { recursive: true });
    if (readdirSync(uploadDir).filter((n) => UPLOAD_NAME.test(n)).length >= MAX_UPLOAD_FILES) {
      return fail(res, 400, msg(req, "tooManyFiles", { max: MAX_UPLOAD_FILES }));
    }
    const name = `${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${randomBytes(6).toString("hex")}.${ext}`;
    writeFileSync(join(uploadDir, name), buf, { flag: "wx" });
    audit(db, req.admin.username, "görsel yüklendi", name);
    return ok(res, { name, url: `/uploads/${name}`, size: buf.length }, 201);
  });

  router.get("/uploads", (req, res) => {
    mkdirSync(uploadDir, { recursive: true });
    const files = readdirSync(uploadDir)
      .filter((name) => UPLOAD_NAME.test(name))
      .map((name) => {
        const st = statSync(join(uploadDir, name));
        return { name, url: `/uploads/${name}`, size: st.size, at: st.mtimeMs };
      })
      .sort((a, b) => b.at - a.at);
    return ok(res, files);
  });

  router.delete("/uploads/:name", (req, res) => {
    const { name } = req.params;
    if (!UPLOAD_NAME.test(name)) return fail(res, 400, msg(req, "badFileName"));
    try {
      unlinkSync(join(uploadDir, name));
    } catch {
      return fail(res, 404, msg(req, "fileNotFound"));
    }
    audit(db, req.admin.username, "görsel silindi", name);
    return ok(res, { name });
  });
}

function insightRoutes(router, db) {
  router.get("/stats", (req, res) => {
    const days = Math.min(60, Math.max(1, Number.parseInt(String(req.query.days || "14"), 10) || 14));
    const live = db.prepare("SELECT COUNT(*) AS n FROM matches WHERE status = 'live'").get().n;
    return ok(res, { ...getStats(db, { days }), live });
  });

  router.get("/audit", (req, res) =>
    ok(res, db.prepare("SELECT admin, action, target, at FROM audit_log ORDER BY id DESC LIMIT 50").all()));
}

export function siteRoutes(router, db, { uploadDir }) {
  uploadRoutes(router, db, uploadDir); // kendi (büyük) gövde sınırıyla, genel JSON ayrıştırıcıdan önce
  router.use(express.json({ limit: "100kb" }));
  contentRoutes(router, db);
  adRoutes(router, db);
  settingsRoutes(router, db);
  insightRoutes(router, db);
}
