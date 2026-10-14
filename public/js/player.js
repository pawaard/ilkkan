/* ======================================================
   İLKKAN SPORTS — Oynatıcı
   Afiş → film geri sayımı (3-2-1) → canlı.
   Yayın adresi varsa gerçek görüntü (stream.js), yoksa saha görünümü.
   ====================================================== */
import { $, $$, prose, reduceMotion, scrollMode, toast, track } from "./core.js";
import { t } from "./i18n.js";
import { byId, DATA, getUi, isChannel, liveMatches, scoreText, setUi, streamsOf } from "./state.js";
import { markSelected } from "./fixtures.js";
import { mountStream, setQuality, unmountStream } from "./stream.js";

const el = {
  player: $("#player"), screen: $("#screen"), idle: $(".idle"), status: $("#playerStatus"),
  idleHeadline: $("#idleHeadline"), playBtnLabel: $("#playBtnLabel"),
  idleLeague: $("#idleLeague"), idleHome: $("#idleHome"), idleAway: $("#idleAway"),
  idleHint: $("#idleHint"), playBtn: $("#playBtn"), leaderNum: $("#leaderNum"),
  sbHome: $("#sbHome"), sbScore: $("#sbScore"), sbAway: $("#sbAway"), sbClock: $("#sbClock"),
  ltText: $("#ltText"), nowChip: $("#nowChip"), nowChipText: $("#nowChipText"),
  nowTitle: $("#nowTitle"), nowMeta: $("#nowMeta"), fsBtn: $("#fsBtn"),
  sourceBtns: $$('[data-seg="source"] .seg__btn'),
};

let countdownTimer = 0;
let commentTimer = 0;
let commentsOn = false;
let switchTimer = 0;
let mountedUrl = "";

const isLive = () => el.screen.dataset.state === "live";

function describe(item) {
  if (isChannel(item)) {
    return {
      playable: true, status: "live", chip: t("player.live"), single: true,
      title: item.name, league: t("player.channelLeague", { genre: item.genre }), home: item.name, away: "",
      meta: t("player.now", { text: item.now }), hint: t("player.channelHint"),
      match: item.matchId ? byId(item.matchId) : null,
    };
  }
  const base = { title: `${item.home} – ${item.away}`, league: item.league, home: item.home, away: item.away, single: false, match: item };
  if (item.status === "live") {
    return { ...base, playable: true, status: "live", chip: t("player.live"), meta: `${item.league} · ${item.period}`, hint: t("player.liveHint") };
  }
  if (item.status === "upcoming") {
    return { ...base, playable: false, status: "upcoming", chip: t("player.soon"), meta: `${item.league} · ${item.period}`, hint: t("player.soonHint", { time: prose(item.time) }) };
  }
  return {
    ...base, playable: false, status: "finished", chip: t("player.finished"),
    meta: t("player.finishedMeta", { league: item.league, score: scoreText(item) }),
    hint: t("player.finishedHint", { score: scoreText(item) }),
  };
}

// Bekleme afişinin başlığı ve buton yazısı maçın durumuna göre
const POSTER = Object.freeze({
  live: { headline: t("poster.live"), cta: t("poster.liveCta") },
  upcoming: { headline: t("poster.soon"), cta: t("poster.soonCta") },
  finished: { headline: t("poster.finished"), cta: t("poster.finishedCta") },
});

function paintScorebug(match) {
  const hasScore = Boolean(match && match.score);
  el.screen.classList.toggle("no-score", !hasScore);
  if (!hasScore) return;
  el.sbHome.textContent = match.homeShort;
  el.sbAway.textContent = match.awayShort;
  el.sbScore.textContent = scoreText(match);
  el.sbClock.textContent = match.clock;
}

function paintInfo(item) {
  const info = describe(item);
  el.idle.classList.toggle("is-single", info.single);
  el.idleLeague.textContent = info.league;
  el.idleHome.textContent = info.home;
  el.idleAway.textContent = info.away;
  el.idleHint.textContent = info.hint;
  const poster = POSTER[info.status] || POSTER.live;
  el.idleHeadline.textContent = poster.headline;
  el.playBtnLabel.textContent = poster.cta;
  el.playBtn.disabled = !info.playable;
  el.playBtn.setAttribute("aria-label", t(info.playable ? "player.start" : "player.unavailable", { title: info.title }));
  el.nowChip.dataset.status = info.status;
  el.nowChipText.textContent = info.chip;
  el.nowTitle.textContent = info.title;
  el.nowMeta.textContent = info.meta;
  paintScorebug(info.match);
  return info;
}

// Kaynak düğmeleri: yayın adresi kadar kaynak açık (adres yoksa ikisi de görünüm amaçlı çalışır)
function syncSources(item) {
  const count = streamsOf(item).length;
  const source = count > 0 && getUi().source >= count ? 0 : getUi().source;
  setUi({ source });
  el.sourceBtns.forEach((btn, i) => {
    btn.disabled = count > 0 && i >= count;
    btn.setAttribute("aria-pressed", String(i === source));
  });
}

/* ---------- Yayın akışı ---------- */
const STATE_ANNOUNCE = Object.freeze({
  idle: () => "",
  countdown: () => t("player.countdown"),
  live: () => t("player.started", { title: el.nowTitle.textContent }),
});
const setScreen = (mode) => {
  el.screen.dataset.state = mode;
  el.status.textContent = STATE_ANNOUNCE[mode]();
};

function stopComments() {
  clearInterval(commentTimer);
  commentTimer = 0;
  commentsOn = false;
}

function rotateComments() {
  const lines = DATA.liveComments;
  let i = 0;
  stopComments();
  commentsOn = true;
  el.ltText.textContent = lines[0] || "";
  if (lines.length < 2) return;
  commentTimer = setInterval(() => {
    i = (i + 1) % lines.length;
    el.ltText.classList.add("is-swapping");
    setTimeout(() => {
      el.ltText.textContent = lines[i];
      el.ltText.classList.remove("is-swapping");
    }, 350);
  }, 6000);
}

function detachMedia() {
  unmountStream();
  mountedUrl = "";
  el.screen.classList.remove("has-media");
}

// Açılamayan adres: canlı yenileme her 30 sn'de aynı ölü yayını tekrar denemesin (kullanıcı kaynak/kanal seçince sıfırlanır)
let failedUrl = "";

// Gerçek yayın varsa bağla, yoksa İlkkan'ın saha görünümü
function attachMedia() {
  const streams = streamsOf(byId(getUi().selectedId));
  const wanted = streams[getUi().source] || streams[0] || "";
  if (wanted && wanted === mountedUrl) return;
  const url = wanted === failedUrl ? "" : wanted;
  if (!url) {
    // Saha görünümü zaten dönüyorsa her canlı yenilemede baştan başlatma
    if (mountedUrl || !commentsOn) {
      detachMedia();
      rotateComments();
    }
    return;
  }
  stopComments();
  mountedUrl = url;
  el.screen.classList.add("has-media");
  mountStream(el.screen, url, {
    onNotice: toast,
    onError: (message) => {
      failedUrl = url;
      detachMedia();
      rotateComments();
      toast(`${message} ${t(streams.length > 1 ? "player.trySource2" : "player.fallback")}`);
    },
  });
}

const retryStreams = () => { failedUrl = ""; };

function goLive() {
  setScreen("live");
  attachMedia();
  track("play", getUi().selectedId);
}

function runCountdown(n) {
  if (n === 0) {
    goLive();
    return;
  }
  el.leaderNum.textContent = String(n);
  countdownTimer = setTimeout(() => runCountdown(n - 1), 800);
}

function startPlayback() {
  if (!describe(byId(getUi().selectedId)).playable) {
    toast(t("player.notYet"));
    return;
  }
  clearTimeout(countdownTimer);
  if (reduceMotion) {
    goLive();
    return;
  }
  setScreen("countdown");
  runCountdown(3);
}

function stopPlayback() {
  clearTimeout(countdownTimer);
  stopComments();
  detachMedia();
  setScreen("idle");
}

// Kanal değiştirirken kısa parazit
function switchEffect() {
  if (reduceMotion) return;
  el.screen.classList.remove("is-switching");
  void el.screen.offsetWidth; // animasyonu yeniden başlatmak için reflow
  el.screen.classList.add("is-switching");
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => el.screen.classList.remove("is-switching"), 380);
}

function loadIntoPlayer(item) {
  const info = paintInfo(item);
  syncSources(item);
  if (!info.playable) {
    stopPlayback();
    return;
  }
  if (isLive()) {
    switchEffect();
    attachMedia();
    el.status.textContent = t("player.switched", { title: info.title });
  }
}

export function select(id) {
  const item = byId(id);
  if (!item) return;
  setUi({ selectedId: id, source: 0 });
  retryStreams(); // izleyici yeniden seçti: önceden açılamayan yayına bir şans daha
  markSelected(id);
  loadIntoPlayer(item);
}

export const scrollToPlayer = () => el.player.scrollIntoView({ behavior: scrollMode, block: "center" });

export function watch(id) {
  if (id) select(id);
  const first = liveMatches()[0];
  if (!describe(byId(getUi().selectedId)).playable && first) select(first.id);
  scrollToPlayer();
  // Zaten canlıysa kanal değişimi yeterli; geri sayımı baştan başlatma
  if (!isLive()) setTimeout(startPlayback, reduceMotion ? 0 : 650);
}

/** Canlı veri geldiğinde: seçili maç/kanal değiştiyse oynatıcı bilgisini tazele (yayını kesmeden) */
export function refreshPlayer(changedIds) {
  const item = byId(getUi().selectedId);
  if (!item) return;
  const related = changedIds.includes(item.id) || (isChannel(item) && changedIds.includes(item.matchId));
  if (!related) return;
  const info = paintInfo(item);
  syncSources(item);
  if (!info.playable && el.screen.dataset.state !== "idle") stopPlayback();
  else if (isLive()) attachMedia();
}

export const renderInitialPlayer = () => {
  const item = byId(getUi().selectedId);
  if (item) paintInfo(item);
  if (item) syncSources(item);
};

function toggleFullscreen() {
  if (document.fullscreenElement) {
    document.exitFullscreen().catch(() => toast(t("player.fsExitFail")));
    return;
  }
  if (!el.player.requestFullscreen) {
    toast(t("player.fsUnsupported"));
    return;
  }
  el.player.requestFullscreen().catch(() => toast(t("player.fsFail")));
}

function onSegment(group, btn) {
  if (btn.disabled) return;
  $$(".seg__btn", group).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
  if (group.dataset.seg === "source") {
    setUi({ source: Number(btn.dataset.value) || 0 });
    retryStreams();
    if (isLive()) {
      switchEffect();
      attachMedia();
    }
    return;
  }
  if (!setQuality(btn.dataset.value) && isLive()) switchEffect();
}

export function bindPlayer() {
  el.playBtn.addEventListener("click", startPlayback);
  $$(".seg").forEach((group) =>
    group.addEventListener("click", (e) => {
      const btn = e.target.closest(".seg__btn");
      if (btn) onSegment(group, btn);
    }));
  el.fsBtn.addEventListener("click", toggleFullscreen);
  document.addEventListener("fullscreenchange", () => {
    el.fsBtn.setAttribute("aria-label", t(document.fullscreenElement ? "player.fsExit" : "player.fsEnter"));
  });
  $$('[data-action="watch"]').forEach((link) =>
    link.addEventListener("click", (e) => {
      e.preventDefault();
      watch();
    }));
}
