// Express uygulaması: site + sayaç + yönetim API'si + panel
import express from "express";
import { join } from "node:path";
import { PUBLIC_DIR } from "./config.js";
import { assetVersioner } from "./render/template.js";
import { adminRouter } from "./routes/admin.js";
import { notFound, publicRouter } from "./routes/public.js";
import { trackRouter } from "./routes/track.js";
import { adminHostGate, securityHeaders } from "./security.js";
import { msg } from "./i18n/messages.js";

const WEEK = 7 * 24 * 60 * 60;

// CSS/JS/HTML her seferinde doğrulanır (ETag ile ucuz); görseller ve fontlar bir hafta önbellekte kalır
function staticHeaders(res, path) {
  const revalidate = /\.(css|js|mjs|html)$/i.test(path);
  res.setHeader("Cache-Control", revalidate ? "no-cache" : `public, max-age=${WEEK}`);
}

/**
 * @param {{ db: import("node:sqlite").DatabaseSync, config: ReturnType<typeof import("./config.js").loadConfig>,
 *   publicDir?: string }} deps
 */
export function createApp({ db, config, publicDir = PUBLIC_DIR }) {
  const app = express();
  const version = assetVersioner(publicDir, { cacheMs: config.production ? 60_000 : 1000 });

  app.disable("x-powered-by");
  app.set("trust proxy", config.trustProxy);
  app.set("case sensitive routing", true); // "/Yonetim" ile "/yonetim" farklı yol: güvenlik kontrolleri tek biçime göre yazılı
  app.use(securityHeaders(config));
  app.use(adminHostGate(config));

  app.use(publicRouter(db, { config, publicDir, version }));
  app.use(trackRouter(db));
  app.use("/api/admin", adminRouter(db, { config }));

  // Panel göreli yollar kullandığı için adres "/" ile bitmeli (Express "/yonetim" ve "/yonetim/" ayrımı yapmaz)
  app.get("/yonetim", (req, res) => {
    if (!req.originalUrl.split("?")[0].endsWith("/")) return res.redirect(301, "/yonetim/");
    return res.sendFile(join(publicDir, "yonetim", "index.html"));
  });

  app.use("/uploads", express.static(config.uploadDir, { index: false, dotfiles: "ignore", setHeaders: staticHeaders }));
  app.use(express.static(publicDir, { index: false, extensions: ["html"], dotfiles: "ignore", setHeaders: staticHeaders }));

  app.use(notFound(db, { config, version }));

  // Beklenmeyen hata: kullanıcıya ayrıntı sızdırma, sunucu günlüğüne yaz
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err);
    const status = Number(err.status || err.statusCode) || 500;
    if (status >= 500) console.error("Sunucu hatası:", req.method, req.originalUrl, err);
    const message = msg(req, status === 413 ? "payloadTooLarge" : status < 500 ? "badRequest" : "serverError");
    if (req.path.startsWith("/api/")) return res.status(status).json({ success: false, error: message });
    return res.status(status).type("text").send(message);
  });

  return app;
}
