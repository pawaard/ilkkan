// İkinci dil (İngilizce): sözlük eşliği, /en/ sayfaları, veri katmanı, göç, yönetim API'si
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { after, before, describe, test } from "node:test";
import { getContent, getSetting, openDb, setContent } from "../server/db.js";
import { clockEn, periodEn } from "../server/i18n/live-en.js";
import { MESSAGE_KEYS } from "../server/i18n/messages.js";
import siteEn from "../server/i18n/site.en.js";
import siteTr from "../server/i18n/site.tr.js";
import { migrateData } from "../server/migrate.js";
import { seedIfEmpty } from "../server/seed.js";
import panelEn from "../public/yonetim/js/lang/en.js";
import panelTr from "../public/yonetim/js/lang/tr.js";
import { readSiteData, startTestServer } from "./helpers.js";

const sameKeys = (a, b) => {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  assert.deepEqual(ka.filter((k) => !kb.includes(k)), [], "yalnızca ilk sözlükte olanlar");
  assert.deepEqual(kb.filter((k) => !ka.includes(k)), [], "yalnızca ikinci sözlükte olanlar");
};

describe("sözlükler", () => {
  test("site, panel ve sunucu mesaj sözlüklerinde iki dilin anahtarları aynı", () => {
    sameKeys(siteTr, siteEn);
    sameKeys(panelTr, panelEn);
    assert.deepEqual(MESSAGE_KEYS.tr.sort(), MESSAGE_KEYS.en.sort());
  });

  test("site JavaScript sözlüğünde iki dil eşit", async () => {
    globalThis.document = { documentElement: { lang: "en" } };
    const { DICT_KEYS, t, formatTime } = await import("../public/js/i18n.js");
    assert.deepEqual([...DICT_KEYS.tr].sort(), [...DICT_KEYS.en].sort());
    assert.equal(t("player.switched", { title: "A – B" }), "Channel changed: A – B.");
    assert.equal(formatTime("20:00"), "20:00");
    delete globalThis.document;
  });

  test("panelde kullanılan her çeviri anahtarı sözlükte var", () => {
    const dir = "public/yonetim";
    const files = [
      join(dir, "index.html"),
      ...readdirSync(join(dir, "js")).filter((f) => f.endsWith(".js")).map((f) => join(dir, "js", f)),
      ...readdirSync(join(dir, "js/views")).map((f) => join(dir, "js/views", f)),
    ];
    const used = new Set();
    const pattern = /\bt\("([\w.-]+)"|data-i18n(?:-html)?="([\w.-]+)"|label: "(texts\.f\.\w+)"/g;
    files.forEach((f) => {
      const text = readFileSync(f, "utf8");
      for (const m of text.matchAll(pattern)) used.add(m[1] || m[2] || m[3]);
      // data-i18n-attr="aria-label:anahtar" yalnızca HTML işaretlemesinde
      if (f.endsWith(".html")) for (const m of text.matchAll(/data-i18n-attr="[\w-]+:([\w.-]+)"/g)) used.add(m[1]);
    });
    assert.ok(used.size > 150);
    assert.deepEqual([...used].filter((k) => !Object.hasOwn(panelTr, k)), []);
  });

  test("şablondaki her {{t:…}} anahtarı site sözlüğünde var", () => {
    const html = readFileSync("public/index.html", "utf8");
    const keys = [...html.matchAll(/\{\{\{?t:([\w.]+)\}?\}\}/g)].map((m) => m[1]);
    assert.ok(keys.length > 100);
    assert.deepEqual(keys.filter((k) => !Object.hasOwn(siteTr, k)), []);
  });
});

describe("canlı yazı çevirici", () => {
  test("dakika kısaltmaları", () => {
    assert.equal(clockEn("34'"), "34'");
    assert.equal(clockEn("90+3'"), "90+3'");
    assert.equal(clockEn("Ç2"), "Q2");
    assert.equal(clockEn("S4"), "S4");
    assert.equal(clockEn("MS"), "FT");
    assert.equal(clockEn("İY"), "HT");
    assert.equal(clockEn("UZ"), "ET");
    assert.equal(clockEn(""), "");
    assert.equal(clockEn("garip"), "garip");
  });
  test("uzun durum yazısı", () => {
    assert.equal(periodEn({ status: "live", clock: "34'" }), "34th minute");
    assert.equal(periodEn({ status: "live", clock: "1'" }), "1st minute");
    assert.equal(periodEn({ status: "live", clock: "12'" }), "12th minute");
    assert.equal(periodEn({ status: "live", clock: "22'" }), "22nd minute");
    assert.equal(periodEn({ status: "live", clock: "90+3'" }), "90th minute, +3 stoppage");
    assert.equal(periodEn({ status: "live", clock: "Ç2" }), "2nd quarter");
    assert.equal(periodEn({ status: "live", clock: "S3" }), "3rd set");
    assert.equal(periodEn({ status: "live", clock: "İY" }), "Half-time");
    assert.equal(periodEn({ status: "live", clock: "" }), "Live");
    assert.equal(periodEn({ status: "upcoming", time: "20:00" }), "Today 20:00");
    assert.equal(periodEn({ status: "upcoming", time: "01:15" }), "Tonight 01:15");
    assert.equal(periodEn({ status: "finished", clock: "MS" }), "Full time");
  });
});

describe("göç: eski veritabanı İngilizceye geçer", () => {
  test("yalnızca Türkçesi değişmemiş alanların İngilizcesi yazılır; bir kez çalışır", () => {
    const db = openDb(":memory:");
    seedIfEmpty(db); // göç öncesi hâl: yalnızca Türkçe
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 0);
    setContent(db, "quotes", ["Yöneticinin kendi repliği."]);
    db.prepare("UPDATE channels SET now = 'Değiştirildi' WHERE id = 'ch-1'").run();
    db.prepare("UPDATE matches SET league = 'Başka Lig' WHERE id = 'mci-liv'").run();

    assert.equal(migrateData(db), 2);
    assert.equal(db.prepare("PRAGMA user_version").get().user_version, 2);
    assert.deepEqual(getContent(db, "quotes:en"), [], "değiştirilmiş Türkçeye eski çeviri basılmaz");
    assert.equal(getContent(db, "subtitles:en")[0].b, "— The winner. The loser wins experience.");
    const ch1 = db.prepare("SELECT genre_en, now_en FROM channels WHERE id = 'ch-1'").get();
    assert.equal(ch1.genre_en, "Football");
    assert.equal(ch1.now_en, "");
    assert.equal(db.prepare("SELECT league_en FROM matches WHERE id = 'mci-liv'").get().league_en, "");
    assert.equal(db.prepare("SELECT league_en FROM matches WHERE id = 'cle-orl'").get().league_en, "NBA Preseason");
    assert.equal(getSetting(db, "site:en").tagline, "Like everybody won.");

    setContent(db, "quotes:en", ["Kept"]);
    assert.equal(migrateData(db), 0, "ikinci açılışta göç tekrar çalışmaz");
    assert.deepEqual(getContent(db, "quotes:en"), ["Kept"]);
    db.close();
  });
});

describe("İngilizce site", () => {
  let t;
  let call;
  before(async () => {
    t = await startTestServer();
    const session = await t.login();
    call = t.admin(session);
  });
  after(async () => { await t.close(); });

  test("/en/ İngilizce, hreflang ve dil anahtarı doğru; /en → /en/", async () => {
    const res = await t.request("/en/");
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(!/\{\{/.test(html));
    assert.match(html, /<html lang="en">/);
    assert.match(html, /<title>İlkkan Sports — Like everybody won\.<\/title>/);
    assert.match(html, /Live\. <em>Calmly<\/em> live\./);
    assert.match(html, /<link rel="alternate" hreflang="tr" href="http:\/\/ilkkan\.test\/" \/>/);
    assert.match(html, /<link rel="alternate" hreflang="en" href="http:\/\/ilkkan\.test\/en\/" \/>/);
    assert.match(html, /class="lang-switch" href="\/" hreflang="tr"/);
    assert.match(html, /<script src="\/data\.js\?lang=en"><\/script>/);
    assert.match(html, /href="\/en\/privacy"/);
    assert.match(html, /og-en\.jpg/);
    const tr = await (await t.request("/")).text();
    assert.match(tr, /<html lang="tr">/);
    assert.match(tr, /class="lang-switch" href="\/en\/" hreflang="en"/);
    assert.equal((await t.request("/en")).headers.get("location"), "/en/");
  });

  test("/data.js?lang=en aynı şekil, İngilizce içerik; boş İngilizce → Türkçe", async () => {
    const tr = await readSiteData(t.request);
    const en = await readSiteData((p) => t.request(p === "/data.js" ? "/data.js?lang=en" : p));
    assert.deepEqual(Object.keys(en).sort(), Object.keys(tr).sort());
    assert.equal(en.lang, "en");
    assert.equal(en.categories[1].label, "Football");
    assert.equal(en.quotes[0], "Drop by drop, a lake forms. Pass by pass, a goal.");
    assert.equal(en.matches.find((m) => m.id === "bjk-ts").period, "34th minute");
    assert.equal(en.matches.find((m) => m.id === "efes-fbb").clock, "Q2");
    assert.equal(en.matches.find((m) => m.id === "mci-liv").league, "Premier League");
    assert.equal(en.ads.creatives["kola-cay"].brand, "Cola Tea");
    assert.equal(en.ads.creatives["kola-cay"].icon, "i-tea", "kreatifin görsel alanları korunur");
    assert.ok(!("genreEn" in en.channels[0]), "panel alanları siteye sızmaz");

    assert.equal((await call("/api/admin/content/quotes/en", { method: "PUT", body: { items: [] } })).status, 200);
    const fallback = await readSiteData((p) => t.request(p === "/data.js" ? "/data.js?lang=en" : p));
    assert.deepEqual(fallback.quotes, tr.quotes);
  });

  test("/api/live?lang=en dakikayı çevirir", async () => {
    const body = await (await t.request("/api/live?lang=en")).json();
    const efes = body.data.matches.find((m) => m.id === "efes-fbb");
    assert.equal(efes.clock, "Q2");
    assert.equal(efes.period, "2nd quarter");
  });

  test("İngilizce maç, yasal ve 404 sayfaları", async () => {
    const match = await t.request("/en/match/bjk-ts");
    assert.equal(match.status, 200);
    const html = await match.text();
    assert.match(html, /<html lang="en">/);
    assert.match(html, /Watch live/);
    assert.match(html, /href="\/en\/\?mac=bjk-ts#canli"/);
    assert.match(html, /"inLanguage":"en-GB"/);
    assert.match(html, /hreflang="tr" href="http:\/\/ilkkan\.test\/mac\/bjk-ts"/);
    for (const path of ["/en/privacy", "/en/cookies", "/en/terms"]) {
      const res = await t.request(path);
      assert.equal(res.status, 200, path);
      assert.match(await res.text(), /This text is a <b>template<\/b>/);
    }
    const lost = await t.request("/en/nope");
    assert.equal(lost.status, 404);
    assert.match(await lost.text(), /Nothing\. <em>That's fine\.<\/em>/);
  });

  test("sitemap her sayfanın iki dilini alternatifleriyle listeler", async () => {
    const xml = await (await t.request("/sitemap.xml")).text();
    assert.match(xml, /xmlns:xhtml="http:\/\/www\.w3\.org\/1999\/xhtml"/);
    assert.match(xml, /<loc>http:\/\/ilkkan\.test\/en\/match\/bjk-ts<\/loc>/);
    assert.match(xml, /hreflang="en" href="http:\/\/ilkkan\.test\/en\/privacy"/);
    assert.match(xml, /hreflang="x-default" href="http:\/\/ilkkan\.test\/"/);
  });

  test("İngilizce sayfa görüntülemeleri sayılır", async () => {
    const beacon = (k) => t.request("/api/t", { method: "POST", body: JSON.stringify({ e: "view", k }), raw: true, headers: { "User-Agent": `UA-${k}` } });
    await beacon("/en/");
    await beacon("/en/match/bjk-ts");
    await beacon("/en/match/yok");
    const keys = t.db.prepare("SELECT key FROM stats_daily WHERE event = 'view'").all().map((r) => r.key).sort();
    assert.deepEqual(keys, ["/en/", "/en/match/bjk-ts"]);
  });

  test("yönetim: İngilizce ayar katmanı, kanal ve reklam alanları", async () => {
    const all = await (await call("/api/admin/settings")).json();
    assert.equal(all.data.en.site.tagline, "Like everybody won.");
    const site = { ...all.data.site, en: { tagline: "Front row. Sort of.", description: "", contactNote: "" } };
    assert.equal((await call("/api/admin/settings/site", { method: "PUT", body: site })).status, 200);
    assert.match(await (await t.request("/en/")).text(), /<title>İlkkan Sports — Front row\. Sort of\.<\/title>/);
    assert.match(await (await t.request("/")).text(), /<title>İlkkan Sports — Herkes kazanmış gibi\.<\/title>/, "Türkçe etkilenmez");
    const enDesc = await readSiteData((p) => t.request(p === "/data.js" ? "/data.js?lang=en" : p));
    assert.equal(enDesc.site.description, all.data.site.description, "boş İngilizce açıklama → Türkçesi");

    const ads = { rentHref: "#iletisim", clickNote: "Not", en: { clickNote: "Note" } };
    assert.equal((await call("/api/admin/settings/ads", { method: "PUT", body: ads })).status, 200);
    assert.ok(getSetting(t.db, "ads:en").creatives["kola-cay"], "İngilizce kreatifler korunur");

    const ch = (await (await call("/api/admin/channels")).json()).data.find((c) => c.id === "ch-6");
    assert.equal(ch.genreEn, "Studio");
    const update = await call("/api/admin/channels/ch-6", { method: "PUT", body: { ...ch, nowEn: "İlkkan explains offside" } });
    assert.equal(update.status, 200);
    const en = await readSiteData((p) => t.request(p === "/data.js" ? "/data.js?lang=en" : p));
    assert.equal(en.channels.find((c) => c.id === "ch-6").now, "İlkkan explains offside");

    await call("/api/admin/ads/01", { method: "PUT", body: { mode: "image", imageUrl: "/uploads/a.png", alt: "Türkçe", altEn: "English alt" } });
    const units = (await readSiteData((p) => t.request(p === "/data.js" ? "/data.js?lang=en" : p))).ads.units;
    assert.equal(units["01"].alt, "English alt");
  });

  test("yönetim mesajları panel dilinde (X-Lang: en)", async () => {
    const res = await call("/api/admin/matches", { method: "POST", body: {
      id: "x-1", cat: "futbol", league: "L", home: "A", away: "B", homeShort: "A", awayShort: "B", time: "25:00", status: "upcoming",
    }, headers: { "X-Lang": "en" } });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error, "Time: must be HH:MM (e.g. 20:00)");
    const missing = await call("/api/admin/matches/yok", { method: "DELETE", headers: { "X-Lang": "en" } });
    assert.equal((await missing.json()).error, "Match not found.");
    const tooLong = await call("/api/admin/content/quotes/en", { method: "PUT", body: { items: ["x".repeat(121)] }, headers: { "X-Lang": "en" } });
    assert.equal((await tooLong.json()).error, "row 1: can be at most 120 characters");
    const anon = await t.request("/api/admin/matches", { headers: { "X-Lang": "en" } });
    assert.match((await anon.json()).error, /No session/);
  });
});
