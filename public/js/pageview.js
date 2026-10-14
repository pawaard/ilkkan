/* Alt sayfalar (maç sayfası vb.) için çerezsiz görüntüleme sayacı — ana sayfadaki main.js ile aynı uç */
const body = JSON.stringify({ e: "view", k: window.location.pathname });
try {
  if (!(navigator.sendBeacon && navigator.sendBeacon("/api/t", body))) {
    fetch("/api/t", { method: "POST", body, keepalive: true }).catch(() => {});
  }
} catch {
  // Sayaç çalışmazsa sayfa etkilenmesin
}
