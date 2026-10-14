// Canlı maç yazılarının İngilizcesi otomatik üretilir: yönetici canlıda yalnızca Türkçe yazar.
// Dakika kısaltmaları: 34'  90+3'  Ç2 (çeyrek)  S4 (set)  İY (devre arası)  UZ (uzatma)  PEN  MS (maç sonu)

const ordinal = (n) => {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  return `${n}${{ 1: "st", 2: "nd", 3: "rd" }[n % 10] || "th"}`;
};

const RULES = Object.freeze([
  { re: /^MS$/i, clock: () => "FT", period: () => "Full time" },
  { re: /^(İY|IY|DA)$/i, clock: () => "HT", period: () => "Half-time" },
  { re: /^UZ$/i, clock: () => "ET", period: () => "Extra time" },
  { re: /^PEN$/i, clock: () => "PEN", period: () => "Penalties" },
  { re: /^Ç(\d)$/i, clock: (m) => `Q${m[1]}`, period: (m) => `${ordinal(Number(m[1]))} quarter` },
  { re: /^S(\d)$/i, clock: (m) => `S${m[1]}`, period: (m) => `${ordinal(Number(m[1]))} set` },
  { re: /^(\d{1,3})\+(\d{1,2})'?$/, clock: (m) => `${m[1]}+${m[2]}'`, period: (m) => `${ordinal(Number(m[1]))} minute, +${m[2]} stoppage` },
  { re: /^(\d{1,3})'?$/, clock: (m) => `${m[1]}'`, period: (m) => `${ordinal(Number(m[1]))} minute` },
]);

const ruleFor = (clock) => {
  const text = String(clock || "").trim();
  for (const rule of RULES) {
    const m = rule.re.exec(text);
    if (m) return { rule, m };
  }
  return null;
};

/** Bilet koçanındaki kısa dakika */
export function clockEn(clock) {
  const hit = ruleFor(clock);
  return hit ? hit.rule.clock(hit.m) : String(clock || "");
}

/** Oynatıcıdaki uzun durum yazısı */
export function periodEn({ status, clock, time }) {
  if (status === "finished") return "Full time";
  if (status === "upcoming") {
    const hour = Number(String(time).slice(0, 2));
    return `${hour < 6 ? "Tonight" : "Today"} ${time}`;
  }
  const hit = ruleFor(clock);
  return hit ? hit.rule.period(hit.m) : "Live";
}
