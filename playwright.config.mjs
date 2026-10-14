// Uçtan uca testler: bilgisayardaki Chrome ile, geçici veritabanı ve her çalıştırmada üretilen test şifresiyle
import { defineConfig } from "@playwright/test";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 5511;
// Ana süreçte bir kez üretilir; test işçileri ortam değişkenini devralır
process.env.E2E_ADMIN_USER ??= "e2e-admin";
process.env.E2E_ADMIN_PASSWORD ??= randomBytes(15).toString("base64url");
process.env.E2E_RUN ??= `${Date.now()}`;

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.PW_CHROMIUM ? undefined : "chrome",
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
    locale: "tr-TR",
    timezoneId: "Europe/Istanbul",
  },
  webServer: {
    command: "node server/index.js",
    url: `http://localhost:${PORT}/api/live`,
    reuseExistingServer: false,
    timeout: 30_000,
    env: {
      PORT: String(PORT),
      NODE_ENV: "test",
      SITE_URL: `http://localhost:${PORT}`,
      DB_PATH: join(tmpdir(), `ilkkan-e2e-${process.env.E2E_RUN}.db`),
      UPLOAD_DIR: join(tmpdir(), `ilkkan-e2e-uploads-${process.env.E2E_RUN}`),
      ADMIN_USER: process.env.E2E_ADMIN_USER,
      ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD,
    },
  },
});
