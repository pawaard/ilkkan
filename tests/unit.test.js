// Saf fonksiyonlar: canlı kumanda hesabı, dosya imzası, şablon, SEO, sınırlayıcı, doğrulama
import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { applyLive } from "../server/routes/admin-fixtures.js";
import { sniffImage } from "../server/routes/admin-site.js";
import { loadConfig } from "../server/config.js";
import { renderTemplate, escapeHtml } from "../server/render/template.js";
import { safeJson } from "../server/site-data.js";
import { clientKey, createRateLimiter } from "../server/security.js";
import { kickoffIso } from "../server/seo.js";
import { dayKey, shiftDay, createVisitorHasher } from "../server/stats.js";
import { matchSchema, parse } from "../server/validation.js";
import { hashPassword, verifyPassword, readCookie } from "../server/auth.js";

const match = { id: "a", home: "A", away: "B", status: "upcoming", score: null, clock: "", period: "Bugün 20.00" };

describe("applyLive", () => {
  test("maç başlayınca skor 0–0, gol ve geri alma", () => {
    const started = applyLive(match, { status: "live" });
    assert.deepEqual(started.score, [0, 0]);
    assert.deepEqual(applyLive(started, { goal: "away" }).score, [0, 1]);
    assert.deepEqual(applyLive({ ...started, score: [0, 0] }, { undo: "home" }).score, [0, 0]);
    assert.deepEqual(match.score, null, "girdi değiştirilmez");
  });
  test("bitince dakika MS olur; açıkça verilen değer korunur", () => {
    const live = { ...match, status: "live", score: [1, 1], clock: "90'" };
    assert.equal(applyLive(live, { status: "finished" }).clock, "MS");
    assert.equal(applyLive(live, { status: "finished", clock: "UZ" }).clock, "UZ");
    assert.deepEqual(applyLive(live, { score: [3, 2] }).score, [3, 2]);
  });
});

describe("sniffImage", () => {
  test("imza baytlarına göre tür", () => {
    assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), "png");
    assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xdb])), "jpg");
    assert.equal(sniffImage(Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")])), "webp");
    assert.equal(sniffImage(Buffer.from("GIF89a")), null);
    assert.equal(sniffImage(Buffer.from("<svg>")), null);
  });
});

describe("şablon ve kaçış", () => {
  test("{{x}} kaçışlanır, {{{x}}} ham kalır, eksik değişken hata verir", () => {
    assert.equal(renderTemplate("<p>{{a}}</p>{{{b}}}", { a: "<b>&\"", b: "<i>" }), "<p>&lt;b&gt;&amp;&quot;</p><i>");
    assert.throws(() => renderTemplate("{{yok}}", {}), /Şablon değişkeni eksik/);
    assert.equal(escapeHtml(null), "");
  });
  test("safeJson </script> ve satır ayırıcılarını kaçışlar", () => {
    const out = safeJson({ x: `</script>${String.fromCharCode(0x2028)}` });
    assert.ok(!out.includes("</script>"));
    assert.ok(!out.includes(String.fromCharCode(0x2028)));
    assert.deepEqual(JSON.parse(out), { x: `</script>${String.fromCharCode(0x2028)}` });
  });
});

describe("hız sınırlayıcı", () => {
  test("pencere içinde sınırı aşınca durdurur, pencere geçince açılır", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    assert.equal(limiter.hit("ip", 0).allowed, true);
    assert.equal(limiter.hit("ip", 10).allowed, true);
    const third = limiter.hit("ip", 20);
    assert.equal(third.allowed, false);
    assert.equal(third.retryAfter, 1);
    assert.equal(limiter.blocked("ip", 500), true);
    assert.equal(limiter.blocked("ip", 2000), false);
    limiter.reset("ip");
    assert.equal(limiter.blocked("ip", 30), false);
  });
  test("engelliyken tekrar denemek bekleme süresini uzatmaz", () => {
    const limiter = createRateLimiter({ windowMs: 1000, max: 2 });
    limiter.hit("ip", 0);
    limiter.hit("ip", 10);
    for (let t = 100; t < 1000; t += 100) assert.equal(limiter.hit("ip", t).allowed, false);
    assert.equal(limiter.hit("ip", 1001).allowed, true, "ilk deneme pencereden çıkınca yeniden izin");
  });
});

describe("istemci anahtarı", () => {
  test("IPv4 tam adres, IPv4-eşlemeli IPv6 sadeleşir, IPv6 /64 ağına indirgenir", () => {
    assert.equal(clientKey("203.0.113.9"), "203.0.113.9");
    assert.equal(clientKey("::ffff:127.0.0.1"), "127.0.0.1");
    assert.equal(clientKey("2001:db8:1:2:aaaa::1"), "2001:db8:1:2::/64");
    assert.equal(clientKey("2001:db8:1:2:ffff:ffff:ffff:ffff"), clientKey("2001:db8:1:2::9"));
    assert.equal(clientKey("::1"), "0:0:0:0::/64");
    assert.equal(clientKey(), "");
  });
});

describe("tarih yardımcıları", () => {
  test("Türkiye saatiyle gün ve kaydırma", () => {
    assert.equal(dayKey(new Date("2026-10-13T22:30:00Z")), "2026-10-14");
    assert.equal(shiftDay("2026-12-31", 1), "2027-01-01");
    assert.equal(shiftDay("2026-03-01", -1), "2026-02-28");
  });
  test("saati geçmiş yakındaki maç ertesi güne yazılır", () => {
    const now = new Date("2026-10-13T20:00:00Z"); // 23.00 TR
    assert.equal(kickoffIso({ status: "upcoming", time: "01:15" }, now), "2026-10-14T01:15:00+03:00");
    assert.equal(kickoffIso({ status: "live", time: "19:00" }, now), "2026-10-13T19:00:00+03:00");
  });
  test("ziyaretçi özeti gün içinde sabit, gün değişince farklı", () => {
    const hash = createVisitorHasher();
    const a = hash("1.2.3.4", "UA", "2026-10-13");
    assert.equal(hash("1.2.3.4", "UA", "2026-10-13"), a);
    assert.notEqual(hash("1.2.3.4", "UA", "2026-10-14"), a);
    assert.ok(!a.includes("1.2.3.4"));
  });
});

describe("şifre ve çerez", () => {
  test("scrypt özeti doğrular, bozuk kaydı reddeder", async () => {
    const stored = await hashPassword("uzun-bir-sifre");
    assert.match(stored, /^scrypt\$/);
    assert.equal(await verifyPassword("uzun-bir-sifre", stored), true);
    assert.equal(await verifyPassword("yanlis", stored), false);
    assert.equal(await verifyPassword("x", "bozuk"), false);
  });
  test("çerez okuyucu", () => {
    const req = { headers: { cookie: "a=1; ilkkan_oturum=abc%2F; b=2" } };
    assert.equal(readCookie(req, "ilkkan_oturum"), "abc/");
    assert.equal(readCookie({ headers: { cookie: "ilkkan_oturum=%E0%A4%A" } }, "ilkkan_oturum"), "");
    assert.equal(readCookie({ headers: {} }, "x"), "");
  });
});

describe("ayar ve doğrulama", () => {
  test("geçersiz ortam değişkenleri reddedilir", () => {
    assert.throws(() => loadConfig({ PORT: "99999" }), /PORT/);
    assert.throws(() => loadConfig({ SITE_URL: "ftp://x" }), /SITE_URL/);
    const config = loadConfig({ SITE_URL: "https://ilkkan.example/", NODE_ENV: "production" });
    assert.equal(config.siteUrl, "https://ilkkan.example");
    assert.equal(config.production, true);
    assert.equal(config.secure, true);
    assert.equal(loadConfig({ SITE_URL: "http://localhost:5500" }).secure, false);
  });
  test("vekil güveni ve panel alan adı", () => {
    assert.equal(loadConfig({}).trustProxy, false);
    assert.equal(loadConfig({ TRUST_PROXY: "0" }).trustProxy, false);
    assert.equal(loadConfig({ TRUST_PROXY: "1" }).trustProxy, "loopback, linklocal, uniquelocal");
    assert.equal(loadConfig({ TRUST_PROXY: "2" }).trustProxy, 2);
    assert.equal(loadConfig({ TRUST_PROXY: "10.0.0.0/8" }).trustProxy, "10.0.0.0/8");
    assert.equal(loadConfig({ ADMIN_HOST: "Reji.Ilkkan.Example" }).adminHost, "reji.ilkkan.example");
    assert.throws(() => loadConfig({ ADMIN_HOST: "https://reji/" }), /ADMIN_HOST/);
  });
  test("satır numaralı Türkçe hata mesajı", () => {
    const r = parse(matchSchema, { id: "Büyük Harf" });
    assert.equal(r.ok, false);
    assert.match(r.error, /^Kimlik: /);
  });
});
