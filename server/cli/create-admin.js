// Yönetici ekle ya da şifresini sıfırla:  npm run admin -- <kullanıcı-adı>
// Şifre terminalde sorulur (ekrana yazılmaz); komut satırına şifre yazma, geçmişte kalır.
import { createInterface } from "node:readline";
import { changePassword, createAdmin, MIN_PASSWORD } from "../auth.js";
import { loadConfig } from "../config.js";
import { openDb } from "../db.js";
import { initData } from "../migrate.js";

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (text) => {
      if (text.includes(question)) process.stdout.write(text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });
}

const username = (process.argv[2] || "").trim();
if (!/^[\w.-]{3,40}$/.test(username)) {
  console.error("Kullanım: npm run admin -- <kullanıcı-adı>   (3–40 karakter: harf, rakam, . _ -)");
  process.exit(1);
}

const config = loadConfig();
const db = openDb(config.dbPath);
initData(db);

const password = await askHidden(`${username} için şifre (en az ${MIN_PASSWORD} karakter): `);
if (password.length < MIN_PASSWORD) {
  console.error(`Şifre en az ${MIN_PASSWORD} karakter olmalı.`);
  process.exit(1);
}
const again = await askHidden("Şifreyi tekrar yaz: ");
if (again !== password) {
  console.error("Şifreler aynı değil.");
  process.exit(1);
}

const existing = db.prepare("SELECT id FROM admins WHERE username = ?").get(username);
if (existing) {
  await changePassword(db, existing.id, password);
  console.info(`${username} şifresi güncellendi (açık oturumları kapatıldı).`);
} else {
  await createAdmin(db, username, password);
  console.info(`${username} yönetici olarak eklendi. Giriş: /yonetim`);
}
db.close();
