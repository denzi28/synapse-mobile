export const tr = {
  common: {
    justNow: 'Az önce',
    unknown: 'Bilinmiyor',
    ok: 'Tamam',
    cancel: 'İptal',
    delete: 'Sil',
    continue: 'Devam',
    notNow: 'Şimdi değil',
    turnOff: 'Kapat',
    openSettings: 'Ayarları aç',
    gotIt: 'Anladım',
    setUp: 'Kur',
    synapse: 'Synapse',
  },
  onboarding: {
    title: "Synapse'e hoş geldin",
    skip: 'Geç',
    next: 'İleri',
    done: 'Başla',
    page1Title: 'Saniyeler içinde kaydet',
    page1Body:
      'Artı (+) ile not veya foto ekle. Panodan görsel de yapıştırabilirsin. Kaydederken Synapse bir ders klasörü önerebilir.',
    page2Title: 'Her şeyi bul',
    page2Body:
      'Arama çubuğuna sorunu yaz. YZ yalnızca uygulamada kayıtlı anıları kullanır ve ilgili olanları öne çıkarır.',
    page3Title: 'İpuçları',
    page3Body:
      'Kartı uzun basarak başka derse taşı. Çöp ikonuyla seçim moduna girip toplu sil. Kareler ile yeni ekran görüntülerini içe aktar, bayraklarla dili değiştir.',
  },
  header: {
    shotsOn: 'Kare açık',
    shots: 'Kareler',
    aiActive: 'YZ AÇIK',
  },
  lang: {
    en: 'EN',
    tr: 'TR',
  },
  a11y: {
    doneSelecting: 'Seçim bitti',
    selectToDelete: 'Silinecek anıları seç',
    aiPrivacy: 'YZ açık, gizlilik bilgisi',
    aiPrivacyHint: 'Not ve fotoğrafların nasıl işlendiğini açıklar',
    addMemory: 'Anı ekle',
    closePhoto: 'Tam ekran fotoğrafı kapat',
    close: 'Kapat',
    flipToFront: 'Kartın ön yüzüne dön',
  },
  search: {
    placeholder: 'Hafızana sor...',
    retryOnline: 'Çevrimiçi olunca arama düğmesine tekrar dokun.',
    processFailed: 'Bu isteği işleyemedim.',
  },
  folders: {
    all: 'Tümü',
    foldersClear: 'Klasörler: temizle',
    existingLessons: 'Mevcut dersler',
    newLesson: 'Yeni ders',
    filing: 'Sınıflandırma',
    noFoldersYet: 'Henüz klasör yok — aşağıdan oluştur.',
    lessonPlaceholder: 'Bu ders için ad…',
    lessonPlaceholderExample: 'örn. {{suggestion}}',
  },
  empty: {
    brainEmpty: 'Hafızan boş.',
    noLesson: 'Bu derste henüz anı yok.',
    shareHint: 'Diğer uygulamalardan kaydet: Paylaş → Synapse (dev sürümü gerekir, Expo Go değil).',
  },
  deleteToolbar: {
    hint: 'Seçmek için dokun; ders değiştirmek için karta uzun bas',
    noteOne: '{{count}} not',
    noteMany: '{{count}} not',
    folderOne: '{{count}} klasör',
    folderMany: '{{count}} klasör',
  },
  card: {
    tapFlipDetails: 'Çevir · Fotoğrafa çift dokun: büyüt',
    tapFlipNote: 'Çevir · Tam not ve bilgi',
    tapFlipBack: 'Öne dönmek için dokun',
    analyzing: 'Ekran görüntüsü analiz ediliyor…',
    details: 'Ayrıntılar',
    addedAt: "Synapse'e eklenme",
    source: 'Kaynak',
    folder: 'Klasör',
    status: 'Durum',
    statusCaptionPending: 'Açıklama hâlâ oluşturuluyor…',
    captionDetail: 'Açıklama ve detay',
    noteContext: 'Not ve yapay zekâ özeti',
    srcScreenshot: 'Ekran görüntüsü içe aktarma',
    srcShare: 'Başka uygulamadan paylaşıldı',
    srcPhoto: 'Fotoğraf',
    srcText: 'Metin notu',
  },
  addModal: {
    title: 'Hafızaya ekle',
    captionPlaceholder:
      'İsteğe bağlı açıklama — YZ gördüklerini aranabilir detay olarak ekler…',
    notePlaceholder: 'Not yaz, bağlantı yapıştır veya dök…',
    editByAi: 'YZ ile düzenle',
    editByAiSub:
      'Ders notu tarzını algılar; kaydederken başlık ve madde işaretleri düzenler{{imageHint}}',
    editByAiImageHint: ' (önce açıklaman)',
    paste: 'Yapıştır',
    processing: 'YZ işleniyor...',
    save: 'Kaydet',
    cropHint:
      'Foto seçerken sistem düzenleyicisi ile kırpıldı. Aşağıya açıklama ekle — YZ aranabilir detay ekler.',
  },
  folderPick: {
    fileTitle: 'Bu anıyı dosyala',
    explainer:
      'Var olan derse ekle, yeni ders oluştur veya klasörsüz kaydet.',
    createSave: 'Klasör oluştur ve kaydet',
    saveWithout: 'Klasörsüz kaydet',
    moveTitle: 'Derse taşı',
    moveExplainer:
      'Klasör seç veya etiketi kaldır. Anı silinmez — gerekirse üstteki çöp ile silebilirsin.',
    allBrain: 'Tüm hafıza — ders etiketini kaldır',
    createMove: 'Klasör oluştur ve buraya taşı',
    deleteFromSynapse: "Synapse'ten sil…",
  },
  delete: {
    title: "Synapse'ten silinsin mi?",
    titleBulk: 'Anılar silinsin mi?',
    cancel: 'İptal',
    confirmOne: 'Bu anı kaldırılır — galerindeki fotoğraflara dokunulmaz.',
    confirmMany:
      '{{count}} anı Synapse’ten silinsin mi? Fotoğrafsa galeride kalır.',
    confirmMemoriesSingle:
      'Boş ders klasörü “{{name}}” Synapse’ten kaldırılsın mı?',
    confirmMemoriesMany: '{{count}} boş ders klasörü kaldırılsın mı? ({{names}})',
    thisFolder: 'bu klasör',
    bulkMixed:
      '{{folderCount}} ders {{folderWord}}{{names}} ve içlerindeki {{memoryCount}} {{memoryWord}} silinecek (bu klasörlerdeki her şey dahil). Fotoğraflar galeride kalır; yalnızca Synapse temizlenir.',
    sheetOne:
      'Bu anı kaldırılır. Fotoğraf ve notlar yalnızca Synapse’ten silinir — galerine dokunulmaz.',
    sheetMany:
      '{{count}} anı silinsin mi? Yalnızca Synapse’ten kaldırılır — galeride kalır.',
  },
  errors: {
    cannotReachAi: 'YZ’ye ulaşılamıyor',
    unexpectedAiResponse: 'YZ beklenmedik bir yanıt döndü. Lütfen yeniden dene.',
    networkOffline: 'İnternet yok veya bağlantı koptu. Ağını kontrol edip tekrar dene.',
    rateLimited: 'YZ hizmeti meşgul veya hız sınırına takıldın. Biraz bekle ve tekrar dene.',
    shareModuleTitle: 'Paylaş',
    apiKeyBody:
      'Gemini anahtarın hatalı veya engelli olabilir. EXPO_PUBLIC_GEMINI_API_KEY’i kontrol et.',
    networkBody:
      'Google Gemini’ye ulaşılamadı. İnternet bağlantını kontrol et.',
    apiMissingTitle: 'API anahtarı yok',
    apiMissingBody:
      'synapse-mobile içinde .env dosyasına EXPO_PUBLIC_GEMINI_API_KEY ekle (.env.example’a bak), Expo’yu yeniden başlat.',
    trustTitle: 'Gizlilik öncelikli',
    trustBody:
      'Synapse’ta kaydettiğin not ve görseller cihazında kalır. Kütüphaneni saklayan, verini satan veya yüklediğin içeriği gezen bir Synapse sunucusu yoktur.\n\nYZ kullandığında (arama, foto açıklaması veya YZ ile düzenle) yalnızca o işlem için gereken metin veya tek görsel Google Gemini’ye gider. Arka planda ek sızıntı yoktur; uygulamaya koymadığın fotoğraflara bakılmaz.\n\nEkran görüntüsü içe aktarma yalnızca Kareleri açıp erişime izin verdiğinde çalışır; istediğin zaman kapatabilirsin. Anıları dilediğin zaman silebilirsin.',
    autoFileLessonTitle: 'Otomatik dosyalanamadı',
    autoFileLessonExtra:
      'Anı kayıtlı; YZ müsaitken uzun basarak derse taşıyabilirsin.',
    reorganizeTitle: 'Yeniden düzenlenemedi',
    reorganizeExtra:
      'Metnin olduğu gibi kaydedilir. Çevrimiçiyken YZ ile düzenlemeyi tekrar dene.',
    autoFileTitle: 'Otomatik dosyalanamadı',
    autoFileExtra: 'Aşağıdan ders seç veya klasörsüz kaydet.',
    saveMemoryTitle: 'Kaydedilemedi',
    saveMemoryExtra:
      'Hiçbir şey eklenmedi. Bağlantını kontrol et ve Kaydet’e tekrar bas.',
    captionFallback: 'Görsel açıklaması için orijinal yazını kullanıyorum.',
    importTitle: 'İçe aktarılamadı',
    importExtra:
      'Bağlantıyı kontrol et ve paylaşımı tekrar dene. Dosya paylaşıyorsan başka uygulama veya biçim dene.',
  },
  screenshot: {
    apiKeyTitle: 'API anahtarı gerekli',
    apiKeyBody:
      'Ekran görüntülerini YZ ile açıklamak için EXPO_PUBLIC_GEMINI_API_KEY gerekir.',
    devBuildTitle: 'Android’de Kareler için dev sürüm',
    devBuildBody:
      'Expo Go Android’de galeri erişimiyle ekran görüntüsü içe aktaramaz (Google izinleri). Geliştirme sürümü: npx expo run:android',
    photosTitle: 'Foto erişimi gerekli',
    photosBody: 'Yeni ekran görüntülerini bulmak için fotoğraf kitaplığı erişimi gerekir.',
    shotsOnTitle: 'Kareler açık',
    shotsOnBody: 'Uygulamayı açtığında veya döndüğünde yeni kareler eklenecek.',
    enableFailedTitle: 'Kareler açılamadı',
    syncTitle: 'Ekran görüntüsü eşitleme',
    syncTurnOff: 'Uygulamayı açınca yeni ekran görüntülerini içe aktarmayı durdur?',
    importTitle: 'Ekran görüntülerini içe aktar',
    importBody:
      'Synapse foto erişimi isteyecek; uygulamayı açınca veya geri dönünce galerideki yeni ekran görüntülerini ekler. İlk seferde mevcut kareler “görüldü” işaretlenir, tüm kitaplık yeniden taranmaz.',
    notDescribedTitle: 'Ekran görüntüsü açıklanamadı',
    notDescribedExtra:
      'Bağlantını kontrol et. Gemini ulaşılana kadar kareler YZ açıklaması olmadan kaydedilir.',
    introTitle: 'Ekran görüntüleri eşitlensin mi?',
    introBody:
      'Uygulamayı açınca yeni ekran görüntülerini Synapse’a aktar. Üstteki Kareler ile istediğin zaman kapatabilirsin.',
    unavailableLabel: 'Ekran görüntüsü (YZ kullanılamıyor)',
    analyzingContext: 'Ekran görüntüsü analiz ediliyor…',
    defaultContext: 'Ekran görüntüsü',
  },
  share: {
    sharedImage: 'Paylaşılan görsel',
    needKey:
      'Diğer uygulamalardan kaydetmek için .env içine EXPO_PUBLIC_GEMINI_API_KEY ekle.',
    badAttachment:
      'Şimdilik paylaşılan ekler resim olmalı. Fotoğraf, metin veya bağlantı paylaş.',
    empty: 'Bu paylaşım boş veya desteklenmiyor. Metin, bağlantı veya görsel paylaş.',
  },
  photos: {
    pickerTitle: 'Fotoğraflar',
    pickerBody: 'Görsel eklemek için fotoğraf kitaplığı erişimi gerekir.',
  },
  clipboard: {
    title: 'Pano',
    noImage: 'Panoda görsel yok.',
    readFail: 'Panodaki görsel okunamadı.',
    pasteFail: 'Panodan yapıştırılamadı.',
  },
  image: {
    noDescription: 'Açıklama olmadan görsel yüklendi.',
  },
};
