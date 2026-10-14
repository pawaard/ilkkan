/* ======================================================
   İLKKAN SPORTS — Tanıtım (hero) · İlkkan kartı · görünürlük
   ====================================================== */
import { $, $$, pad, reduceMotion } from "./core.js";
import { DATA } from "./state.js";

const el = {
  subtitle: $("#subtitle"),
  timecode: $("#timecode"),
  tv: $(".tv"),
  card: $("#ilkkanCard"),
};

/* Hero başlığı — hangi font gelirse gelsin tek satıra sığdır */
export function bindHeadlineFit() {
  const title = $(".hero__title");
  const first = title && title.firstElementChild;
  if (!first) return;
  const fit = () => {
    title.style.setProperty("--fit", "1");
    const range = document.createRange();
    range.selectNodeContents(first);
    const textW = range.getBoundingClientRect().width;
    const boxW = first.clientWidth;
    const scale = textW > boxW ? Math.max(0.4, (boxW / textW) * 0.98) : 1;
    title.style.setProperty("--fit", scale.toFixed(4));
  };
  fit();
  if (document.fonts) {
    document.fonts.ready.then(fit);
    if (typeof document.fonts.addEventListener === "function") document.fonts.addEventListener("loadingdone", fit);
  }
  if (!("ResizeObserver" in window)) {
    window.addEventListener("resize", fit);
    return;
  }
  // Yalnızca genişlik değişince yeniden ölç (yükseklik değişimi döngü yaratmasın)
  let lastWidth = 0;
  new ResizeObserver(([entry]) => {
    const w = Math.round(entry.contentRect.width);
    if (w === lastWidth) return;
    lastWidth = w;
    fit();
  }).observe(title);
}

/* Televizyon altyazıları */
export function runSubtitles() {
  const lines = DATA.subtitles;
  const [first, second] = el.subtitle.children;
  if (lines.length === 0) return;
  let i = 0;
  const show = () => {
    el.subtitle.classList.remove("is-on");
    setTimeout(() => {
      const [a, b] = lines[i % lines.length];
      first.textContent = a;
      second.textContent = b;
      el.subtitle.classList.add("is-on");
      i += 1;
    }, reduceMotion ? 0 : 340);
  };
  setTimeout(() => {
    show();
    setInterval(show, 5600);
  }, reduceMotion ? 0 : 1500);
}

/* Eski televizyonun video sayacı (s:dd:ss) — televizyon ekranda değilse durur */
export function runTimecode() {
  const start = Date.now() - (21 * 60 + 47) * 1000;
  let timer = 0;
  const paint = () => {
    const secs = Math.floor((Date.now() - start) / 1000);
    el.timecode.textContent = `${Math.floor(secs / 3600)}:${pad(Math.floor(secs / 60) % 60)}:${pad(secs % 60)}`;
  };
  const run = (on) => {
    clearInterval(timer);
    if (on) timer = setInterval(paint, 1000);
  };
  paint();
  if (!("IntersectionObserver" in window)) {
    run(true);
    return;
  }
  new IntersectionObserver(([entry]) => run(entry.isIntersecting)).observe(el.tv);
  run(true);
}

/* İlkkan kartı — 3D eğim */
export function bindCard() {
  const card = el.card;
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (!card || reduceMotion || !finePointer) return;
  const frame = card.parentElement; // eğilmeyen kapsayıcı: ölçüm titremez
  frame.addEventListener("pointermove", (e) => {
    const r = frame.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width;
    const y = (e.clientY - r.top) / r.height;
    card.classList.add("is-tilting");
    card.style.setProperty("--rx", `${((x - 0.5) * 18).toFixed(2)}deg`);
    card.style.setProperty("--ry", `${((0.5 - y) * 14).toFixed(2)}deg`);
    card.style.setProperty("--mx", `${(x * 100).toFixed(1)}%`);
    card.style.setProperty("--my", `${(y * 100).toFixed(1)}%`);
  });
  frame.addEventListener("pointerleave", () => {
    card.classList.remove("is-tilting");
    card.style.setProperty("--rx", "0deg");
    card.style.setProperty("--ry", "0deg");
  });
}

/* Ekrana giren bölümler; .hero aşağıda kaldığı için açılış koreografisi ekrana girince başlar */
export function bindReveal() {
  const items = $$(".reveal, .hero");
  if (!("IntersectionObserver" in window)) {
    items.forEach((n) => n.classList.add("is-in"));
    return;
  }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-in");
      io.unobserve(entry.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.06 });
  items.forEach((n) => io.observe(n));
}
