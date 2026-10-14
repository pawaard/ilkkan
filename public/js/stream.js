/* ======================================================
   İLKKAN SPORTS — Gerçek yayın katmanı
   .m3u8 → <video> + hls.js (gerekirse, sabit sürüm + SRI)
   .mp4/.webm → <video>
   diğer adresler → kısıtlanmış (sandbox) <iframe>
   ====================================================== */

import { t } from "./i18n.js";

const HLS_SRC = "https://cdnjs.cloudflare.com/ajax/libs/hls.js/1.5.20/hls.min.js";
const HLS_SRI = "sha512-yQzohCknrQkYGB82MKUj2tk/XxXIH8jthzZpy89adgms47b9ydFW6UK2f3eEXIZm0pe3lbhrWfxZOHuIGHSJ0w==";

let hlsLoading = null;
let current = null; // { node, video, hls }

function loadHls() {
  if (window.Hls) return Promise.resolve(window.Hls);
  if (!hlsLoading) {
    hlsLoading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = HLS_SRC;
      script.integrity = HLS_SRI;
      script.crossOrigin = "anonymous";
      script.referrerPolicy = "no-referrer";
      script.onload = () => resolve(window.Hls);
      script.onerror = () => {
        hlsLoading = null;
        reject(new Error("hls.js yüklenemedi"));
      };
      document.head.append(script);
    });
  }
  return hlsLoading;
}

export const kindOf = (url) => {
  if (/\.m3u8(\?|#|$)/i.test(url)) return "hls";
  if (/\.(mp4|webm|ogv)(\?|#|$)/i.test(url)) return "file";
  return "embed";
};

function makeIframe(url) {
  const frame = document.createElement("iframe");
  frame.src = url;
  frame.title = t("stream.title");
  frame.allow = "autoplay; fullscreen; encrypted-media; picture-in-picture";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "no-referrer";
  // Açılır pencere ve sayfayı yönlendirme kapalı: yayın sağlayıcısı siteyi ele geçiremez.
  // Adres bizim sitemizse allow-same-origin verilmez (aynı kökende sandbox'tan kaçılabilirdi).
  const sameOrigin = new URL(url, window.location.href).origin === window.location.origin;
  frame.setAttribute("sandbox", sameOrigin ? "allow-scripts allow-presentation" : "allow-scripts allow-same-origin allow-presentation");
  return frame;
}

function makeVideo() {
  const video = document.createElement("video");
  video.controls = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("aria-label", t("stream.title"));
  return video;
}

const blockedByBrowser = (error) => Boolean(error && error.name === "NotAllowedError");

// Tarayıcı sesli başlatmayı engellerse sessiz başlat. Kanal bu arada değiştiyse (AbortError) hiçbir şey söyleme.
async function autoplay(video, onNotice, isCurrent) {
  try {
    await video.play();
  } catch (error) {
    if (!isCurrent() || !blockedByBrowser(error)) return;
    video.muted = true;
    try {
      await video.play();
      if (isCurrent()) onNotice(t("stream.muted"));
    } catch (retryError) {
      if (isCurrent() && blockedByBrowser(retryError)) onNotice(t("stream.tap"));
    }
  }
}

async function attachHls(video, url, onError) {
  if (video.canPlayType("application/vnd.apple.mpegurl")) {
    video.src = url; // Safari / iOS: yerleşik HLS
    return null;
  }
  const Hls = await loadHls();
  if (!Hls || !Hls.isSupported()) throw new Error(t("stream.unsupported"));
  const hls = new Hls({ lowLatencyMode: true, backBufferLength: 30 });
  hls.on(Hls.Events.ERROR, (_, data) => {
    if (data && data.fatal) onError(t("stream.cut"));
  });
  hls.loadSource(url);
  hls.attachMedia(video);
  return hls;
}

export function unmountStream() {
  if (!current) return;
  const { node, video, hls } = current;
  current = null;
  if (hls) hls.destroy();
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  node.remove();
}

/**
 * Yayını ekrana yerleştirir.
 * @param {HTMLElement} host .player__screen
 * @param {string} url
 * @param {{ onError: (message: string) => void, onNotice: (message: string) => void }} handlers
 */
export async function mountStream(host, url, { onError, onNotice }) {
  unmountStream();
  const node = document.createElement("div");
  node.className = "player__media";
  const kind = kindOf(url);
  const video = kind === "embed" ? null : makeVideo();
  const entry = { node, video, hls: null };
  current = entry;
  const isCurrent = () => current === entry;
  const fail = (message) => { if (isCurrent()) onError(message); }; // eski yayının hatası yenisini bozmasın
  node.append(video || makeIframe(url));
  host.prepend(node);
  if (!video) return;
  video.addEventListener("error", () => fail(t("stream.failed")));
  try {
    if (kind === "hls") entry.hls = await attachHls(video, url, fail);
    else video.src = url;
    if (!isCurrent()) {
      if (entry.hls) entry.hls.destroy(); // bu arada kanal değişti
      return;
    }
    await autoplay(video, onNotice, isCurrent);
  } catch (error) {
    fail(error instanceof Error ? error.message : t("stream.failed"));
  }
}

/** 1080p → en yüksek kalite, 720p → 720 satırı geçmeyen en iyi seviye (yalnızca hls.js akışlarında) */
export function setQuality(label) {
  const hls = current && current.hls;
  if (!hls || !hls.levels || hls.levels.length < 2) return false;
  if (label !== "720p") {
    hls.currentLevel = -1;
    return true;
  }
  const best = hls.levels.reduce((pick, level, i) => (level.height <= 720 && (pick < 0 || level.height > hls.levels[pick].height) ? i : pick), -1);
  hls.currentLevel = best;
  return true;
}

export const hasStream = () => Boolean(current);
