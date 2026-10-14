# İlkkan Sports

*Gibi* dizisinin İlkkan'ı etrafında kurulmuş canlı spor yayın sitesi ve yönetim paneli ("Reji").
Ersoy Sports'un kardeş versiyonudur: işleyiş birebir aynı, karakter, metinler ve tasarım İlkkan'a göre.
Site, skorlar, kanallar, reklam alanları ve metinler panelden yönetilir; skor değişikliği açık sayfalara 30 saniye içinde kendiliğinden yansır.

## İlkkan versiyonunda ne değişti?

| | Ersoy Sports | İlkkan Sports |
|---|---|---|
| **Karakter** | Fazla detaycı, her şeyi iki kere sayar | Sakin, uzlaşmacı, atasözüyle konuşur, hep beş parasız |
| **Slogan** | Tribündeymişsin gibi. | Herkes kazanmış gibi. |
| **Renkler** | Sıcak kahve-siyah + kehribar + domates | Simsiyah + koyu kırmızı (crimson) + kemik beyazı + gümüş |
| **Yazı tipleri** | Bricolage Grotesque + Fraunces | Archivo (dar kesim) + Instrument Serif |
| **Tanıtım** | Film karesi + altyazı | Antenli eski tüplü televizyon + altyazı |
| **Afiş** | Neon tel kafes | Dönen "aura" halkaları |
| **Arma** | Tel kafes top | İnce belli çay bardağı (kolaçay) |
| **Bant** | Ersoy'un gözlemleri | İlkkan'ın atasözleri ("Paslaşa paslaşa gol olur") |
| **Parodi reklamlar** | Kafes Kask, Sabır Çayı… | Kolaçay, Huzur Yastık, Onluk Bank, İki Taraf Atkı, Atasözü Rehberi |
| **Oyuncu kartı** | Detay 99, Sayma 91… | Sakinlik 99, Uzlaşma 97, Atasözü 95, Bütçe 12… |

> Bağımsız hayran projesidir; Exxen veya *Gibi* yapımcılarıyla bağlantısı yoktur.

## Gerekenler

- **Node.js 22.13 veya üstü** (24 ile test edildi). Ayrı bir veritabanı kurmaya gerek yok: Node'un yerleşik SQLite'ı kullanılır.
- Uçtan uca testler için bilgisayarda **Google Chrome** (Playwright, tarayıcı indirmeden onu kullanır).

## Kurulum

```bash
npm install
```

`.env.example` dosyasını `.env` olarak kopyala ve en azından ilk yöneticiyi yaz:

```
ADMIN_USER=ilkkan
ADMIN_PASSWORD=en-az-10-karakterlik-uzun-bir-sifre
```

```bash
npm run dev
```

- Site: <http://localhost:5500>
- Panel: <http://localhost:5500/yonetim>

İlk açılışta veritabanı (`data/ilkkan.db`) sitenin bugünkü içeriğiyle dolar ve `.env`'deki bilgilerle ilk yönetici oluşturulur. Sonrasında `ADMIN_PASSWORD` satırını `.env`'den silebilirsin.

Yönetici eklemek ya da şifre sıfırlamak için (şifre terminalde gizli sorulur):

```bash
npm run admin -- kullanici-adi
```

## Panelde neler var?

| Bölüm | Ne yapar |
|---|---|
| **Özet** | Bugünkü görüntüleme, tekil ziyaretçi, reklam gösterim/tıklama, yayın başlatma; 14 günlük grafik; canlı maçlara hızlı skor kumandası |
| **Maçlar** | Ekle / düzenle / sil / sırala. **Kumanda**: "+ Gol", geri al, durum (Yakında/Canlı/Bitti), dakika. Yayın adresi 1–2 |
| **Kanallar** | İlkkan 1–6: şimdi/sonra, ilerleme, bağlı maç, öne çıkan kanal, yayın adresi |
| **Reklam alanları** | Alan 01–16 + maç arası. Her alan: **Kiralık** (İlkkan'lı banner) · **Görsel** (yükle + bağlantı) · **Reklam kodu** (AdSense vb.) · **Kapalı**. Alan başına gösterim/tıklama oranı |
| **Metinler** | Altyazılar, İlkkan'ın atasözleri ve replikleri, canlı anlatım, skorbord notları, kiralık banner metinleri |
| **Ayarlar** | Site adı/açıklama, Telegram/X bağlantıları, derbi seçimi, oynatıcı sponsoru, sitedeki tüm görseller |
| **Hesap** | Şifre değiştir, yüklenen görseller, son işlemler (kim neyi değiştirdi) |

### Yayın adresleri

`.m3u8` adresleri oynatıcıda video olarak (hls.js) açılır; `.mp4/.webm` doğrudan oynar; diğer adresler kısıtlanmış bir `iframe` içinde açılır. Adres yoksa oynatıcı İlkkan'ın saha görünümünü gösterir.
**Yalnızca yayın hakkına sahip olduğun ya da izinli kaynakların adresini gir.**

### Reklam kodu ve çerezler

Site kendi işleyişi için çerez kullanmaz; istatistikler çerezsizdir (IP saklanmaz). Bir alana *reklam kodu* koyduğunda sitede çerez onay bandı çıkar ve kod **yalnızca ziyaretçi izin verirse** yüklenir; izin yoksa o alanda İlkkan'ın kiralık bannerı durur.

> **Güvenlik notu:** Reklam kodu sitenin kendi sayfasında çalışır. Yayında reklam kodu kullanacaksan paneli **ayrı bir alan adından** aç (`ADMIN_HOST=reji.alanadin.com`, iki alan adı da aynı sunucuyu göstersin). Böylece bozuk ya da kötü niyetli bir reklam betiği, siteyi gezen yöneticinin panel oturumuna ulaşamaz.

## Diller (Türkçe + İngilizce)

- **Site:** Türkçe `/` adresinde, İngilizce `/en/` altında (`/en/match/<kimlik>`, `/en/privacy`, `/en/cookies`, `/en/terms`). Üstteki **TR / EN** düğmesi aynı sayfanın diğer diline gider. Her sayfada `hreflang` ve dile göre `<html lang>`, paylaşım görseli (`og.jpg` / `og-en.jpg`) var; sitemap iki dili birlikte listeler.
- **Panel:** Üst çubuktaki **TR / EN** düğmesi panelin arayüz dilini değiştirir (tarayıcıda hatırlanır; sunucu hata mesajları da o dilde gelir).
- **İçerik:** Çevrilebilir her şeyin İngilizcesi isteğe bağlıdır; **boş bırakılırsa İngilizce sitede Türkçesi görünür.**
  - *Metinler* ekranında **İçerik dili: Türkçe / English** seçilir; "Türkçeden kopyala" çeviriye Türkçe listeyle başlatır.
  - *Ayarlar*'da her bölümün altında **English** alanları (slogan, açıklama, iletişim notu, derbi tahmini, görsel açıklamaları).
  - *Kanallar* (tür / şimdi / sonra), *Maçlar* (lig adı) ve *Reklam alanları* (görsel açıklaması) formlarında "(English)" alanları.
- **Canlı skor yazıları otomatik:** Canlıda yalnızca Türkçe girilir; İngilizcesi dakikadan üretilir (`34'` → "34th minute", `Ç2` → "Q2 · 2nd quarter", `S4` → "4th set", `MS` → "FT · Full time").
- İlk açılışta (ve eski veritabanlarında bir kereye mahsus göçle) başlangıç içeriğinin İngilizcesi yüklenir; yalnızca Türkçesi değiştirilmemiş alanlara uygulanır.
- Kod tarafı: site arayüz metinleri `server/i18n/site.{tr,en}.js` ve `public/js/i18n.js`, panel `public/yonetim/js/lang/{tr,en}.js`, sunucu mesajları `server/i18n/messages.js`. Testler iki dilin anahtarlarının birebir aynı olduğunu denetler.

## Sayfalar

`/` ana sayfa · `/mac/<kimlik>` maç sayfası (arama motorları ve paylaşım için, `SportsEvent` yapılandırılmış verisiyle) · `/kvkk` · `/cerez-politikasi` · `/kullanim-kosullari` · `/sitemap.xml` · `/robots.txt` · temalı 404 — ve hepsinin İngilizcesi `/en/` altında.

> Yasal sayfalar **şablondur**: sarı işaretli alanları (`server/pages/*.html`, İngilizceleri `server/pages/en/*.html`) kendi bilgilerinle doldur ve yayına almadan önce bir hukukçuya kontrol ettir.

## Testler

```bash
npm test            # API + birim testleri, kapsama raporuyla
npm run test:e2e    # Chrome ile uçtan uca: giriş, canlı skor, reklam modları, sayfalar
```

Chrome kurulu değilse Playwright'a başka bir Chromium gösterebilirsin:

```bash
PW_CHROMIUM=/yol/chromium npm run test:e2e
```

Uçtan uca testler geçici bir veritabanıyla ayrı bir sunucu açar (port 5511) ve her çalıştırmada rastgele bir test şifresi üretir; gerçek verine dokunmaz.

## Yayına alma

Site bir **Node.js sunucusu** ister ve veritabanı ile yüklenen görseller **kalıcı diskte** durmalıdır.

- Uygun: kendi VPS'in (ör. Hetzner, DigitalOcean), Railway / Fly.io (volume ile), Render (ücretli disk ile).
- Uygun değil: yalnızca statik barındırma (GitHub Pages, Netlify) ya da diski silen ücretsiz katmanlar — her yeniden başlatmada veriler kaybolur.

Yayın `.env` örneği:

```
NODE_ENV=production
SITE_URL=https://alanadin.com
ADMIN_HOST=reji.alanadin.com
DB_PATH=/kalici-disk/ilkkan.db
UPLOAD_DIR=/kalici-disk/uploads
TRUST_PROXY=1
```

- `SITE_URL` `https://` ile başladığında oturum çerezi yalnızca HTTPS üzerinden gider ve HSTS açılır.
- `TRUST_PROXY=1` yalnızca uygulama bir ters vekilin (Caddy, Nginx, Render…) arkasındaysa ve doğrudan internete açık değilse kullanılmalı; yoksa giriş deneme sınırı ziyaretçi IP'sini yanlış görür.

```bash
npm ci --omit=dev
npm start
```

HTTPS'i önündeki ters vekil (Caddy, Nginx) ya da barındırma servisi sağlamalıdır.

**Yedek:** `DB_PATH` dosyasını (yanındaki `-wal` dosyasıyla birlikte) ve `UPLOAD_DIR` klasörünü düzenli olarak kopyala.

## Klasörler

```
public/            site (index.html şablonu, css/, js/, assets/) ve panel (yonetim/)
server/            Express uygulaması
  routes/          site, sayaç ve yönetim API'si
  render/          sunucuda üretilen sayfalar (maç, yasal, 404)
  pages/           yasal sayfa ve 404 metinleri
  migrations.sql   veritabanı şeması
  seed-data.js     ilk açılış içeriği
tests/             API/birim testleri ve e2e/ (Playwright)
data/              SQLite veritabanı (git dışı)
```

## Görseller (İlkkan fotoğrafları)

Sitedeki İlkkan görselleri, EXXEN'in resmî YouTube kanalındaki *Gibi* kliplerinden alınmış karelerdir (kanepede gülümseyen ve elinde kupayla koltukta oturan İlkkan); hakları yapımcıya aittir. Yayına çıkmadan önce lisanslı ya da izinli görseller kullanman önerilir.

Değiştirmek için iki yol var:

1. **Panelden (önerilen):** *Ayarlar › Görseller* bölümünden afiş (sol/sağ), tanıtım televizyonu, oyuncu kartı ve kiralık banner fotoğraflarını tek tek yükle. Görsel açıklamalarını (alt metin) da oradan güncelle.
2. **Dosya olarak:** `public/assets/img/` klasöründeki dosyaların yerine aynı adla koy:
   - `ilkkan-portre.jpg` — dik portre (513×720): oyuncu kartı, sol afiş, kiralık bannerlar
   - `ilkkan-sahne.jpg` — uzun dikey kare (405×720): tanıtımdaki televizyon, sağ afiş
   - `og.jpg` / `og-en.jpg` — 1200×630 paylaşım kartları (Türkçe / İngilizce)
