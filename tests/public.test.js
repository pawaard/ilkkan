// Herkese açık site: sayfalar, veri, SEO, güvenlik başlıkları, sayaç
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import { readSiteData, startTestServer } from "./helpers.js";

let t;
before(async () => { t = await startTestServer(); });
after(async () => { await t.close(); });

describe("ana sayfa", () => {
  test("şablon eksiksiz doldurulur, SEO etiketleri ve görseller gelir", async () => {
    const res = await t.request("/");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!/\{\{/.test(html), "doldurulmamış şablon değişkeni kalmamalı");
    assert.match(html, /<title>İlkkan Sports — Herkes kazanmış gibi\.<\/title>/);
    assert.match(html, /<link rel="canonical" href="http:\/\/ilkkan\.test\/" \/>/);
    assert.match(html, /property="og:image" content="http:\/\/ilkkan\.test\/assets\/img\/og\.jpg"/);
    assert.match(html, /"@type":"WebSite"/);
    assert.match(html, /src="\/assets\/img\/ilkkan-portre\.jpg"/);
    assert.equal((html.match(/data-ad-no="\d\d"/g) || []).length, 16);
    assert.ok(!html.includes("fonts.googleapis.com"), "Google Fonts bağlantısı olmamalı");
    assert.equal(res.headers.get("cache-control"), "no-store");
  });

  test("boş sosyal bağlantılar gizlenir, dolu olanlar görünür", async () => {
    const html = await (await t.request("/")).text();
    assert.match(html, /aria-label="Telegram" hidden>/);
  });

  test("/index.html şablonu dışarı açılmaz", async () => {
    const res = await t.request("/index.html");
    assert.equal(res.status, 301);
    assert.equal(res.headers.get("location"), "/");
  });
});

describe("site verisi", () => {
  test("/data.js eski data.js ile aynı şekli üretir", async () => {
    const data = await readSiteData(t.request);
    assert.equal(data.categories.length, 5);
    assert.equal(data.matches.length, 13);
    assert.equal(data.channels.length, 6);
    assert.deepEqual(data.matches[0].score, [1, 0]);
    assert.ok(Array.isArray(data.matches[0].streams));
    assert.equal(data.subtitles[0].length, 2);
    assert.equal(Object.keys(data.ads.units).length, 17);
    assert.equal(data.ads.units["01"].mode, "kiralik");
    assert.ok(data.ads.rent.copies.length >= 1);
    assert.equal(data.ads.playerSponsor, "kola-cay");
    assert.equal(data.derby.matchId, "gs-fb");
    assert.ok(Object.isFrozen(data));
  });

  test("/api/live hafif canlı veri döndürür", async () => {
    const res = await t.request("/api/live");
    const body = await res.json();
    assert.equal(body.success, true);
    const bjk = body.data.matches.find((m) => m.id === "bjk-ts");
    assert.deepEqual(Object.keys(bjk).sort(), ["clock", "id", "period", "score", "status", "streams"]);
    assert.equal(body.data.channels.length, 6);
  });
});

describe("alt sayfalar ve SEO", () => {
  test("maç sayfası sunucuda üretilir, SportsEvent verisi taşır", async () => {
    const res = await t.request("/mac/bjk-ts");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.match(html, /<title>Beşiktaş 1–0 Trabzonspor canlı izle · İlkkan Sports<\/title>/);
    assert.match(html, /"@type":"SportsEvent"/);
    assert.match(html, /"startDate":"\d{4}-\d\d-\d\dT19:00:00\+03:00"/);
    assert.match(html, /href="\/\?mac=bjk-ts#canli"/);
    assert.match(html, /<script type="module" src="\/js\/pageview\.js\?v=/, "maç sayfası görüntülemesi sayılır");
  });

  test("yakında ve bitmiş maç sayfaları doğru başlığı kullanır", async () => {
    assert.match(await (await t.request("/mac/gs-fb")).text(), /Galatasaray – Fenerbahçe 20\.00 canlı yayın/);
    assert.match(await (await t.request("/mac/eyp-goz")).text(), /Eyüpspor 2–1 Göztepe maç sonucu/);
  });

  test("olmayan maç ve sayfa temalı 404 döner, API JSON 404 döner", async () => {
    const page = await t.request("/mac/olmayan-mac");
    assert.equal(page.status, 404);
    assert.match(await page.text(), /Yok\. <em>Olsun\.<\/em>/);
    assert.equal((await t.request("/olmayan-sayfa")).status, 404);
    const api = await t.request("/api/olmayan");
    assert.equal(api.status, 404);
    assert.equal((await api.json()).success, false);
  });

  test("yasal sayfalar açılır", async () => {
    for (const path of ["/kvkk", "/cerez-politikasi", "/kullanim-kosullari"]) {
      const res = await t.request(path);
      assert.equal(res.status, 200, path);
      assert.match(await res.text(), /şablondur/);
    }
  });

  test("sitemap ve robots.txt", async () => {
    const xml = await (await t.request("/sitemap.xml")).text();
    assert.match(xml, /<loc>http:\/\/ilkkan\.test\/mac\/bjk-ts<\/loc>/);
    assert.match(xml, /<loc>http:\/\/ilkkan\.test\/kvkk<\/loc>/);
    const robots = await (await t.request("/robots.txt")).text();
    assert.match(robots, /Disallow: \/yonetim/);
    assert.match(robots, /Sitemap: http:\/\/ilkkan\.test\/sitemap\.xml/);
  });

  test("statik dosyalar ve panel sayfası", async () => {
    const css = await t.request("/css/styles.css");
    assert.equal(css.status, 200);
    assert.equal(css.headers.get("cache-control"), "no-cache");
    assert.equal((await t.request("/yonetim")).status, 301);
    const panel = await t.request("/yonetim/");
    assert.equal(panel.status, 200);
    assert.match(await panel.text(), /Reji/);
  });
});

describe("güvenlik başlıkları", () => {
  test("site: nosniff, çerçeve koruması, CSP", async () => {
    const res = await t.request("/");
    assert.equal(res.headers.get("x-content-type-options"), "nosniff");
    assert.equal(res.headers.get("x-frame-options"), "SAMEORIGIN");
    assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'self'/);
    assert.equal(res.headers.get("x-powered-by"), null);
  });

  test("panel: sıkı CSP, çerçevelenemez, indekslenmez", async () => {
    const res = await t.request("/yonetim/");
    assert.match(res.headers.get("content-security-policy"), /script-src 'self'/);
    assert.equal(res.headers.get("x-frame-options"), "DENY");
    assert.equal(res.headers.get("x-robots-tag"), "noindex, nofollow");
  });
});

describe("çerezsiz sayaç", () => {
  const beacon = (body, ua = "Mozilla/5.0 Test") =>
    t.request("/api/t", { method: "POST", body: JSON.stringify(body), raw: true, headers: { "Content-Type": "text/plain", "User-Agent": ua } });

  test("geçerli olaylar sayılır, geçersiz ve bot istekleri sayılmaz", async () => {
    assert.equal((await beacon({ e: "view", k: "/" })).status, 204);
    await beacon({ e: "view", k: "/" }); // aynı ziyaretçi: tekil sayı artmaz
    await beacon({ e: "imp", k: "01" });
    await beacon({ e: "click", k: "01" });
    await beacon({ e: "play", k: "bjk-ts" });
    await beacon({ e: "imp", k: "99" }); // olmayan alan
    await beacon({ e: "view", k: "/" }, "Googlebot/2.1");
    await beacon({ e: "hack", k: "x" });
    assert.equal((await t.request("/api/t", { method: "POST", body: "bozuk{", raw: true })).status, 204);

    const rows = t.db.prepare("SELECT event, key, count FROM stats_daily ORDER BY event, key").all()
      .map((r) => `${r.event}:${r.key}:${r.count}`);
    assert.deepEqual(rows, ["click:01:1", "imp:01:1", "play:bjk-ts:1", "view:/:2", "visitor::1"]);
  });

  test("maç sayfası görüntülemesi sayılır; olmayan maç adresiyle tablo şişirilemez", async () => {
    await beacon({ e: "view", k: "/mac/bjk-ts" }, "Mozilla/5.0 A");
    for (let i = 0; i < 20; i += 1) await beacon({ e: "view", k: `/mac/uydurma-${i}` }, `Mozilla/5.0 ${i}`);
    const keys = t.db.prepare("SELECT key FROM stats_daily WHERE event = 'view'").all().map((r) => r.key).sort();
    assert.deepEqual(keys, ["/", "/mac/bjk-ts"]);
    assert.equal(t.db.prepare("SELECT COUNT(*) AS n FROM visitors_today").get().n, 2);
  });
});
