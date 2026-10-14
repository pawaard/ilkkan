// Yönetici girişi: scrypt şifre özeti, veritabanında yalnızca özeti tutulan oturum belirteci, CSRF
import { createHash, randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { msg } from "./i18n/messages.js";

const scryptAsync = promisify(scrypt);
// OWASP önerisi: N=2^14, r=8, p=5 (≈16 MB bellek; 2^17 ile aynı güç, sunucuyu bellekten yormaz)
const SCRYPT = Object.freeze({ N: 16384, r: 8, p: 5, keylen: 64 });
export const SESSION_COOKIE = "ilkkan_oturum";
export const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 saat
export const MIN_PASSWORD = 10;

const sha256 = (text) => createHash("sha256").update(text).digest("hex");

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const { N, r, p, keylen } = SCRYPT;
  const key = await scryptAsync(password, salt, keylen, { N, r, p });
  return ["scrypt", N, r, p, salt.toString("base64"), key.toString("base64")].join("$");
}

export async function verifyPassword(password, stored) {
  const [kind, N, r, p, salt, hash] = String(stored).split("$");
  if (kind !== "scrypt" || !salt || !hash) return false;
  const expected = Buffer.from(hash, "base64");
  const key = await scryptAsync(password, Buffer.from(salt, "base64"), expected.length, {
    N: Number(N), r: Number(r), p: Number(p),
  });
  return timingSafeEqual(key, expected);
}

// Kullanıcı yoksa da aynı sürede cevap ver (kullanıcı adı tahmini zorlaşsın)
let dummyHash = "";
const getDummyHash = async () => {
  if (!dummyHash) dummyHash = await hashPassword(randomBytes(12).toString("hex"));
  return dummyHash;
};

export async function checkLogin(db, username, password) {
  const admin = db.prepare("SELECT id, username, password_hash FROM admins WHERE username = ?").get(username);
  const ok = await verifyPassword(password, admin ? admin.password_hash : await getDummyHash());
  return admin && ok ? { id: admin.id, username: admin.username } : null;
}

export async function createAdmin(db, username, password) {
  if (password.length < MIN_PASSWORD) throw new Error(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
  const hash = await hashPassword(password);
  return db.prepare("INSERT INTO admins (username, password_hash) VALUES (?, ?)").run(username, hash);
}

export async function changePassword(db, adminId, password) {
  const hash = await hashPassword(password);
  db.prepare("UPDATE admins SET password_hash = ? WHERE id = ?").run(hash, adminId);
  db.prepare("DELETE FROM sessions WHERE admin_id = ?").run(adminId); // diğer cihazlardan çıkış
}

export function createSession(db, adminId, now = Date.now()) {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(now);
  db.prepare("INSERT INTO sessions (token_hash, admin_id, csrf, expires_at) VALUES (?, ?, ?, ?)")
    .run(sha256(token), adminId, csrf, now + SESSION_TTL_MS);
  return { token, csrf };
}

export function findSession(db, token, now = Date.now()) {
  if (!token) return null;
  const row = db.prepare(`SELECT s.admin_id, s.csrf, s.expires_at, a.username
    FROM sessions s JOIN admins a ON a.id = s.admin_id WHERE s.token_hash = ?`).get(sha256(token));
  if (!row || row.expires_at < now) return null;
  return { adminId: row.admin_id, username: row.username, csrf: row.csrf };
}

export function destroySession(db, token) {
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(sha256(token));
}

export function readCookie(req, name) {
  const header = req.headers.cookie || "";
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) {
      try {
        return decodeURIComponent(part.slice(i + 1).trim());
      } catch {
        return "";
      }
    }
  }
  return "";
}

export function sessionCookie(token, { secure, maxAgeMs = SESSION_TTL_MS }) {
  const parts = [`${SESSION_COOKIE}=${token}`, "Path=/", "HttpOnly", "SameSite=Strict", `Max-Age=${Math.floor(maxAgeMs / 1000)}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

const safeEqual = (a, b) => {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
};

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

// İstek başka bir siteden mi geliyor? (Origin varsa kendi adresimizle eşleşmeli)
export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === req.headers.host;
  } catch {
    return false;
  }
}

/** Oturum zorunlu; değişiklik isteklerinde CSRF başlığı + aynı köken zorunlu */
export function requireAdmin(db) {
  return (req, res, next) => {
    const session = findSession(db, readCookie(req, SESSION_COOKIE));
    if (!session) return res.status(401).json({ success: false, error: msg(req, "noSession") });
    if (!SAFE_METHODS.has(req.method)) {
      if (!sameOrigin(req) || !safeEqual(req.get("x-csrf-token") || "", session.csrf)) {
        return res.status(403).json({ success: false, error: msg(req, "badCsrf") });
      }
    }
    req.admin = session;
    return next();
  };
}
