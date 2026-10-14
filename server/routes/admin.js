// /api/admin — giriş/çıkış + yönetim uçları (hepsi oturum ve CSRF korumalı)
import express from "express";
import {
  changePassword, checkLogin, createSession, destroySession, findSession, readCookie, requireAdmin, sameOrigin,
  SESSION_COOKIE, sessionCookie,
} from "../auth.js";
import { audit } from "../db.js";
import { clientKey, createRateLimiter } from "../security.js";
import { requestLang } from "../i18n/index.js";
import { msg } from "../i18n/messages.js";
import { loginSchema, parse, passwordSchema } from "../validation.js";
import { fixtureRoutes } from "./admin-fixtures.js";
import { fail, ok, validated } from "./respond.js";
import { siteRoutes } from "./admin-site.js";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_PER_IP = 5;

export function adminRouter(db, { config }) {
  const router = express.Router();
  // Yalnızca IP başına sınır: kullanıcı adına göre kilit, adı bilen herkesin yöneticiyi dışarıda bırakmasına yol açardı
  const byIp = createRateLimiter({ windowMs: LOGIN_WINDOW_MS, max: LOGIN_MAX_PER_IP });
  const cookieOpts = { secure: config.secure };

  router.post("/login", express.json({ limit: "10kb" }), async (req, res) => {
    if (!sameOrigin(req)) return fail(res, 403, msg(req, "badOrigin"));
    const body = validated(res, parse(loginSchema, req.body, requestLang(req)));
    if (!body) return undefined;
    // Deneme, yavaş şifre kontrolünden ÖNCE sayılır: aynı anda gönderilen istekler sınırı aşamaz
    const ipKey = clientKey(req.ip);
    const attempt = byIp.hit(ipKey);
    if (!attempt.allowed) {
      res.setHeader("Retry-After", String(attempt.retryAfter));
      return fail(res, 429, msg(req, "tooManyLogins"));
    }
    const admin = await checkLogin(db, body.username, body.password);
    if (!admin) return fail(res, 401, msg(req, "badLogin"));
    byIp.reset(ipKey);
    const { token, csrf } = createSession(db, admin.id);
    audit(db, admin.username, "giriş yaptı");
    res.setHeader("Set-Cookie", sessionCookie(token, cookieOpts));
    return ok(res, { username: admin.username, csrf, siteUrl: config.siteUrl });
  });

  // Panel açılışında oturum yoklaması: oturum yoksa da 200 döner (tarayıcı konsolunda hata kirliliği olmasın)
  router.get("/session", (req, res) => {
    const s = findSession(db, readCookie(req, SESSION_COOKIE));
    return ok(res, s
      ? { authenticated: true, username: s.username, csrf: s.csrf, siteUrl: config.siteUrl }
      : { authenticated: false, siteUrl: config.siteUrl });
  });

  // Çıkış, oturum süresi dolmuş olsa da çerezi temizler (SameSite=Strict + köken kontrolü başka siteden çıkışı engeller)
  router.post("/logout", (req, res) => {
    if (!sameOrigin(req)) return fail(res, 403, msg(req, "badOrigin"));
    destroySession(db, readCookie(req, SESSION_COOKIE));
    res.setHeader("Set-Cookie", sessionCookie("", { ...cookieOpts, maxAgeMs: 0 }));
    return ok(res);
  });

  router.use(requireAdmin(db));

  router.get("/me", (req, res) => ok(res, { username: req.admin.username, csrf: req.admin.csrf }));

  router.post("/password", express.json({ limit: "10kb" }), async (req, res) => {
    const body = validated(res, parse(passwordSchema, req.body, requestLang(req)));
    if (!body) return undefined;
    if (!(await checkLogin(db, req.admin.username, body.current))) return fail(res, 400, msg(req, "badCurrentPassword"));
    await changePassword(db, req.admin.adminId, body.newPassword);
    const { token, csrf } = createSession(db, req.admin.adminId);
    audit(db, req.admin.username, "şifre değiştirdi");
    res.setHeader("Set-Cookie", sessionCookie(token, cookieOpts));
    return ok(res, { csrf });
  });

  siteRoutes(router, db, { uploadDir: config.uploadDir });
  fixtureRoutes(router, db);
  return router;
}
