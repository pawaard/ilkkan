// Test yardımcıları: bellek içi veritabanıyla uygulamayı rastgele portta başlatır
import { randomBytes } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { request as httpRequest } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createAdmin } from "../server/auth.js";
import { createApp } from "../server/app.js";
import { loadConfig } from "../server/config.js";
import { openDb } from "../server/db.js";
import { initData } from "../server/migrate.js";

export const TEST_USER = "test-admin";

/** @param {Record<string, string>} env  loadConfig'e eklenecek/ezilecek ortam değişkenleri */
export async function startTestServer(env = {}) {
  const uploadDir = mkdtempSync(join(tmpdir(), "ilkkan-uploads-"));
  const password = randomBytes(12).toString("base64url"); // her çalıştırmada yeni test şifresi
  const config = loadConfig({ PORT: "0", SITE_URL: "http://ilkkan.test", NODE_ENV: "test", UPLOAD_DIR: uploadDir, ...env });
  const db = openDb(":memory:");
  initData(db);
  await createAdmin(db, TEST_USER, password);
  const server = createApp({ db, config }).listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  const base = `http://127.0.0.1:${server.address().port}`;

  const request = (path, { method = "GET", body, headers = {}, raw = false } = {}) => fetch(`${base}${path}`, {
    method,
    redirect: "manual",
    headers: { ...(body !== undefined && !raw ? { "Content-Type": "application/json" } : {}), ...headers },
    body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
  });

  async function login(user = TEST_USER, pass = password) {
    const res = await request("/api/admin/login", { method: "POST", body: { username: user, password: pass } });
    const json = await res.json();
    const cookie = (res.headers.get("set-cookie") || "").split(";")[0];
    return { res, json, cookie, csrf: json.data ? json.data.csrf : "" };
  }

  /** Oturumlu istek: çerez + CSRF başlığı */
  const admin = (session) => (path, options = {}) => request(path, {
    ...options,
    headers: { Cookie: session.cookie, "X-CSRF-Token": session.csrf, ...(options.headers || {}) },
  });

  async function close() {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(uploadDir, { recursive: true, force: true });
  }

  return { base, db, config, password, uploadDir, request, login, admin, close };
}

/** Belirli bir Host başlığıyla GET (fetch Host'u değiştirmeye izin vermez) → { status, headers } */
export function hostGet(base, path, host) {
  const { hostname, port } = new URL(base);
  return new Promise((resolve, reject) => {
    const req = httpRequest({ hostname, port, path, headers: { Host: host } }, (res) => {
      res.resume();
      res.on("end", () => resolve({ status: res.statusCode, headers: res.headers }));
    });
    req.on("error", reject);
    req.end();
  });
}

/** /data.js çıktısını çalıştırıp window.ILKKAN_DATA'yı döndürür */
export async function readSiteData(request) {
  const text = await (await request("/data.js")).text();
  const window = {};
  new Function("window", text)(window);
  return window.ILKKAN_DATA;
}

// En küçük geçerli PNG (1×1)
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);
