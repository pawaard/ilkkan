/* ======================================================
   İLKKAN SPORTS — İngilizce başlangıç içeriği
   seed-data.js'in birebir karşılığı. Yalnızca Türkçesi hâlâ ilk hâlinde olan
   alanlara uygulanır (yönetici Türkçeyi değiştirdiyse eski çeviri basılmaz).
   ====================================================== */

export const SEED_EN = Object.freeze({
  subtitles: [
    ["— Who do you think will win?", "— The winner. The loser wins experience."],
    ["— We're out of tea.", "— I put a drop of cola in hot water. Same colour."],
    ["— Which team are you supporting?", "— Both. Nobody should feel hurt."],
    ["— Was that a goal?", "— It was. I told the keeper to get well soon."],
    ["— Did the stream freeze?", "— It's resting a little. Let's wait."],
    ["— How much money have you got?", "— Ten lira. Having none would hurt less."],
  ],

  quotes: [
    "Drop by drop, a lake forms. Pass by pass, a goal.",
    "Save the straw, its time will come. Save the goal, stoppage time will come.",
    "The devil meddles in haste. Defenders meddle in hasty shots.",
    "One hand can't clap. Two hands can. The stands can do both.",
    "Stretch your legs as far as your blanket. Not as far as the ball.",
    "Don't laugh at your neighbour, it'll happen to you. Don't laugh at your rival, there's a return leg.",
    "Neighbours need each other's ashes. Teams need their subs.",
  ],

  liveComments: [
    "The ball is in midfield right now. Same distance from both goals. Fair.",
    "That was a foul. Honestly, they're both right.",
    "The referee showed a card. He's only human, let's not be angry.",
    "The keeper held on tight. Life is slippery, good for him.",
    "Throw-in. Everyone throws their own weight around.",
  ],

  commentary: [
    { ago: 1, text: "A player went down and his opponent helped him up. I got a bit emotional." },
    { ago: 4, text: "The referee checked his watch. Time is relative, I told him that too." },
    { ago: 9, text: "The ball went out. Sometimes stepping outside is good for you." },
    { ago: 15, text: "The stands are singing. I learnt both teams' anthems so nobody feels left out." },
    { ago: 22, text: "Someone is warming up on the touchline. His turn will come. Everyone's turn comes." },
    { ago: 34, text: "The broadcast has started. I took a deep breath." },
    { ago: 41, text: "Warm-up's over. I warmed up my tea. It's not tea, actually. It's cola." },
    { ago: 47, text: "The teams are out. I wished every single one of them luck." },
    { ago: 53, text: "The stadium lights came on. So did the light inside me." },
    { ago: 58, text: "Before the match I promised myself: whatever happens, I'll stay calm." },
  ],

  tickerNotes: [
    "Whatever the score, friendship starts at 0–0.",
    "Derby at 20:00. No rush, it'll come.",
    "The losing side gains experience. Congratulations, everyone.",
  ],

  tickerAds: [
    "Cola Tea — for when you're out of tea.",
    "Peace Pillow — stay calm, even for penalties.",
  ],

  rentCopies: [
    { brand: "Space for rent", tagline: "Your brand here, right next to İlkkan.", note: "İlkkan never gets angry. Not even at your ad.", cta: "Rent it now" },
    { brand: "Your ad here", tagline: "İlkkan checked: this spot is empty.", note: "He says that's fine. But it'd be nicer full.", cta: "Get in touch" },
    { brand: "This space is waiting", tagline: "Daily, weekly, monthly rentals.", note: "Prices set to İlkkan's budget. So, affordable.", cta: "Get a quote" },
    { brand: "Ad space for rent", tagline: "Everyone watching the match looks here too.", note: "Drop by drop, a lake. Look by look, a customer.", cta: "Advertise" },
    { brand: "This space is empty", tagline: "İlkkan wanted to put something here. He couldn't afford it.", note: "You can.", cta: "Book your spot" },
    { brand: "The window is yours", tagline: "It gets very crowded here on derby day.", note: "İlkkan is waiting with both teams' scarves on.", cta: "Rent" },
  ],

  // Parodi markalar (kurgusal)
  creatives: {
    "kola-cay": { brand: "Cola Tea", tagline: "For when you're out of tea.", note: "Two drops of cola in hot water. The İlkkan way.", cta: "Start brewing" },
    "huzur-yastik": { brand: "Peace Pillow", tagline: "Stay calm, even for penalties.", note: "Stoppage time included.", cta: "Hug it" },
    "atasozu-rehberi": { brand: "Proverb Guide", tagline: "A saying for every situation.", note: "Offside included. If we can't find one, we'll make it up.", cta: "Open the page" },
    "iki-taraf-atki": { brand: "Both Sides Scarf", tagline: "One end for each team.", note: "So nobody feels hurt.", cta: "Wrap it on" },
    "onluk-bank": { brand: "Tenner Bank", tagline: "Down to your last ten lira?", note: "Having none would hurt less. We get it.", cta: "Open an account" },
  },
  clickNote: "İlkkan clicked this ad too. Nothing happened, and he still wasn't angry. (Template ad — you'll add the real link.)",

  // Lig adlarının İngilizcesi (Türkçesi → İngilizcesi; resmî adı aynı olanlar listede yok)
  leagues: {
    "Premier Lig": "Premier League",
    "Arjantin Primera División": "Argentine Primera División",
    "Brezilya Serie A": "Brazilian Série A",
    "NBA Hazırlık": "NBA Preseason",
  },

  // Kanal kimliği → İngilizce tür / şimdi / sonra
  channels: {
    "ch-1": { genre: "Football", now: "Beşiktaş – Trabzonspor", next: "Post-match: İlkkan congratulates both teams" },
    "ch-2": { genre: "Basketball", now: "Anadolu Efes – Fenerbahçe Beko", next: "02:30 · Cavaliers – Magic" },
    "ch-3": { genre: "Volleyball", now: "VakıfBank – Eczacıbaşı Dynavit", next: "21:00 · Halkbank – Ziraat Bankkart" },
    "ch-4": { genre: "Derby channel", now: "Real Madrid – Barcelona", next: "20:00 · Galatasaray – Fenerbahçe" },
    "ch-5": { genre: "Legendary matches", now: "Unforgettable derbies (replay)", next: "Matches nobody lost" },
    "ch-6": { genre: "Studio", now: "İlkkan explains offside with proverbs", next: "Guest: the lost ball's family" },
  },

  site: {
    tagline: "Like everybody won.",
    description: "İlkkan Sports: live matches, today's fixtures and İlkkan's calm, heartfelt commentary. Like everybody won.",
    contactNote: "Message us on Telegram. İlkkan replies — without upsetting anyone.",
  },
  derby: { prediction: "My prediction: 1–1. A point each, so nobody's sad." },
  images: {
    heroAlt: "A still from the series Gibi: bald, bearded İlkkan sits in an armchair holding a blue mug.",
    cardAlt: "A still from the series Gibi: bald, bearded İlkkan in a striped shirt sits on a sofa with a faint smile.",
  },
});
