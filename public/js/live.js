/* ======================================================
   İLKKAN SPORTS — Canlı yenileme
   30 saniyede bir /api/live sorulur; sekme gizliyken beklenir.
   ====================================================== */
import { applyLive } from "./state.js";

const INTERVAL_MS = 30_000;

/** @param {(changedIds: string[]) => void} onChange */
export function startLive(onChange) {
  let timer = 0;
  let busy = false;

  const fetchLive = async () => {
    try {
      // Cevap gelmezse 10 sn'de vazgeç: asılı kalan istek sonraki turları kilitlemesin
      const res = await fetch("/api/live", { cache: "no-store", headers: { Accept: "application/json" }, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      const body = await res.json();
      return body && body.success ? body.data : null;
    } catch {
      return null; // bağlantı koptu: bir sonraki turda tekrar denenir, sayfa olduğu gibi kalır
    }
  };

  const poll = async () => {
    if (busy || document.hidden) return;
    busy = true;
    const data = await fetchLive();
    busy = false;
    if (!data) return;
    const changed = applyLive(data);
    if (!changed.length) return;
    try {
      onChange(changed);
    } catch (error) {
      console.error("Canlı güncelleme ekrana çizilemedi:", error);
    }
  };

  const start = () => {
    clearInterval(timer);
    timer = setInterval(poll, INTERVAL_MS);
  };
  // Sekmeye geri dönülünce beklemeden tazele
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) return;
    poll();
    start();
  });
  start();
}
