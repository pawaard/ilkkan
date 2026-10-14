/* ======================================================
   İLKKAN SPORTS — Giriş noktası
   Veri: /data.js (sunucu, window.ILKKAN_DATA) · canlı: /api/live
   ====================================================== */
import { track } from "./core.js";
import { DATA } from "./state.js";

async function boot() {
  const [ticker, fixtures, player, hero, page, live, ads, consent] = await Promise.all([
    import("./ticker.js"), import("./fixtures.js"), import("./player.js"), import("./hero.js"),
    import("./page.js"), import("./live.js"), import("./ads.js"), import("./consent.js"),
  ]);

  hero.bindHeadlineFit();
  page.fillStatic();
  ticker.renderTicker();
  ticker.renderTape();
  ticker.renderCommentary();
  fixtures.renderTabs();
  fixtures.renderTickets();
  fixtures.renderChannels();
  player.renderInitialPlayer();

  fixtures.bindFixtures({
    onPick: (id) => {
      player.select(id);
      if (window.matchMedia("(max-width: 960px)").matches) player.scrollToPlayer();
    },
    onWatch: (id) => player.watch(id),
  });
  player.bindPlayer();
  page.bindRemind();
  hero.bindCard();
  hero.bindReveal();
  page.bindNav();
  ticker.bindMotionToggle();
  page.bindRewind();
  page.runClocks();
  hero.runSubtitles();
  hero.runTimecode();

  consent.initConsent({ needed: ads.needsConsent() });
  ads.initAds();

  // Canlı skorlar: yalnızca değişen biletler/kartlar yeniden çizilir
  live.startLive((changed) => {
    fixtures.patchItems(changed);
    ticker.renderTicker();
    page.refreshCounts();
    player.refreshPlayer(changed);
  });

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ticker.retuneMarquees);

  // /?mac=… ile gelindiyse oynatıcıya kaydır
  if (new URLSearchParams(window.location.search).has("mac")) player.scrollToPlayer();
  track("view", window.location.pathname);
}

if (!DATA) {
  // Veri yüklenemediyse gizli bekleyen öğeleri görünür bırak
  document.documentElement.classList.remove("js");
} else {
  boot().catch((error) => {
    console.error("İlkkan Sports başlatılamadı:", error);
    document.documentElement.classList.remove("js");
  });
}
