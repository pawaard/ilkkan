// Yönetim API'si: giriş, oturum, CSRF, deneme sınırı ve tüm yönetim uçları
import assert from "node:assert/strict";
import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { hostGet, readSiteData, startTestServer, TINY_PNG } from "./helpers.js";

let t;
let session;
let call;
const json = async (res) => ({ status: res.status, body: await res.json() });

before(async () => {
  t = await startTestServer();
  session = await t.login();
  call = t.admin(session);
});
after(async () => { await t.close(); });

describe("giriş ve oturum", () => {
  test("oturumsuz istek 401", async () => {
    const res = await json(await t.request("/api/admin/matches"));
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });

  test("oturum yoklaması: girişsiz false, girişliyse kullanıcı + CSRF", async () => {
    const anon = await json(await t.request("/api/admin/session"));
    assert.equal(anon.status, 200);
    assert.deepEqual(anon.body.data, { authenticated: false, siteUrl: "http://ilkkan.test" });
    const known = await json(await call("/api/admin/session"));
    assert.equal(known.body.data.authenticated, true);
    assert.equal(known.body.data.csrf, session.csrf);
  });

  test("giriş çerezi HttpOnly + SameSite=Strict, CSRF belirteci döner", async () => {
    const s = await t.login();
    assert.equal(s.res.status, 200);
    const cookie = s.res.headers.get("set-cookie");
    assert.match(cookie, /ilkkan_oturum=/);
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Strict/);
    assert.ok(s.csrf.length > 20);
    const me = await json(await t.admin(s)("/api/admin/me"));
    assert.equal(me.body.data.username, "test-admin");
  });

  test("CSRF başlığı olmadan ya da yanlışken değişiklik 403", async () => {
    const noToken = await t.request("/api/admin/content/quotes", {
      method: "PUT", body: { items: ["x"] }, headers: { Cookie: session.cookie },
    });
    assert.equal(noToken.status, 403);
    const wrong = await call("/api/admin/content/quotes", { method: "PUT", body: { items: ["x"] }, headers: { "X-CSRF-Token": "yanlis" } });
    assert.equal(wrong.status, 403);
  });

  test("başka siteden gelen istek (Origin) reddedilir", async () => {
    const res = await call("/api/admin/content/quotes", { method: "PUT", body: { items: ["x"] }, headers: { Origin: "https://kotu.example" } });
    assert.equal(res.status, 403);
    const loginRes = await t.request("/api/admin/login", { method: "POST", body: { username: "a", password: "b" }, headers: { Origin: "https://kotu.example" } });
    assert.equal(loginRes.status, 403);
  });

  test("bozuk JSON 400 döner ve ayrıntı sızdırmaz", async () => {
    const res = await call("/api/admin/content/quotes", { method: "PUT", body: "{bozuk", raw: true, headers: { "Content-Type": "application/json" } });
    assert.equal(res.status, 400);
    assert.match((await res.json()).error, /İstek okunamadı/);
  });

  test("şifre değiştirme: yanlış mevcut şifre 400, doğruysa eski oturumlar kapanır", async () => {
    const s = await t.login();
    const c = t.admin(s);
    assert.equal((await c("/api/admin/password", { method: "POST", body: { current: "yanlis", newPassword: "yepyeni-sifre-123" } })).status, 400);
    assert.equal((await c("/api/admin/password", { method: "POST", body: { current: t.password, newPassword: "kisa" } })).status, 400);
    const ok = await c("/api/admin/password", { method: "POST", body: { current: t.password, newPassword: "yepyeni-sifre-123" } });
    assert.equal(ok.status, 200);
    const fresh = { cookie: ok.headers.get("set-cookie").split(";")[0], csrf: (await ok.json()).data.csrf };
    assert.equal((await call("/api/admin/me")).status, 401, "eski oturum kapanmalı");
    assert.equal((await t.admin(fresh)("/api/admin/me")).status, 200);
    // Sonraki testler için eski şifreye dön
    await t.admin(fresh)("/api/admin/password", { method: "POST", body: { current: "yepyeni-sifre-123", newPassword: t.password } });
    session = await t.login();
    call = t.admin(session);
  });

  test("çıkış yapınca oturum geçersiz olur", async () => {
    const s = await t.login();
    const c = t.admin(s);
    assert.equal((await c("/api/admin/logout", { method: "POST" })).status, 200);
    assert.equal((await c("/api/admin/me")).status, 401);
  });
});

describe("maçlar", () => {
  const newMatch = {
    id: "test-mac", cat: "futbol", league: "Test Ligi", home: "Ev", away: "Dep", homeShort: "ev", awayShort: "DEP",
    time: "21:30", status: "upcoming", clock: "", period: "Bugün 21.30", score: null, derby: false,
    streams: ["https://cdn.example/yayin.m3u8", ""],
  };

  test("ekle → kopya 409 → geçersiz 400 (Türkçe mesaj)", async () => {
    const created = await json(await call("/api/admin/matches", { method: "POST", body: newMatch }));
    assert.equal(created.status, 201);
    assert.equal(created.body.data.homeShort, "EV");
    assert.deepEqual(created.body.data.streams, ["https://cdn.example/yayin.m3u8"]);
    assert.equal((await call("/api/admin/matches", { method: "POST", body: newMatch })).status, 409);
    const bad = await json(await call("/api/admin/matches", { method: "POST", body: { ...newMatch, id: "baska", time: "25:00" } }));
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /Saat: SS:DD/);
    const badStream = await json(await call("/api/admin/matches", { method: "POST", body: { ...newMatch, id: "baska", streams: ["javascript:alert(1)"] } }));
    assert.equal(badStream.status, 400);
    assert.match(badStream.body.error, /Yayın adresi/);
  });

  test("güncelle ve sırala", async () => {
    const updated = await json(await call("/api/admin/matches/test-mac", { method: "PUT", body: { ...newMatch, league: "Yeni Lig" } }));
    assert.equal(updated.body.data.league, "Yeni Lig");
    assert.equal((await call("/api/admin/matches/yok", { method: "PUT", body: newMatch })).status, 404);
    const list = (await json(await call("/api/admin/matches"))).body.data;
    const ids = [list.at(-1).id, ...list.slice(0, -1).map((m) => m.id)];
    const ordered = await json(await call("/api/admin/matches/order", { method: "PUT", body: { ids } }));
    assert.equal(ordered.body.data[0].id, "test-mac");
  });

  test("canlı kumanda: başlat, gol, geri al, bitir", async () => {
    const live = (body) => call("/api/admin/matches/test-mac/live", { method: "PATCH", body }).then(json);
    let r = await live({ status: "live", clock: "1'", period: "1. dakika" });
    assert.deepEqual(r.body.data.score, [0, 0], "başlayan maçın skoru 0–0 olur");
    r = await live({ goal: "home" });
    r = await live({ goal: "home" });
    r = await live({ goal: "away" });
    assert.deepEqual(r.body.data.score, [2, 1]);
    r = await live({ undo: "away" });
    r = await live({ undo: "away" });
    assert.deepEqual(r.body.data.score, [2, 0], "skor eksiye düşmez");
    r = await live({ status: "finished" });
    assert.equal(r.body.data.clock, "MS");
    assert.equal(r.body.data.period, "Maç sonu");
    assert.equal((await live({})).status, 400);
    assert.equal((await call("/api/admin/matches/yok/live", { method: "PATCH", body: { goal: "home" } })).status, 404);

    const data = await readSiteData(t.request);
    assert.deepEqual(data.matches.find((m) => m.id === "test-mac").score, [2, 0], "site verisi güncellenir");
  });

  test("derbi olarak seçili maç silinemez; diğeri silinir", async () => {
    assert.equal((await call("/api/admin/matches/gs-fb", { method: "DELETE" })).status, 409);
    assert.equal((await call("/api/admin/matches/test-mac", { method: "DELETE" })).status, 200);
    assert.equal((await call("/api/admin/matches/test-mac", { method: "DELETE" })).status, 404);
  });
});

describe("kanallar", () => {
  const channel = { id: "ch-test", no: "07", name: "İlkkan 7", genre: "Test", cat: "kanal", now: "Şimdi", next: "Sonra", progress: 0.5, matchId: null, feature: false, streams: [] };

  test("ekle, bağlı maç kontrolü, güncelle, sil", async () => {
    assert.equal((await call("/api/admin/channels", { method: "POST", body: channel })).status, 201);
    assert.equal((await call("/api/admin/channels", { method: "POST", body: channel })).status, 409);
    assert.equal((await call("/api/admin/channels", { method: "POST", body: { ...channel, id: "ch-x", matchId: "yok" } })).status, 400);
    const up = await json(await call("/api/admin/channels/ch-test", { method: "PUT", body: { ...channel, matchId: "bjk-ts", progress: 0.9 } }));
    assert.equal(up.body.data.matchId, "bjk-ts");
    assert.equal((await call("/api/admin/channels/ch-test", { method: "PUT", body: { ...channel, matchId: "yok" } })).status, 400);
    assert.equal((await call("/api/admin/channels/yok", { method: "PUT", body: channel })).status, 404);
    assert.equal((await call("/api/admin/channels", { method: "POST", body: { ...channel, id: "ch-y", progress: 2 } })).status, 400);
    assert.equal((await call("/api/admin/channels/ch-test", { method: "DELETE" })).status, 200);
    assert.equal((await call("/api/admin/channels/ch-test", { method: "DELETE" })).status, 404);
    assert.equal((await json(await call("/api/admin/channels"))).body.data.length, 6);
  });

  test("maç ve kanal kimlikleri çakışamaz (sitede tek sözlükte durur)", async () => {
    const asChannel = await json(await call("/api/admin/channels", { method: "POST", body: { ...channel, id: "bjk-ts" } }));
    assert.equal(asChannel.status, 409);
    assert.match(asChannel.body.error, /maç zaten var/);
    const asMatch = await json(await call("/api/admin/matches", { method: "POST", body: {
      id: "ch-1", cat: "futbol", league: "L", home: "A", away: "B", homeShort: "A", awayShort: "B", time: "20:00", status: "upcoming",
    } }));
    assert.equal(asMatch.status, 409);
    assert.match(asMatch.body.error, /kanal zaten var/);
  });
});

describe("metinler", () => {
  test("liste kaydedilir; boş/uzun/olmayan tür reddedilir", async () => {
    const all = await json(await call("/api/admin/content"));
    assert.ok(all.body.data.tr.quotes.length > 0);
    assert.ok(all.body.data.en.quotes.length > 0, "İngilizce başlangıç listesi de gelir");
    const ok = await json(await call("/api/admin/content/quotes", { method: "PUT", body: { items: ["  Top yuvarlak.  "] } }));
    assert.deepEqual(ok.body.data, ["Top yuvarlak."]);
    assert.equal((await call("/api/admin/content/quotes", { method: "PUT", body: { items: [] } })).status, 400);
    assert.equal((await call("/api/admin/content/quotes", { method: "PUT", body: { items: ["x".repeat(121)] } })).status, 400);
    assert.equal((await call("/api/admin/content/tickerAds", { method: "PUT", body: { items: ["a", "b", "c"] } })).status, 400, "skorbord en fazla 2 sponsor yazısı gösterir");
    assert.equal((await call("/api/admin/content/__proto__", { method: "PUT", body: { items: [] } })).status, 404);
    const sub = await call("/api/admin/content/subtitles", { method: "PUT", body: { items: [{ a: "Soru?", b: "Cevap." }] } });
    assert.equal(sub.status, 200);
    const data = await readSiteData(t.request);
    assert.deepEqual(data.subtitles, [["Soru?", "Cevap."]]);
    assert.deepEqual(data.quotes, ["Top yuvarlak."]);
  });
});

describe("reklam alanları", () => {
  test("mod kuralları ve site verisine yansıması", async () => {
    const list = await json(await call("/api/admin/ads"));
    assert.equal(list.body.data.length, 17);
    assert.equal((await call("/api/admin/ads/01", { method: "PUT", body: { mode: "image" } })).status, 400);
    assert.equal((await call("/api/admin/ads/01", { method: "PUT", body: { mode: "code", code: "  " } })).status, 400);
    assert.equal((await call("/api/admin/ads/01", { method: "PUT", body: { mode: "image", imageUrl: "javascript:alert(1)" } })).status, 400);
    assert.equal((await call("/api/admin/ads/01", { method: "PUT", body: { mode: "image", imageUrl: "/uploads/a.png", linkUrl: "javascript:x" } })).status, 400);
    const ok = await json(await call("/api/admin/ads/01", { method: "PUT", body: { mode: "image", imageUrl: "/uploads/reklam.png", linkUrl: "https://sponsor.example", alt: "Sponsor" } }));
    assert.equal(ok.body.data.mode, "image");
    await call("/api/admin/ads/02", { method: "PUT", body: { mode: "off" } });
    await call("/api/admin/ads/03", { method: "PUT", body: { mode: "code", code: "<div class=\"ortak\"></div>" } });
    assert.equal((await call("/api/admin/ads/99", { method: "PUT", body: { mode: "off" } })).status, 404);
    const units = (await readSiteData(t.request)).ads.units;
    assert.equal(units["01"].imageUrl, "/uploads/reklam.png");
    assert.equal(units["02"].mode, "off");
    assert.equal(units["03"].mode, "code");
  });
});

describe("ayarlar", () => {
  test("site bilgileri sayfaya yansır", async () => {
    const all = await json(await call("/api/admin/settings"));
    assert.ok(all.body.data.creatives.length >= 5);
    const site = { ...all.body.data.site, title: "İlkkan TV", telegramUrl: "https://t.me/ilkkan", xUrl: "" };
    assert.equal((await call("/api/admin/settings/site", { method: "PUT", body: site })).status, 200);
    const html = await (await t.request("/")).text();
    assert.match(html, /<title>İlkkan TV — /);
    assert.match(html, /href="https:\/\/t\.me\/ilkkan" target="_blank" rel="noopener" aria-label="Telegram" >/);
    assert.equal((await call("/api/admin/settings/site", { method: "PUT", body: { ...site, telegramUrl: "http://t.me/x" } })).status, 400);
  });

  test("derbi, sponsor, görseller, reklam ayarı doğrulanır", async () => {
    assert.equal((await call("/api/admin/settings/derby", { method: "PUT", body: { matchId: "yok", kickoff: "20:00", prediction: "" } })).status, 400);
    assert.equal((await call("/api/admin/settings/derby", { method: "PUT", body: { matchId: "bjk-ts", kickoff: "19:00", prediction: "1–0" } })).status, 200);
    assert.equal((await call("/api/admin/settings/player", { method: "PUT", body: { sponsor: "yok-boyle" } })).status, 400);
    assert.equal((await call("/api/admin/settings/player", { method: "PUT", body: { sponsor: "" } })).status, 200);
    const images = { posterLeft: "/uploads/a.png", posterRight: "/assets/img/ilkkan-sahne.jpg", hero: "https://cdn.example/h.jpg", card: "/assets/img/ilkkan-portre.jpg", rentPhotos: [{ src: "/uploads/b.webp", focus: "50% 10%" }] };
    assert.equal((await call("/api/admin/settings/images", { method: "PUT", body: images })).status, 200);
    assert.equal((await call("/api/admin/settings/images", { method: "PUT", body: { ...images, hero: "../../etc/passwd" } })).status, 400);
    assert.equal((await call("/api/admin/settings/ads", { method: "PUT", body: { rentHref: "mailto:reklam@ilkkan.test", clickNote: "Not" } })).status, 200);
    assert.equal((await call("/api/admin/settings/nope", { method: "PUT", body: {} })).status, 404);
    const data = await readSiteData(t.request);
    assert.equal(data.derby.matchId, "bjk-ts");
    assert.equal(data.ads.playerSponsor, "");
    assert.equal(data.ads.rent.href, "mailto:reklam@ilkkan.test");
    assert.ok(Object.keys(data.ads.creatives).length >= 5, "reklam ayarı birleştirilir, kreatifler silinmez");
    assert.match(await (await t.request("/")).text(), /src="\/uploads\/a\.png"/);
  });
});

describe("görsel yükleme", () => {
  const upload = (data, name = "x.png") => call("/api/admin/uploads", { method: "POST", body: { name, data } });

  test("gerçek PNG kabul edilir, sahte/büyük dosya reddedilir", async () => {
    const ok = await json(await upload(`data:image/png;base64,${TINY_PNG.toString("base64")}`));
    assert.equal(ok.status, 201);
    assert.match(ok.body.data.url, /^\/uploads\/\d{8}-[0-9a-f]{12}\.png$/);
    assert.ok(existsSync(join(t.uploadDir, ok.body.data.name)));
    assert.equal(statSync(join(t.uploadDir, ok.body.data.name)).size, TINY_PNG.length);

    const served = await t.request(ok.body.data.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");

    const fake = await json(await upload(Buffer.from("<svg onload=alert(1)>").toString("base64"), "x.png"));
    assert.equal(fake.status, 400);
    assert.match(fake.body.error, /PNG, JPG ya da WebP/);
    assert.equal((await upload("bu base64 değil!!")).status, 400);
    const big = Buffer.concat([TINY_PNG, Buffer.alloc(1024 * 1024)]).toString("base64");
    assert.equal((await upload(big)).status, 400);

    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(16)]).toString("base64");
    assert.equal((await upload(jpg, "a.jpg")).status, 201);
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBPVP8 ")]).toString("base64");
    assert.equal((await upload(webp, "a.webp")).status, 201);

    const files = await json(await call("/api/admin/uploads"));
    assert.equal(files.body.data.length, 3);
    assert.equal((await call("/api/admin/uploads/..%2F..%2Fpackage.json", { method: "DELETE" })).status, 400);
    assert.equal((await call(`/api/admin/uploads/${ok.body.data.name}`, { method: "DELETE" })).status, 200);
    assert.equal((await call(`/api/admin/uploads/${ok.body.data.name}`, { method: "DELETE" })).status, 404);
  });
});

describe("istatistik ve denetim kaydı", () => {
  test("özet sayılar ve 14 günlük seri", async () => {
    await t.request("/api/t", { method: "POST", body: JSON.stringify({ e: "imp", k: "05" }), raw: true });
    const stats = await json(await call("/api/admin/stats?days=14"));
    assert.equal(stats.body.data.series.length, 14);
    assert.ok(stats.body.data.live >= 1);
    assert.ok(stats.body.data.units.some((u) => u.id === "05" && u.imps === 1));
    assert.equal((await json(await call("/api/admin/stats?days=999"))).body.data.series.length, 60);
  });

  test("yapılan değişiklikler kim/ne olarak kaydedilir", async () => {
    const log = await json(await call("/api/admin/audit"));
    assert.ok(log.body.data.length > 5);
    assert.ok(log.body.data.every((row) => row.admin === "test-admin"));
    assert.ok(log.body.data.some((row) => row.action.startsWith("canlı güncelleme")));
  });
});

describe("kaba kuvvet koruması", () => {
  test("15 dakikada 5 hatalı denemeden sonra 429", async () => {
    const fresh = await startTestServer();
    try {
      for (let i = 0; i < 5; i += 1) {
        const r = await fresh.login("test-admin", "yanlis-sifre");
        assert.equal(r.res.status, 401, `deneme ${i + 1}`);
        assert.match(r.json.error, /Kullanıcı adı ya da şifre yanlış/);
      }
      const blocked = await fresh.login("test-admin", fresh.password);
      assert.equal(blocked.res.status, 429, "doğru şifre bile beklemek zorunda");
      assert.ok(Number(blocked.res.headers.get("retry-after")) > 0);
    } finally {
      await fresh.close();
    }
  });

  test("aynı anda gönderilen 40 deneme sınırı aşamaz (en fazla 5 şifre kontrolü)", async () => {
    const fresh = await startTestServer();
    try {
      const results = await Promise.all(Array.from({ length: 40 }, () => fresh.login("test-admin", "yanlis-sifre")));
      const statuses = results.map((r) => r.res.status);
      assert.equal(statuses.filter((s) => s === 401).length, 5);
      assert.equal(statuses.filter((s) => s === 429).length, 35);
    } finally {
      await fresh.close();
    }
  });

  test("başarılı giriş sayacı sıfırlar", async () => {
    const fresh = await startTestServer();
    try {
      for (let i = 0; i < 4; i += 1) await fresh.login("test-admin", "yanlis-sifre");
      assert.equal((await fresh.login()).res.status, 200);
      for (let i = 0; i < 4; i += 1) assert.equal((await fresh.login("test-admin", "yanlis-sifre")).res.status, 401);
    } finally {
      await fresh.close();
    }
  });

  test("olmayan kullanıcı da aynı mesajı alır", async () => {
    const r = await t.login("kimse-yok", "abc");
    assert.equal(r.res.status, 401);
    assert.match(r.json.error, /Kullanıcı adı ya da şifre yanlış/);
  });

  test("süresi dolmuş oturumla çıkış da çerezi temizler", async () => {
    const res = await t.request("/api/admin/logout", { method: "POST", headers: { Cookie: "ilkkan_oturum=gecersiz" } });
    assert.equal(res.status, 200);
    assert.match(res.headers.get("set-cookie"), /Max-Age=0/);
  });
});

describe("https ve ayrı panel alan adı", () => {
  test("SITE_URL https ise çerez Secure, HSTS açık (NODE_ENV'den bağımsız)", async () => {
    const secure = await startTestServer({ SITE_URL: "https://ilkkan.test", NODE_ENV: "development" });
    try {
      const s = await secure.login();
      assert.match(s.res.headers.get("set-cookie"), /; Secure/);
      assert.match((await secure.request("/")).headers.get("strict-transport-security"), /max-age=31536000/);
    } finally {
      await secure.close();
    }
    assert.ok(!(await t.login()).res.headers.get("set-cookie").includes("Secure"), "http'de Secure yok");
    assert.equal((await t.request("/")).headers.get("strict-transport-security"), null);
  });

  test("ADMIN_HOST: panel yalnızca kendi alan adında, panel alan adında site sayfası yok", async () => {
    const split = await startTestServer({ ADMIN_HOST: "reji.ilkkan.test" });
    try {
      const onSite = (path) => split.request(path);
      const onAdmin = (path) => hostGet(split.base, path, "reji.ilkkan.test"); // fetch Host başlığını değiştirmez
      assert.equal((await onSite("/yonetim/")).status, 404);
      assert.equal((await onSite("/api/admin/session")).status, 404);
      assert.equal((await onSite("/")).status, 200);
      assert.equal((await onAdmin("/yonetim/")).status, 200);
      assert.equal((await onAdmin("/api/admin/session")).status, 200);
      assert.equal((await onAdmin("/css/styles.css")).status, 200);
      const home = await onAdmin("/");
      assert.equal(home.status, 302);
      assert.equal(home.headers.location, "/yonetim/");
      assert.equal((await onAdmin("/mac/bjk-ts")).status, 302, "reklam kodlu site sayfaları panel kökeninde açılmaz");
      // Büyük/küçük harf oyunu kapıyı aşamaz (Express ve Windows dosya sistemi harf duyarsız)
      for (const path of ["/Yonetim/", "/YONETIM/js/main.js", "/API/ADMIN/session", "/Api/Admin/me"]) {
        assert.equal((await hostGet(split.base, path, "ilkkan.test")).status, 404, path);
      }
    } finally {
      await split.close();
    }
  });
});

describe("yayın adresi kuralları", () => {
  const base = {
    cat: "futbol", league: "L", home: "A", away: "B", homeShort: "A", awayShort: "B", time: "20:00", status: "upcoming",
  };
  test("http yayın adresi reddedilir; yerel denemede http serbest", async () => {
    const bad = await json(await call("/api/admin/matches", { method: "POST", body: { ...base, id: "http-mac", streams: ["http://cdn.example/a.m3u8"] } }));
    assert.equal(bad.status, 400);
    assert.match(bad.body.error, /https:\/\//);
    const local = await call("/api/admin/matches", { method: "POST", body: { ...base, id: "yerel-mac", streams: ["http://localhost:8080/a.m3u8"] } });
    assert.equal(local.status, 201);
    await call("/api/admin/matches/yerel-mac", { method: "DELETE" });
  });
});
