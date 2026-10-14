import { msg } from "./i18n/messages.js";

// Güvenlik başlıkları + basit hız sınırlayıcı

// Site reklam kodu (AdSense vb.) ve yayın iframe'i barındırabildiği için betik kaynağı serbest;
// yine de başka sitelerin bizi çerçevelemesi, eklenti ve <base> kaçırma kapalı.
const SITE_CSP = "frame-ancestors 'self'; object-src 'none'; base-uri 'self'";

// Panelde dış kaynak yok: yalnızca kendi dosyalarımız
const PANEL_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'none'",
  "object-src 'none'",
].join("; ");

// Büyük/küçük harf duyarsız: Express yolları ve Windows dosya sistemi "/Yonetim" ile "/yonetim"i aynı sayar
const PANEL_PATH = /^\/(yonetim|api\/admin)(\/|$)/i;
export const isPanelPath = (path) => PANEL_PATH.test(path);

export function securityHeaders({ secure }) {
  return (req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=(), payment=()");
    res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
    if (secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    if (isPanelPath(req.path)) {
      res.setHeader("Content-Security-Policy", PANEL_CSP);
      res.setHeader("X-Frame-Options", "DENY");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.setHeader("Cache-Control", "no-store");
    } else {
      res.setHeader("Content-Security-Policy", SITE_CSP);
      res.setHeader("X-Frame-Options", "SAMEORIGIN");
    }
    next();
  };
}

const ADMIN_HOST_ASSETS = /^\/(css|assets|uploads)\//;

/**
 * ADMIN_HOST ayarlıysa panel ve yönetim API'si yalnızca o alan adında çalışır.
 * Sitedeki reklam kodları (site kökeninde) böylece panel oturumuna hiç erişemez;
 * panel alan adında da site sayfaları (dolayısıyla reklam kodu) açılmaz.
 */
export function adminHostGate({ adminHost }) {
  return (req, res, next) => {
    if (!adminHost) return next();
    const onAdminHost = (req.headers.host || "").toLowerCase() === adminHost;
    const panel = isPanelPath(req.path);
    if (onAdminHost && !panel && !ADMIN_HOST_ASSETS.test(req.path)) return res.redirect(302, "/yonetim/");
    if (!onAdminHost && panel) {
      return /^\/api\//i.test(req.path)
        ? res.status(404).json({ success: false, error: msg(req, "notFound") })
        : res.status(404).type("text").send("Bulunamadı.");
    }
    return next();
  };
}

const MAX_KEYS = 10_000;

/**
 * Bellek içi kayan pencere sınırlayıcı (tek sunucu için yeterli).
 * Engellenen istekler kaydedilmez: liste en fazla `max` uzar ve bekleyen kişinin süresi uzamaz.
 * Anahtarlar son kullanılma sırasında tutulur; dolunca en uzun süredir dokunulmayan atılır.
 * @param {{ windowMs: number, max: number }} options
 */
export function createRateLimiter({ windowMs, max }) {
  const hits = new Map();
  const recent = (key, now) => (hits.get(key) || []).filter((t) => now - t < windowMs);
  const touch = (key, list) => {
    hits.delete(key); // yeniden ekleyince Map sırasının sonuna geçer (LRU)
    hits.set(key, list);
    if (hits.size > MAX_KEYS) hits.delete(hits.keys().next().value);
  };
  return {
    /** Denemeyi say; sınır aşıldıysa kaç saniye beklenmesi gerektiğini döndürür */
    hit(key, now = Date.now()) {
      const list = recent(key, now);
      if (list.length >= max) {
        touch(key, list);
        return { allowed: false, retryAfter: Math.max(1, Math.ceil((windowMs - (now - list[0])) / 1000)) };
      }
      touch(key, [...list, now]);
      return { allowed: true, retryAfter: 0 };
    },
    blocked(key, now = Date.now()) {
      return recent(key, now).length >= max;
    },
    reset(key) {
      hits.delete(key);
    },
  };
}

// IPv6 adresini 8 gruba açar ("2001:db8::1" → 8 parça)
function expandIpv6(ip) {
  const [head, tail = ""] = ip.split("::");
  const left = head ? head.split(":") : [];
  const right = tail ? tail.split(":") : [];
  const fill = ip.includes("::") ? Array(Math.max(0, 8 - left.length - right.length)).fill("0") : [];
  return [...left, ...fill, ...right];
}

/**
 * Hız sınırı anahtarı: IPv4 tam adres, IPv6 /64 ağı (tek kişi kolayca binlerce IPv6 adresi alabilir).
 * @param {string} ip
 */
export function clientKey(ip = "") {
  const plain = ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, "");
  if (!plain.includes(":")) return plain;
  return `${expandIpv6(plain.split("%")[0]).slice(0, 4).join(":")}::/64`;
}

/** Sınırı aşan isteği 429 ile durdurur */
export function rateLimit(limiter, keyOf = (req) => clientKey(req.ip)) {
  return (req, res, next) => {
    const { allowed, retryAfter } = limiter.hit(keyOf(req));
    if (allowed) return next();
    res.setHeader("Retry-After", String(retryAfter));
    return res.status(429).json({ success: false, error: msg(req, "tooManyRequests") });
  };
}
