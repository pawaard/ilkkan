// Uçtan uca: site açılır → panele girilir → skor değişir → site kendiliğinden güncellenir; reklam modları
import { expect, test } from "@playwright/test";

const USER = process.env.E2E_ADMIN_USER;
const PASS = process.env.E2E_ADMIN_PASSWORD;
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

test.describe.configure({ mode: "serial" });

const watchConsole = (page) => {
  const errors = [];
  page.on("console", (msg) => { if (msg.type() === "error") errors.push(msg.text()); });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
};

async function login(page) {
  await page.goto("/yonetim/");
  await page.getByLabel("Kullanıcı adı").fill(USER);
  await page.getByLabel("Şifre").fill(PASS);
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.locator(".view__title")).toContainText("Bugün");
}

test("site açılır: konsol temiz, 16 reklam alanı dolu, canlı sayı görünür", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await expect(page.locator(".ticket").first()).toBeVisible();
  await expect(page.locator(".ad__frame[data-ad-no]:not([data-ad-no=\"mac-arasi\"]) .adc")).toHaveCount(16);
  await expect(page.locator(".tickets__ad .adc").first()).toBeVisible();
  await expect(page.locator("[data-live-count]").first()).toHaveText("6");
  await expect(page.locator(".consent")).toHaveCount(0); // reklam kodu yokken çerez bandı çıkmaz
  expect(errors).toEqual([]);
});

test("hatalı şifre uyarı verir, panel açılmaz", async ({ page }) => {
  await page.goto("/yonetim/");
  await page.getByLabel("Kullanıcı adı").fill(USER);
  await page.getByLabel("Şifre").fill("kesinlikle-yanlis");
  await page.getByRole("button", { name: "Giriş yap" }).click();
  await expect(page.locator("#loginError")).toContainText("yanlış");
  await expect(page.locator("#app")).toBeHidden();
});

test("canlı kumanda: panelden gol → açık sitede 30 sn içinde 2–0", async ({ page, context }) => {
  const site = await context.newPage();
  await site.goto("/");
  const bjkTicket = site.locator('.ticket[data-id="bjk-ts"]');
  await expect(bjkTicket).toContainText("Beşiktaş");

  await login(page);
  await page.goto("/yonetim/#maclar");
  const row = page.locator('.row[data-id="bjk-ts"]');
  await row.getByRole("button", { name: "Kumanda" }).click();
  await row.getByRole("button", { name: "Beşiktaş için gol ekle" }).click();
  await expect(row.locator(".stepper__value").first()).toHaveText("2");
  await expect(page.locator("#toast")).toContainText("Gol!");

  // Site sayfası yenilenmeden güncellenmeli (30 sn'lik canlı yenileme)
  await expect(bjkTicket.locator(".ticket__team").first()).toContainText("2", { timeout: 45_000 });
  await expect(site.locator("#ticker")).toContainText("2–0");
  await expect(site.locator('.ticket[data-id="bjk-ts"]')).toHaveAttribute("aria-label", /Beşiktaş 2, Trabzonspor 0/);
});

test("reklam alanları: görsel, kapalı ve çerez onaylı kod", async ({ page, context }) => {
  await login(page);
  await page.goto("/yonetim/#reklam");

  const alan01 = page.locator('.unit[data-id="01"]');
  await alan01.locator(".seg-radio", { hasText: "Görsel" }).click();
  await alan01.locator('input[type="file"]').setInputFiles({ name: "reklam.png", mimeType: "image/png", buffer: PNG });
  await expect(alan01.locator('input[name="imageUrl"]')).toHaveValue(/^\/uploads\/.+\.png$/);
  await alan01.locator('input[name="linkUrl"]').fill("https://sponsor.example/");
  await alan01.locator('input[name="alt"]').fill("E2E sponsor");
  await alan01.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.locator("#toast")).toContainText("kaydedildi");

  const alan02 = page.locator('.unit[data-id="02"]');
  await alan02.locator(".seg-radio", { hasText: "Kapalı" }).click();
  await alan02.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.locator("#toast")).toContainText("kaydedildi");

  const alan03 = page.locator('.unit[data-id="03"]');
  await alan03.locator(".seg-radio", { hasText: "Reklam kodu" }).click();
  await alan03.locator('textarea[name="code"]').fill('<div class="e2e-ad">E2E reklam</div><script>document.querySelector(".e2e-ad").dataset.ran = "1"</script>');
  await alan03.getByRole("button", { name: "Kaydet" }).click();
  await expect(page.locator("#toast")).toContainText("kaydedildi");

  const site = await context.newPage();
  const errors = watchConsole(site);
  await site.goto("/");
  await expect(site.locator('[data-ad-no="01"] .adc--image img')).toHaveAttribute("alt", "E2E sponsor");
  await expect(site.locator('[data-ad-no="01"] a')).toHaveAttribute("href", "https://sponsor.example/");
  await expect(site.locator('[data-ad-no="02"]').locator("xpath=..")).toBeHidden();
  await expect(site.locator(".consent")).toBeVisible();
  await expect(site.locator(".e2e-ad")).toHaveCount(0); // onaysız reklam kodu yüklenmez
  await expect(site.locator('[data-ad-no="03"] .adc--rent')).toBeVisible();
  await site.getByRole("button", { name: "İzin ver" }).click();
  await expect(site.locator(".e2e-ad")).toHaveText("E2E reklam");
  await expect(site.locator(".e2e-ad")).toHaveAttribute("data-ran", "1");
  expect(errors).toEqual([]);
});

test("çerezi reddetmek sayfayı yenilemez, reklam kodu yüklenmez", async ({ page }) => {
  await page.goto("/");
  let navigations = 0;
  page.on("framenavigated", (frame) => { if (frame === page.mainFrame()) navigations += 1; });
  await page.getByRole("button", { name: "Hayır, kalsın" }).click();
  await expect(page.locator(".consent")).toHaveCount(0);
  await page.waitForTimeout(500);
  expect(navigations).toBe(0);
  await expect(page.locator(".e2e-ad")).toHaveCount(0);
  await expect(page.locator('[data-ad-no="03"] .adc--rent')).toBeVisible();
});

test("maç sayfası, yasal sayfa ve 404 temalı açılır", async ({ page }) => {
  await page.goto("/mac/bjk-ts");
  await expect(page.locator("h1.match__teams")).toContainText("Beşiktaş");
  await page.getByRole("link", { name: /Canlı izle/ }).click();
  await expect(page).toHaveURL(/\?mac=bjk-ts#canli/);
  await expect(page.locator("#nowTitle")).toHaveText("Beşiktaş – Trabzonspor");
  await page.goto("/kvkk");
  await expect(page.locator("h1")).toContainText("KVKK");
  const res = await page.goto("/olmayan-sayfa");
  expect(res.status()).toBe(404);
  await expect(page.locator("h1")).toContainText("Yok.");
});

test("site dil anahtarı aynı sayfanın İngilizcesine gider", async ({ page }) => {
  const errors = watchConsole(page);
  await page.goto("/");
  await page.locator(".masthead .lang-switch").click();
  await expect(page).toHaveURL(/\/en\/$/);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("#canli-title")).toContainText("Calmly");
  await expect(page.locator(".tab").first()).toContainText("All");
  await expect(page.locator('.ticket[data-id="efes-fbb"] .ticket__time')).toHaveText("Q2");
  await expect(page.locator("#nowChipText")).toHaveText("Live");
  await page.goto("/mac/bjk-ts");
  await page.locator(".lang-switch").click();
  await expect(page).toHaveURL(/\/en\/match\/bjk-ts$/);
  await expect(page.getByRole("link", { name: /Watch live/ })).toBeVisible();
  expect(errors).toEqual([]);
});

test("panel İngilizce: menü çevrilir, İngilizce replik yalnızca /en/ sitesinde görünür", async ({ page, context }) => {
  await login(page);
  await page.locator('.topbar [data-lang="en"]').click();
  await expect(page.locator('.side__link[data-view="maclar"]')).toContainText("Matches");
  await expect(page.locator(".view__title")).toContainText("What");
  await page.goto("/yonetim/#metinler");
  await page.locator('[data-content-lang="en"]').click();
  await page.locator('[data-kind="quotes"]').click();
  await page.locator("#lines input").first().fill("E2E English quote.");
  await page.locator("#saveLines").click();
  await expect(page.locator("#toast")).toContainText("saved");

  const site = await context.newPage();
  await site.goto("/en/");
  await expect(site.locator("#tape")).toContainText("E2E English quote.");
  await site.goto("/");
  await expect(site.locator("#tape")).not.toContainText("E2E English quote.");
  await expect(site.locator("#tape")).toContainText("Damlaya damlaya");
});

test("panel ekranları iki dilde (taşma yok + görsel kontrol için ekran görüntüsü)", async ({ page }, info) => {
  const errors = watchConsole(page);
  await login(page);
  for (const lang of ["tr", "en"]) {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.locator(`.topbar [data-lang="${lang}"]`).click();
    for (const [width, height] of [[1440, 900], [390, 844]]) {
      await page.setViewportSize({ width, height });
      for (const view of ["ozet", "maclar", "kanallar", "reklam", "metinler", "ayarlar", "hesap"]) {
        await page.goto(`/yonetim/#${view}`);
        await expect(page.locator(".view__head")).toBeVisible();
        await expect(page.locator("html")).toHaveAttribute("lang", lang);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        // Taşma varsa hangi öğelerin dışarı çıktığını hata mesajına yaz
        // (kendi içinde kayan kapların — ör. mobil menü şeridi — çocukları sayılmaz)
        const offenders = overflow > 0 ? await page.evaluate(() => [...document.querySelectorAll("body *")]
          .filter((n) => n.getBoundingClientRect().right > window.innerWidth + 1)
          .filter((n) => !n.parentElement.closest(".side, .tab-row, .table, .audit"))
          .slice(0, 6).map((n) => `${n.tagName.toLowerCase()}.${[...n.classList].join(".")} ${Math.round(n.getBoundingClientRect().right)}px "${(n.textContent || "").trim().slice(0, 24)}"`)) : [];
        expect(overflow, `${view} @${width}px (${lang}) yatay taşma: ${offenders.join(" | ")}`).toBeLessThanOrEqual(0);
        await page.screenshot({ path: info.outputPath(`panel-${lang}-${view}-${width}.png`), fullPage: false });
      }
    }
  }
  expect(errors).toEqual([]);
});
