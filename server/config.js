// Ortam değişkenlerinden ayarlar (.env → npm run dev / start)
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = resolve(fileURLToPath(new URL("..", import.meta.url)));
export const PUBLIC_DIR = resolve(ROOT, "public");
export const UPLOAD_DIR = resolve(PUBLIC_DIR, "uploads");

const trimSlash = (url) => url.replace(/\/+$/, "");

// TRUST_PROXY=1 → yalnızca yerel/özel ağdaki vekile güven (dışarıdan X-Forwarded-For sahteciliği işe yaramaz).
// İleri kullanım: Express "trust proxy" değeri doğrudan yazılabilir (ör. "10.0.0.0/8" ya da "2").
function trustProxyValue(raw = "") {
  const value = raw.trim();
  if (!value || value === "0") return false;
  if (value === "1") return "loopback, linklocal, uniquelocal";
  return /^\d+$/.test(value) ? Number(value) : value;
}

/** @param {NodeJS.ProcessEnv} env */
export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 5500);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error(`PORT geçersiz: ${env.PORT}`);
  const production = env.NODE_ENV === "production";
  const siteUrl = trimSlash(env.SITE_URL || `http://localhost:${port}`);
  if (!/^https?:\/\/[^/\s]+$/i.test(siteUrl)) throw new Error(`SITE_URL geçersiz: ${env.SITE_URL}`);
  const adminHost = (env.ADMIN_HOST || "").trim().toLowerCase();
  if (adminHost && !/^[a-z0-9.-]+(:\d+)?$/.test(adminHost)) throw new Error(`ADMIN_HOST geçersiz: ${env.ADMIN_HOST}`);
  return Object.freeze({
    port,
    production,
    siteUrl,
    // Site https ile yayındaysa oturum çerezi yalnızca HTTPS'te gider ve HSTS açılır (NODE_ENV unutulsa da)
    secure: siteUrl.toLowerCase().startsWith("https://"),
    // Panel ayrı bir alan adından açılsın (ör. reji.alanadi.com): reklam kodları panel oturumuna erişemez
    adminHost,
    dbPath: env.DB_PATH ? resolve(ROOT, env.DB_PATH) : resolve(ROOT, "data", "ilkkan.db"),
    uploadDir: env.UPLOAD_DIR ? resolve(ROOT, env.UPLOAD_DIR) : UPLOAD_DIR,
    adminUser: (env.ADMIN_USER || "").trim(),
    adminPassword: env.ADMIN_PASSWORD || "",
    trustProxy: trustProxyValue(env.TRUST_PROXY),
  });
}
