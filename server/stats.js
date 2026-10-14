// Çerezsiz istatistik: yalnızca gün × olay × anahtar sayaçları. Ham IP saklanmaz.
import { createHash, randomBytes } from "node:crypto";

const DAY_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul", year: "numeric", month: "2-digit", day: "2-digit" });

/** Türkiye saatine göre "YYYY-AA-GG" */
export const dayKey = (date = new Date()) => DAY_FMT.format(date);

export const shiftDay = (day, delta) => {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
};

// Tekil ziyaretçi: gün değişince yenilenen, yalnızca bellekte duran tuzla IP + tarayıcı özeti.
// Tuz diske yazılmadığı için özetten IP geri bulunamaz; ertesi gün aynı kişi farklı özet alır.
export function createVisitorHasher() {
  let salt = { day: "", value: "" };
  return (ip, userAgent, day) => {
    if (salt.day !== day) salt = { day, value: randomBytes(16).toString("hex") };
    return createHash("sha256").update(`${salt.value}|${ip}|${userAgent}`).digest("hex").slice(0, 32);
  };
}

function bump(db, day, event, key) {
  db.prepare(`INSERT INTO stats_daily (day, event, key, count) VALUES (?, ?, ?, 1)
    ON CONFLICT(day, event, key) DO UPDATE SET count = count + 1`).run(day, event, key);
}

// Eski günlerin ziyaretçi özetleri gün değişince bir kez silinir (her görüntülemede tablo taranmasın)
const prunedDay = new WeakMap();

/** @returns {boolean} yeni tekil ziyaretçi mi */
export function recordEvent(db, { event, key = "", visitor = "", day = dayKey() }) {
  bump(db, day, event, key);
  if (event !== "view" || !visitor) return false;
  if (prunedDay.get(db) !== day) {
    db.prepare("DELETE FROM visitors_today WHERE day <> ?").run(day);
    prunedDay.set(db, day);
  }
  const { changes } = db.prepare("INSERT OR IGNORE INTO visitors_today (day, hash) VALUES (?, ?)").run(day, visitor);
  if (changes > 0) bump(db, day, "visitor", "");
  return changes > 0;
}

const sumBy = (rows, event) => rows.filter((r) => r.event === event).reduce((n, r) => n + r.count, 0);

export function getStats(db, { days = 14, today = dayKey() } = {}) {
  const from = shiftDay(today, -(days - 1));
  const rows = db.prepare("SELECT day, event, key, count FROM stats_daily WHERE day >= ? AND day <= ?").all(from, today);
  const todays = rows.filter((r) => r.day === today);

  const series = Array.from({ length: days }, (_, i) => {
    const day = shiftDay(from, i);
    const dayRows = rows.filter((r) => r.day === day);
    return { day, views: sumBy(dayRows, "view"), visitors: sumBy(dayRows, "visitor") };
  });

  const perKey = (event) => rows
    .filter((r) => r.event === event)
    .reduce((acc, r) => ({ ...acc, [r.key]: (acc[r.key] || 0) + r.count }), {});
  const imps = perKey("imp");
  const clicks = perKey("click");
  const plays = perKey("play");
  const units = [...new Set([...Object.keys(imps), ...Object.keys(clicks)])]
    .map((id) => ({ id, imps: imps[id] || 0, clicks: clicks[id] || 0 }))
    .sort((a, b) => b.imps - a.imps);

  return {
    today: {
      views: sumBy(todays, "view"),
      visitors: sumBy(todays, "visitor"),
      imps: sumBy(todays, "imp"),
      clicks: sumBy(todays, "click"),
      plays: sumBy(todays, "play"),
    },
    series,
    units,
    plays: Object.entries(plays).map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count),
    range: { from, to: today, days },
  };
}
