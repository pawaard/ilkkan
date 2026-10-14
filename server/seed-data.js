/* ======================================================
   İLKKAN SPORTS — Başlangıç içeriği (veritabanı tohumu)
   Maçlar, kanallar ve İlkkan'ın replikleri burada.
   İlk açılışta veritabanına yüklenir; sonrasında içerik /yonetim panelinden yönetilir.
   ====================================================== */

export const SEED = Object.freeze({
  categories: [
    { id: "all", label: "Hepsi" },
    { id: "futbol", label: "Futbol" },
    { id: "basketbol", label: "Basketbol" },
    { id: "voleybol", label: "Voleybol" },
    { id: "kanal", label: "Kanallar" },
  ],

  /*
    status: "live" | "upcoming" | "finished"
    clock:  kısa durum (bilet koçanında görünür)
    period: uzun durum (oynatıcıda görünür)
    score:  [ev, deplasman] — başlamamış maçta null
  */
  matches: [
    { id: "bjk-ts", cat: "futbol", league: "Trendyol Süper Lig", home: "Beşiktaş", away: "Trabzonspor", homeShort: "BJK", awayShort: "TS", time: "19:00", status: "live", clock: "34'", period: "34. dakika", score: [1, 0] },
    { id: "rma-bar", cat: "futbol", league: "LaLiga", home: "Real Madrid", away: "Barcelona", homeShort: "RMA", awayShort: "BAR", time: "18:15", status: "live", clock: "71'", period: "71. dakika", score: [2, 2] },
    { id: "mci-liv", cat: "futbol", league: "Premier Lig", home: "Manchester City", away: "Liverpool", homeShort: "MCI", awayShort: "LIV", time: "18:30", status: "live", clock: "61'", period: "61. dakika", score: [1, 1] },
    { id: "bay-bvb", cat: "futbol", league: "Bundesliga", home: "Bayern München", away: "Borussia Dortmund", homeShort: "BAY", awayShort: "BVB", time: "18:30", status: "live", clock: "58'", period: "58. dakika", score: [0, 1] },
    { id: "efes-fbb", cat: "basketbol", league: "Türkiye Sigorta BSL", home: "Anadolu Efes", away: "Fenerbahçe Beko", homeShort: "EFS", awayShort: "FBB", time: "19:00", status: "live", clock: "Ç2", period: "2. çeyrek", score: [38, 35] },
    { id: "vak-ecz", cat: "voleybol", league: "Sultanlar Ligi", home: "VakıfBank", away: "Eczacıbaşı Dynavit", homeShort: "VKF", awayShort: "ECZ", time: "18:00", status: "live", clock: "S4", period: "4. set", score: [2, 1] },
    { id: "gs-fb", cat: "futbol", league: "Trendyol Süper Lig", home: "Galatasaray", away: "Fenerbahçe", homeShort: "GS", awayShort: "FB", time: "20:00", status: "upcoming", clock: "", period: "Bugün 20.00", score: null, derby: true },
    { id: "hlk-zir", cat: "voleybol", league: "AXA Sigorta Efeler Ligi", home: "Halkbank", away: "Ziraat Bankkart", homeShort: "HLK", awayShort: "ZİR", time: "21:00", status: "upcoming", clock: "", period: "Bugün 21.00", score: null },
    { id: "rac-bel", cat: "futbol", league: "Arjantin Primera División", home: "Racing Club", away: "Belgrano", homeShort: "RAC", awayShort: "BEL", time: "01:15", status: "upcoming", clock: "", period: "Gece 01.15", score: null },
    { id: "bah-mir", cat: "futbol", league: "Brezilya Serie A", home: "Bahia", away: "Mirassol", homeShort: "BAH", awayShort: "MIR", time: "01:30", status: "upcoming", clock: "", period: "Gece 01.30", score: null },
    { id: "cle-orl", cat: "basketbol", league: "NBA Hazırlık", home: "Cleveland Cavaliers", away: "Orlando Magic", homeShort: "CLE", awayShort: "ORL", time: "02:30", status: "upcoming", clock: "", period: "Gece 02.30", score: null },
    { id: "mil-cha", cat: "basketbol", league: "NBA Hazırlık", home: "Milwaukee Bucks", away: "Charlotte Hornets", homeShort: "MIL", awayShort: "CHA", time: "03:00", status: "upcoming", clock: "", period: "Gece 03.00", score: null },
    { id: "eyp-goz", cat: "futbol", league: "Trendyol Süper Lig", home: "Eyüpspor", away: "Göztepe", homeShort: "EYP", awayShort: "GÖZ", time: "17:00", status: "finished", clock: "MS", period: "Maç sonu", score: [2, 1] },
  ],

  channels: [
    { id: "ch-1", no: "01", name: "İlkkan 1", genre: "Futbol", cat: "futbol", now: "Beşiktaş – Trabzonspor", next: "Maç sonu: İlkkan iki takımı da tebrik ediyor", progress: 0.38, matchId: "bjk-ts" },
    { id: "ch-2", no: "02", name: "İlkkan 2", genre: "Basketbol", cat: "basketbol", now: "Anadolu Efes – Fenerbahçe Beko", next: "02.30 · Cavaliers – Magic", progress: 0.46, matchId: "efes-fbb" },
    { id: "ch-3", no: "03", name: "İlkkan 3", genre: "Voleybol", cat: "voleybol", now: "VakıfBank – Eczacıbaşı Dynavit", next: "21.00 · Halkbank – Ziraat Bankkart", progress: 0.81, matchId: "vak-ecz" },
    { id: "ch-4", no: "04", name: "İlkkan MAX", genre: "Derbi kanalı", cat: "futbol", now: "Real Madrid – Barcelona", next: "20.00 · Galatasaray – Fenerbahçe", progress: 0.79, matchId: "rma-bar", feature: true },
    { id: "ch-5", no: "05", name: "İlkkan Nostalji", genre: "Efsane maçlar", cat: "kanal", now: "Unutulmaz derbiler (tekrar)", next: "Kimsenin kaybetmediği maçlar", progress: 0.22 },
    { id: "ch-6", no: "06", name: "İlkkan Sohbet", genre: "Stüdyo", cat: "kanal", now: "İlkkan ofsaytı atasözleriyle anlatıyor", next: "Konuk: Kaybolan topun ailesi", progress: 0.55 },
  ],

  // Tanıtımdaki eski televizyonda dönen altyazılar (iki satır)
  subtitles: [
    ["— Sence kim kazanır?", "— Kazanan kazanır. Kaybeden de tecrübe kazanır."],
    ["— Evde çay kalmamış.", "— Sıcak suya kola damlattım. Rengi aynı."],
    ["— Hangi takımı tutuyorsun?", "— İkisini de. Kimse kırılmasın."],
    ["— Gol oldu mu?", "— Oldu. Kaleciye de geçmiş olsun dedim."],
    ["— Yayın dondu mu?", "— Biraz dinleniyor. Bekleyelim."],
    ["— Cebinde kaç para var?", "— On lira. Hiç olmasa bu kadar üzülmezdim."],
  ],

  // Kayan nane yeşili bant: İlkkan atasözüyle konuşur
  quotes: [
    "Damlaya damlaya göl olur. Paslaşa paslaşa gol olur.",
    "Sakla samanı, gelir zamanı. Sakla golü, gelir uzatması.",
    "Acele işe şeytan karışır. Acele şuta savunma karışır.",
    "Bir elin nesi var, iki elin sesi var. Tribünün de alkışı.",
    "Ayağını yorganına göre uzat. Topa göre değil.",
    "Gülme komşuna, gelir başına. Gülme rakibe, gelir rövanşa.",
    "Komşu komşunun külüne muhtaç. Takım da yedeğine.",
  ],

  // Oynatıcı canlıyken alt bantta dönen yorumlar
  liveComments: [
    "Top şu an orta sahada. İki kaleye de eşit uzaklıkta. Adil.",
    "Faul oldu. Aslında ikisi de haklı.",
    "Hakem kart gösterdi. O da insan, kızmayalım.",
    "Kaleci topu sıkı tuttu. Hayat kaygan, iyi yapıyor.",
    "Taç atışı. Herkes kendi tacını taşır.",
  ],

  // Oynatıcı altındaki canlı anlatım (en yeni üstte; ago = kaç dakika önce)
  commentary: [
    { ago: 1, text: "Bir oyuncu düştü, rakibi elini uzatıp kaldırdı. Gözlerim doldu." },
    { ago: 4, text: "Hakem saatine baktı. Zaman göreceli, ona da söyledim." },
    { ago: 9, text: "Top auta çıktı. Bazen biraz dışarı çıkmak da iyidir." },
    { ago: 15, text: "Tribün şarkı söylüyor. İki takımın marşını da ezberledim, kimse kırılmasın." },
    { ago: 22, text: "Kenarda biri ısınıyor. Sırası gelecek. Herkesin sırası gelir." },
    { ago: 34, text: "Yayın başladı. Derin bir nefes aldım." },
    { ago: 41, text: "Isınma bitti. Ben de çayımı ısıttım. Çay değil aslında, kola." },
    { ago: 47, text: "Takımlar sahaya çıktı. Hepsine ayrı ayrı başarılar diledim." },
    { ago: 53, text: "Stadyumun ışıkları yandı. İçimin ışığı da yandı." },
    { ago: 58, text: "Maçtan önce kendime söz verdim: ne olursa olsun sakin kalacağım." },
  ],

  // Skorbord şeridindeki İlkkan notları
  tickerNotes: [
    "Skor ne olursa olsun, dostluk 0–0 başlar.",
    "Derbi 20.00'de. Acele etme, gelir.",
    "Kaybeden de tecrübe kazanıyor. Herkese tebrikler.",
  ],

  derby: {
    matchId: "gs-fb",
    kickoff: "20:00",
    prediction: "Tahminim 1–1. Herkes birer puan alsın, kimse üzülmesin.",
  },

  /*
    REKLAMLAR
    index.html'deki her .ad__frame bir reklam slotudur. İçine gerçek reklam kodu
    (ör. AdSense) yapıştırırsan ads.js o slota dokunmaz. Boş slotlara aşağıdaki
    temalı ev/parodi reklamlardan biri basılır. Markalar kurgusaldır.
  */
  ads: {
    creatives: {
      "kola-cay": { brand: "Kolaçay", tagline: "Evde çay yoksa.", note: "Sıcak suya iki damla kola. İlkkan usulü.", cta: "Demlemeye başla", icon: "i-tea", tone: "mint", serif: true },
      "huzur-yastik": { brand: "Huzur Yastık", tagline: "Penaltıda bile sakin kal.", note: "Uzatmalar dahil.", cta: "Sarıl", icon: "i-pillow", tone: "lilac" },
      "atasozu-rehberi": { brand: "Atasözü Rehberi", tagline: "Her pozisyona bir söz.", note: "Ofsayt dahil. Bulamazsak uydururuz.", cta: "Sayfayı aç", icon: "i-book", tone: "coral", serif: true },
      "iki-taraf-atki": { brand: "İki Taraf Atkı", tagline: "Bir ucu bir takımın, öbür ucu öbürünün.", note: "Kimse kırılmasın diye.", cta: "Boynuna dola", icon: "i-scarf", tone: "moon" },
      "onluk-bank": { brand: "Onluk Bank", tagline: "Cebinde on lira mı kaldı?", note: "Hiç olmasa daha az üzülürdün. Biz anlıyoruz.", cta: "Hesap aç", icon: "i-coin", tone: "mint" },
    },

    // "BU ALAN KİRALIK" bannerları: İlkkan fotoğrafı + kiralık tabelası.
    // Her slota sırayla farklı metin, renk ve fotoğraf düşer (yan yana tekrar etmez).
    rent: {
      href: "#iletisim",
      photos: [
        { src: "assets/img/ilkkan-portre.jpg", focus: "50% 22%" },
        { src: "assets/img/ilkkan-sahne.jpg", focus: "50% 24%" },
      ],
      tones: ["mint", "coral", "lilac", "moon"],
      copies: [
        { brand: "Bu alan kiralık", tagline: "Markanız burada, İlkkan'ın hemen yanında.", note: "İlkkan kimseye kızmaz. Reklamınıza da kızmaz.", cta: "Hemen kirala" },
        { brand: "Reklamınız burada", tagline: "İlkkan baktı: burası boş.", note: "Olsun dedi. Ama dolsa daha güzel olur.", cta: "İletişime geç" },
        { brand: "Bu alan sizi bekliyor", tagline: "Günlük, haftalık, aylık kiralama.", note: "Fiyatlar İlkkan'ın bütçesine göre ayarlandı. Yani uygun.", cta: "Fiyat al" },
        { brand: "Kiralık reklam alanı", tagline: "Maçı izleyen herkes buraya da bakar.", note: "Damlaya damlaya göl olur, baka baka müşteri.", cta: "Reklam ver" },
        { brand: "Bu alan boş", tagline: "İlkkan buraya bir şey koymak istedi, parası yetmedi.", note: "Sizinki yeter.", cta: "Yerini ayırt" },
        { brand: "Vitrin sizin", tagline: "Derbi günü burası çok kalabalık olur.", note: "İlkkan iki takımın atkısını birden takıp bekliyor.", cta: "Kirala" },
      ],
    },

    // Slot → reklamlar. "kiralik" = İlkkan'lı kiralık banner; liste = parodi markalar.
    // Sıra = doldurma önceliği (aynı anda görünen alanlar önce dolar).
    slots: {
      "video-ust": "kiralik",
      "ust-banner": "kiralik",
      "sol-ray": "kiralik",
      "sag-ray": "kiralik",
      "video-alt": "kiralik",
      "fikstur-kutu": "kiralik",
      "mac-arasi": "kiralik",
      "yayin-sonrasi": "kiralik",
      "kose-kutu": "kiralik",
      "alt-billboard": "kiralik",
      "mobil-alt": "kiralik",
      "kanal-native": ["kola-cay", "huzur-yastik", "onluk-bank"],
    },
    playerSponsor: "kola-cay",
    ticker: ["Kolaçay — Evde çay yoksa.", "Huzur Yastık — Penaltıda bile sakin kal."],
    clickNote: "Bu reklamı İlkkan da tıkladı. Bir şey olmadı, yine de kızmadı. (Şablon reklam — gerçek bağlantıyı sen ekleyeceksin.)",
  },
});
