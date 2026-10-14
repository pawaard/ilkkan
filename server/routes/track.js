// Ziyaret / reklam gösterimi / tıklama / oynatma sayacı (navigator.sendBeacon ile gelir)
import express from "express";
import { readJson } from "../db.js";
import { createRateLimiter, rateLimit } from "../security.js";
import { createVisitorHasher, dayKey, recordEvent } from "../stats.js";
import { parse, trackSchema } from "../validation.js";

const BOT = /bot|crawl|spider|slurp|facebookexternalhit|preview/i;

export function trackRouter(db) {
  const router = express.Router();
  const hashVisitor = createVisitorHasher();
  const limiter = createRateLimiter({ windowMs: 60_000, max: 120 });
  const known = (event, key) => {
    if (event === "imp" || event === "click") {
      return key === "kanal-native" || key === "sponsor" || Boolean(db.prepare("SELECT 1 FROM ad_units WHERE id = ?").get(key));
    }
    if (event === "play") {
      return Boolean(db.prepare("SELECT 1 FROM matches WHERE id = ? UNION SELECT 1 FROM channels WHERE id = ?").get(key, key));
    }
    // Görüntüleme: yalnızca ana sayfa ve gerçekten var olan maç sayfaları (rastgele anahtarla tablo şişirilemesin)
    if (key === "/" || key === "/en/") return true;
    const match = /^\/(?:mac|en\/match)\/([a-z0-9-]{1,40})$/.exec(key);
    return Boolean(match && db.prepare("SELECT 1 FROM matches WHERE id = ?").get(match[1]));
  };

  // Beacon gövdesi text/plain gelir; her türü düz metin olarak alıp JSON çözüyoruz
  router.post("/api/t", rateLimit(limiter), express.text({ type: () => true, limit: "1kb" }), (req, res) => {
    const userAgent = req.get("user-agent") || "";
    const parsed = parse(trackSchema, readJson(typeof req.body === "string" ? req.body : "", null));
    if (!parsed.ok || BOT.test(userAgent) || !known(parsed.data.e, parsed.data.k)) return res.status(204).end();
    const day = dayKey();
    const { e: event, k: key } = parsed.data;
    const visitor = event === "view" ? hashVisitor(req.ip || "", userAgent, day) : "";
    recordEvent(db, { event, key, visitor, day });
    return res.status(204).end();
  });

  return router;
}
