// Sunucuyu başlatır: npm run dev (geliştirme) / npm start (yayın)
import { createAdmin } from "./auth.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { openDb } from "./db.js";
import { initData } from "./migrate.js";

const config = loadConfig();
const db = openDb(config.dbPath);

if (initData(db)) console.info("Veritabanı ilk kez dolduruldu (başlangıç içeriği yüklendi).");
db.prepare("DELETE FROM sessions WHERE expires_at < ?").run(Date.now()); // süresi dolmuş oturumları temizle

// Hiç yönetici yoksa .env'deki ADMIN_USER / ADMIN_PASSWORD ile ilkini oluştur
const { n: adminCount } = db.prepare("SELECT COUNT(*) AS n FROM admins").get();
if (adminCount === 0) {
  if (config.adminUser && config.adminPassword) {
    await createAdmin(db, config.adminUser, config.adminPassword);
    console.info(`İlk yönetici oluşturuldu: ${config.adminUser}`);
  } else {
    console.warn("Henüz yönetici yok. .env dosyasına ADMIN_USER ve ADMIN_PASSWORD yaz ya da `npm run admin` çalıştır.");
  }
}

if (config.secure && !config.trustProxy) {
  console.warn("SITE_URL https ama TRUST_PROXY ayarlı değil: bir ters vekil arkasındaysan TRUST_PROXY=1 yap, yoksa tüm ziyaretçiler tek IP sayılır (giriş sınırı herkesi birlikte kilitler).");
}

const server = createApp({ db, config }).listen(config.port, () => {
  console.info(`İlkkan Sports yayında: http://localhost:${config.port}  ·  Panel: http://localhost:${config.port}/yonetim`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
