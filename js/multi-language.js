// JFlix Multi-Language Support
// Languages: English (en), Spanish (es), French (fr), Hindi (hi), Arabic (ar), Portuguese (pt)

const JFLIX_LANGS = {
  en: { name: 'English', flag: '🇬🇧', dir: 'ltr' },
  es: { name: 'Español', flag: '🇪🇸', dir: 'ltr' },
  fr: { name: 'Français', flag: '🇫🇷', dir: 'ltr' },
  hi: { name: 'हिन्दी', flag: '🇮🇳', dir: 'ltr' },
  ar: { name: 'العربية', flag: '🇸🇦', dir: 'rtl' },
  pt: { name: 'Português', flag: '🇵🇹', dir: 'ltr' }
};

const JFLIX_TRANSLATIONS = {
  en: {
    home: 'Home', movies: 'Movies', tvShows: 'TV Shows', anime: 'Anime', cartoons: 'Cartoons',
    search: 'Search movies, TV shows...', login: 'Login', signup: 'Sign Up', logout: 'Logout',
    profile: 'Profile', watchNow: 'Watch Now', watchFree: 'Watch for Free', play: 'Play',
    trending: 'Trending This Week', trendingNow: 'Trending Now', popular: 'Popular', topRated: 'Top Rated', upcoming: 'Upcoming',
    newReleases: 'New Releases', recommended: 'Recommended for You', continueWatching: 'Continue Watching',
    addToWatchlist: 'Add to Watchlist', share: 'Share', download: 'Download',
    subscribe: 'Subscribe', newsletter: 'Newsletter', enableNotifications: 'Enable Notifications',
    newMoviesAlert: 'New Movies Alert!', watchOnJFlix: 'Watch on JFlix',
    browseAll: 'Browse All', freeStreaming: 'Free Streaming', noSignup: 'No Signup Required',
    allMoviesFree: 'All Movies Free', discoverMore: 'Discover More',
    footerAbout: 'About', footerContact: 'Contact', footerPrivacy: 'Privacy Policy',
    footerTerms: 'Terms of Service', footerDMCA: 'DMCA', footerDisclaimer: 'Disclaimer',
    welcomeBack: 'Welcome Back', joinNow: 'Join Now', membersOnly: 'Members Only',
    premium: 'Premium', upgradeNow: 'Upgrade Now', closeAd: 'Close Ad',
    searching: 'Searching...', noResults: 'No results found', loading: 'Loading...',
    selectLanguage: 'Select Language', language: 'Language',
    tvSeries: 'TV Series', kDrama: 'K-Drama', koreanTV: 'Korean TV', pinoyMovies: 'Pinoy Movies',
    unlimitedStreaming: 'Unlimited Streaming', fullHDQuality: 'Full HD Quality', noAnnoyingAds: 'No Annoying Ads',
    menu: 'Menu', goToAniu: 'Go to ANIU', quickAccess: 'Quick Access',
    advancedFilters: 'Advanced Filters', filterByType: 'Filter by Type',
    allCountries: 'All Countries', allGenres: 'All Genres', allYears: 'All Years', all: 'All',
    action: 'Action', comedy: 'Comedy', horror: 'Horror', romance: 'Romance', sciFi: 'Sci-Fi', marvel: 'Marvel',
    resumeWhereYouLeftOff: 'Resume where you left off',
    jumpToPopularCategories: 'Jump to popular categories',
    whatEveryoneIsWatching: 'What everyone is watching',
    hottestAndMostRecentAnime: 'The hottest and most recent anime',
    popularAndAiringAnime: 'Popular & Airing Anime',
    loadingTrendingContent: 'Loading trending content...',
    loadingPopularAnime: 'Loading popular anime...',
    loadingAnimeMovies: 'Loading anime movies...',
    loadingCurrentlyAiringAnime: 'Loading currently airing anime...',
    loadingTopRatedAnime: 'Loading top rated anime...',
    animeMovie: 'ANIME MOVIE', animeSeries: 'ANIME SERIES',
    cartoonMovies: 'CARTOON MOVIES', cartoonSeries: 'CARTOON SERIES',
    watchFreeAnimeOnline: 'Watch Free Anime Online | JFlix Streaming',
    android: 'Android:'
  },
  es: {
    home: 'Inicio', movies: 'Películas', tvShows: 'Series de TV', anime: 'Anime', cartoons: 'Dibujos',
    search: 'Buscar películas, series...', login: 'Iniciar sesión', signup: 'Registrarse', logout: 'Cerrar sesión',
    profile: 'Perfil', watchNow: 'Ver Ahora', watchFree: 'Ver Gratis', play: 'Reproducir',
    trending: 'Tendencias Esta Semana', trendingNow: 'Tendencias Ahora', popular: 'Popular', topRated: 'Mejor Valoradas', upcoming: 'Próximamente',
    newReleases: 'Nuevos Lanzamientos', recommended: 'Recomendado para Ti', continueWatching: 'Continuar Viendo',
    addToWatchlist: 'Agregar a Lista', share: 'Compartir', download: 'Descargar',
    subscribe: 'Suscribirse', newsletter: 'Boletín', enableNotifications: 'Activar Notificaciones',
    newMoviesAlert: '¡Alerta de Nuevas Películas!', watchOnJFlix: 'Ver en JFlix',
    browseAll: 'Explorar Todo', freeStreaming: 'Streaming Gratis', noSignup: 'Sin Registro',
    allMoviesFree: 'Todas las Películas Gratis', discoverMore: 'Descubrir Más',
    footerAbout: 'Acerca de', footerContact: 'Contacto', footerPrivacy: 'Política de Privacidad',
    footerTerms: 'Términos de Servicio', footerDMCA: 'DMCA', footerDisclaimer: 'Aviso Legal',
    welcomeBack: 'Bienvenido de Nuevo', joinNow: 'Únete Ahora', membersOnly: 'Solo Miembros',
    premium: 'Premium', upgradeNow: 'Mejorar Ahora', closeAd: 'Cerrar Anuncio',
    searching: 'Buscando...', noResults: 'Sin resultados', loading: 'Cargando...',
    selectLanguage: 'Seleccionar Idioma', language: 'Idioma',
    tvSeries: 'Series de TV', kDrama: 'K-Drama', koreanTV: 'TV Coreana', pinoyMovies: 'Películas Filipinas',
    unlimitedStreaming: 'Streaming Ilimitado', fullHDQuality: 'Calidad Full HD', noAnnoyingAds: 'Sin Anuncios Molestos',
    menu: 'Menú', goToAniu: 'Ir a ANIU', quickAccess: 'Acceso Rápido',
    advancedFilters: 'Filtros Avanzados', filterByType: 'Filtrar por Tipo',
    allCountries: 'Todos los Países', allGenres: 'Todos los Géneros', allYears: 'Todos los Años', all: 'Todos',
    action: 'Acción', comedy: 'Comedia', horror: 'Terror', romance: 'Romance', sciFi: 'Ciencia Ficción', marvel: 'Marvel',
    resumeWhereYouLeftOff: 'Continúa donde lo dejaste',
    jumpToPopularCategories: 'Saltar a categorías populares',
    whatEveryoneIsWatching: 'Lo que todos están viendo',
    hottestAndMostRecentAnime: 'El anime más popular y reciente',
    popularAndAiringAnime: 'Anime Popular y en Emisión',
    loadingTrendingContent: 'Cargando contenido popular...',
    loadingPopularAnime: 'Cargando anime popular...',
    loadingAnimeMovies: 'Cargando películas de anime...',
    loadingCurrentlyAiringAnime: 'Cargando anime en emisión...',
    loadingTopRatedAnime: 'Cargando anime mejor valorado...',
    animeMovie: 'PELÍCULA ANIME', animeSeries: 'SERIE ANIME',
    cartoonMovies: 'PELÍCULAS DE DIBUJOS', cartoonSeries: 'SERIES DE DIBUJOS',
    watchFreeAnimeOnline: 'Ver Anime Gratis Online | JFlix Streaming',
    android: 'Android:'
  },
  fr: {
    home: 'Accueil', movies: 'Films', tvShows: 'Séries TV', anime: 'Anime', cartoons: 'Dessins Animés',
    search: 'Rechercher films, séries...', login: 'Connexion', signup: "S'inscrire", logout: 'Déconnexion',
    profile: 'Profil', watchNow: 'Regarder Maintenant', watchFree: 'Regarder Gratuitement', play: 'Lecture',
    trending: 'Tendances Cette Semaine', trendingNow: 'Tendances Maintenant', popular: 'Populaire', topRated: 'Mieux Notés', upcoming: 'À Venir',
    newReleases: 'Nouveautés', recommended: 'Recommandé pour Vous', continueWatching: 'Continuer à Regarder',
    addToWatchlist: 'Ajouter à la Liste', share: 'Partager', download: 'Télécharger',
    subscribe: "S'abonner", newsletter: 'Newsletter', enableNotifications: 'Activer les Notifications',
    newMoviesAlert: 'Alerte Nouveaux Films!', watchOnJFlix: 'Regarder sur JFlix',
    browseAll: 'Tout Parcourir', freeStreaming: 'Streaming Gratuit', noSignup: 'Sans Inscription',
    allMoviesFree: 'Tous les Films Gratuits', discoverMore: 'Découvrir Plus',
    footerAbout: 'À propos', footerContact: 'Contact', footerPrivacy: 'Politique de Confidentialité',
    footerTerms: "Conditions d'Utilisation", footerDMCA: 'DMCA', footerDisclaimer: 'Avertissement',
    welcomeBack: 'Bon Retour', joinNow: "Rejoindre Maintenant", membersOnly: 'Membres Uniquement',
    premium: 'Premium', upgradeNow: 'Améliorer Maintenant', closeAd: "Fermer l'Annonce",
    searching: 'Recherche...', noResults: 'Aucun résultat', loading: 'Chargement...',
    selectLanguage: 'Choisir la Langue', language: 'Langue',
    tvSeries: 'Séries TV', kDrama: 'K-Drama', koreanTV: 'TV Coréenne', pinoyMovies: 'Films Philippins',
    unlimitedStreaming: 'Streaming Illimité', fullHDQuality: 'Qualité Full HD', noAnnoyingAds: 'Sans Publicités Gênantes',
    menu: 'Menu', goToAniu: 'Aller à ANIU', quickAccess: 'Accès Rapide',
    advancedFilters: 'Filtres Avancés', filterByType: 'Filtrer par Type',
    allCountries: 'Tous les Pays', allGenres: 'Tous les Genres', allYears: 'Toutes les Années', all: 'Tous',
    action: 'Action', comedy: 'Comédie', horror: 'Horreur', romance: 'Romance', sciFi: 'Science-Fiction', marvel: 'Marvel',
    resumeWhereYouLeftOff: 'Reprenez où vous vous êtes arrêté',
    jumpToPopularCategories: 'Aller aux catégories populaires',
    whatEveryoneIsWatching: 'Ce que tout le monde regarde',
    hottestAndMostRecentAnime: "L'anime le plus populaire et récent",
    popularAndAiringAnime: 'Anime Populaire et en Cours',
    loadingTrendingContent: 'Chargement du contenu tendance...',
    loadingPopularAnime: "Chargement de l'anime populaire...",
    loadingAnimeMovies: 'Chargement des films d\'anime...',
    loadingCurrentlyAiringAnime: 'Chargement des animes en cours...',
    loadingTopRatedAnime: 'Chargement des animes les mieux notés...',
    animeMovie: 'FILM ANIME', animeSeries: 'SÉRIE ANIME',
    cartoonMovies: "FILMS D'ANIMATION", cartoonSeries: "SÉRIES D'ANIMATION",
    watchFreeAnimeOnline: 'Regarder Anime Gratuit | JFlix Streaming',
    android: 'Android:'
  },
  hi: {
    home: 'होम', movies: 'फिल्में', tvShows: 'टीवी शो', anime: 'एनीमे', cartoons: 'कार्टून',
    search: 'फिल्में, टीवी शो खोजें...', login: 'लॉगिन', signup: 'साइन अप', logout: 'लॉगआउट',
    profile: 'प्रोफ़ाइल', watchNow: 'अभी देखें', watchFree: 'मुफ्त देखें', play: 'चलाएं',
    trending: 'इस सप्ताह के ट्रेंडिंग', trendingNow: 'अभी ट्रेंडिंग', popular: 'लोकप्रिय', topRated: 'टॉप रेटेड', upcoming: 'आगामी',
    newReleases: 'नई रिलीज़', recommended: 'आपके लिए सुझाव', continueWatching: 'देखना जारी रखें',
    addToWatchlist: 'वॉचलिस्ट में जोड़ें', share: 'शेयर करें', download: 'डाउनलोड',
    subscribe: 'सब्सक्राइब', newsletter: 'न्यूज़लेटर', enableNotifications: 'नोटिफिकेशन चालू करें',
    newMoviesAlert: 'नई फिल्मों की चेतावनी!', watchOnJFlix: 'JFlix पर देखें',
    browseAll: 'सब देखें', freeStreaming: 'मुफ्त स्ट्रीमिंग', noSignup: 'साइन अप नहीं चाहिए',
    allMoviesFree: 'सभी फिल्में मुफ्त', discoverMore: 'और खोजें',
    footerAbout: 'हमारे बारे में', footerContact: 'संपर्क', footerPrivacy: 'गोपनीयता नीति',
    footerTerms: 'सेवा की शर्तें', footerDMCA: 'DMCA', footerDisclaimer: 'अस्वीकरण',
    welcomeBack: 'वापसी पर स्वागत है', joinNow: 'अभी जुड़ें', membersOnly: 'केवल सदस्य',
    premium: 'प्रीमियम', upgradeNow: 'अभी अपग्रेड करें', closeAd: 'विज्ञान बंद करें',
    searching: 'खोज रहे हैं...', noResults: 'कोई परिणाम नहीं', loading: 'लोड हो रहा है...',
    selectLanguage: 'भाषा चुनें', language: 'भाषा',
    tvSeries: 'टीवी श्रृंखला', kDrama: 'के-ड्रामा', koreanTV: 'कोरियन टीवी', pinoyMovies: 'फिलिपिनो फिल्में',
    unlimitedStreaming: 'असीमित स्ट्रीमिंग', fullHDQuality: 'फुल HD गुणवत्ता', noAnnoyingAds: 'परेशान करने वाले विज्ञान नहीं',
    menu: 'मेनू', goToAniu: 'ANIU पर जाएं', quickAccess: 'त्वरित पहुंच',
    advancedFilters: 'उन्नत फ़िल्टर', filterByType: 'प्रकार से फ़िल्टर',
    allCountries: 'सभी देश', allGenres: 'सभी शैलियाँ', allYears: 'सभी वर्ष', all: 'सभी',
    action: 'एक्शन', comedy: 'कॉमेडी', horror: 'डरावना', romance: 'रोमांस', sciFi: 'विज्ञान कथा', marvel: 'मार्वल',
    resumeWhereYouLeftOff: 'जहां छोड़ा था वहां से शुरू करें',
    jumpToPopularCategories: 'लोकप्रिय श्रेणियों पर जाएं',
    whatEveryoneIsWatching: 'सब क्या देख रहे हैं',
    hottestAndMostRecentAnime: 'सबसे लोकप्रिय और नवीनतम एनीमे',
    popularAndAiringAnime: 'लोकप्रिय और प्रसारित एनीमे',
    loadingTrendingContent: 'ट्रेंडिंग कंटेंट लोड हो रहा है...',
    loadingPopularAnime: 'लोकप्रिय एनीमे लोड हो रहा है...',
    loadingAnimeMovies: 'एनीमे फिल्में लोड हो रही हैं...',
    loadingCurrentlyAiringAnime: 'प्रसारित एनीमे लोड हो रहे हैं...',
    loadingTopRatedAnime: 'टॉप रेटेड एनीमे लोड हो रहे हैं...',
    animeMovie: 'एनीमे फिल्म', animeSeries: 'एनीमे श्रृंखला',
    cartoonMovies: 'कार्टून फिल्में', cartoonSeries: 'कार्टून श्रृंखला',
    watchFreeAnimeOnline: 'मुफ्त एनीमे ऑनलाइन देखें | JFlix Streaming',
    android: 'एंड्रॉइड:'
  },
  ar: {
    home: 'الرئيسية', movies: 'أفلام', tvShows: 'مسلسلات', anime: 'أنمي', cartoons: 'كرتون',
    search: 'ابحث عن أفلام، مسلسلات...', login: 'تسجيل الدخول', signup: 'إنشاء حساب', logout: 'تسجيل الخروج',
    profile: 'الملف الشخصي', watchNow: 'شاهد الآن', watchFree: 'شاهد مجاناً', play: 'تشغيل',
    trending: 'الأكثر رواجاً هذا الأسبوع', trendingNow: 'الأكثر رواجاً الآن', popular: 'شائع', topRated: 'الأعلى تقييماً', upcoming: 'قادم',
    newReleases: 'إصدارات جديدة', recommended: 'موصى به لك', continueWatching: 'متابعة المشاهدة',
    addToWatchlist: 'أضف إلى القائمة', share: 'مشاركة', download: 'تحميل',
    subscribe: 'اشترك', newsletter: 'النشرة الإخبارية', enableNotifications: 'تفعيل الإشعارات',
    newMoviesAlert: 'تنبيه أفلام جديدة!', watchOnJFlix: 'شاهد على JFlix',
    browseAll: 'تصفح الكل', freeStreaming: 'بث مجاني', noSignup: 'بدون تسجيل',
    allMoviesFree: 'جميع الأفلام مجانية', discoverMore: 'اكتشف المزيد',
    footerAbout: 'حول', footerContact: 'اتصل بنا', footerPrivacy: 'سياسة الخصوصية',
    footerTerms: 'شروط الخدمة', footerDMCA: 'DMCA', footerDisclaimer: 'إخلاء المسؤولية',
    welcomeBack: 'مرحباً بعودتك', joinNow: 'انضم الآن', membersOnly: 'للأعضاء فقط',
    premium: 'مميز', upgradeNow: 'ترقية الآن', closeAd: 'إغلاق الإعلان',
    searching: 'جاري البحث...', noResults: 'لا توجد نتائج', loading: 'جاري التحميل...',
    selectLanguage: 'اختر اللغة', language: 'اللغة',
    tvSeries: 'مسلسلات تلفزيونية', kDrama: 'الدراما الكورية', koreanTV: 'التلفزيون الكوري', pinoyMovies: 'أفلام فلبينية',
    unlimitedStreaming: 'بث غير محدود', fullHDQuality: 'جودة Full HD', noAnnoyingAds: 'بدون إعلانات مزعجة',
    menu: 'القائمة', goToAniu: 'اذهب إلى ANIU', quickAccess: 'وصول سريع',
    advancedFilters: 'فلاتر متقدمة', filterByType: 'تصفية حسب النوع',
    allCountries: 'جميع الدول', allGenres: 'جميع الأنواع', allYears: 'جميع السنوات', all: 'الكل',
    action: 'أكشن', comedy: 'كوميديا', horror: 'رعب', romance: 'رومانسي', sciFi: 'خيال علمي', marvel: 'مارفل',
    resumeWhereYouLeftOff: 'أكمل من حيث توقفت',
    jumpToPopularCategories: 'انتقل إلى الفئات الشائعة',
    whatEveryoneIsWatching: 'ما يشاهده الجميع',
    hottestAndMostRecentAnime: 'الأكثر شعبية وحداثة في الأنمي',
    popularAndAiringAnime: 'أنمي شائع وعُرض حالياً',
    loadingTrendingContent: 'جاري تحميل المحتوى الرائج...',
    loadingPopularAnime: 'جاري تحميل الأنمي الشائع...',
    loadingAnimeMovies: 'جاري تحميل أفلام الأنمي...',
    loadingCurrentlyAiringAnime: 'جاري تحميل الأنمي المعروض حالياً...',
    loadingTopRatedAnime: 'جاري تحميل الأنمي الأعلى تقييماً...',
    animeMovie: 'فيلم أنمي', animeSeries: 'مسلسل أنمي',
    cartoonMovies: 'أفلام كرتون', cartoonSeries: 'مسلسلات كرتون',
    watchFreeAnimeOnline: 'شاهد الأنمي مجاناً | JFlix Streaming',
    android: 'أندرويد:'
  },
  pt: {
    home: 'Início', movies: 'Filmes', tvShows: 'Séries de TV', anime: 'Anime', cartoons: 'Desenhos',
    search: 'Pesquisar filmes, séries...', login: 'Entrar', signup: 'Cadastrar', logout: 'Sair',
    profile: 'Perfil', watchNow: 'Assistir Agora', watchFree: 'Assistir Grátis', play: 'Reproduzir',
    trending: 'Tendências Esta Semana', trendingNow: 'Tendências Agora', popular: 'Popular', topRated: 'Mais Bem Avaliados', upcoming: 'Em Breve',
    newReleases: 'Novos Lançamentos', recommended: 'Recomendado para Você', continueWatching: 'Continuar Assistindo',
    addToWatchlist: 'Adicionar à Lista', share: 'Compartilhar', download: 'Baixar',
    subscribe: 'Inscrever-se', newsletter: 'Newsletter', enableNotifications: 'Ativar Notificações',
    newMoviesAlert: 'Alerta de Novos Filmes!', watchOnJFlix: 'Assistir no JFlix',
    browseAll: 'Navegar Tudo', freeStreaming: 'Streaming Grátis', noSignup: 'Sem Cadastro',
    allMoviesFree: 'Todos os Filmes Grátis', discoverMore: 'Descobrir Mais',
    footerAbout: 'Sobre', footerContact: 'Contato', footerPrivacy: 'Política de Privacidade',
    footerTerms: 'Termos de Serviço', footerDMCA: 'DMCA', footerDisclaimer: 'Aviso Legal',
    welcomeBack: 'Bem-vindo de Volta', joinNow: 'Junte-se Agora', membersOnly: 'Apenas Membros',
    premium: 'Premium', upgradeNow: 'Atualizar Agora', closeAd: 'Fechar Anúncio',
    searching: 'Pesquisando...', noResults: 'Nenhum resultado', loading: 'Carregando...',
    selectLanguage: 'Selecionar Idioma', language: 'Idioma',
    tvSeries: 'Séries de TV', kDrama: 'K-Drama', koreanTV: 'TV Coreana', pinoyMovies: 'Filmes Filipinos',
    unlimitedStreaming: 'Streaming Ilimitado', fullHDQuality: 'Qualidade Full HD', noAnnoyingAds: 'Sem Anúncios Irritantes',
    menu: 'Menu', goToAniu: 'Ir para ANIU', quickAccess: 'Acesso Rápido',
    advancedFilters: 'Filtros Avançados', filterByType: 'Filtrar por Tipo',
    allCountries: 'Todos os Países', allGenres: 'Todos os Gêneros', allYears: 'Todos os Anos', all: 'Todos',
    action: 'Ação', comedy: 'Comédia', horror: 'Terror', romance: 'Romance', sciFi: 'Ficção Científica', marvel: 'Marvel',
    resumeWhereYouLeftOff: 'Continue de onde parou',
    jumpToPopularCategories: 'Ir para categorias populares',
    whatEveryoneIsWatching: 'O que todos estão assistindo',
    hottestAndMostRecentAnime: 'O anime mais popular e recente',
    popularAndAiringAnime: 'Anime Popular e em Exibição',
    loadingTrendingContent: 'Carregando conteúdo em tendência...',
    loadingPopularAnime: 'Carregando anime popular...',
    loadingAnimeMovies: 'Carregando filmes de anime...',
    loadingCurrentlyAiringAnime: 'Carregando anime em exibição...',
    loadingTopRatedAnime: 'Carregando anime mais bem avaliado...',
    animeMovie: 'FILME ANIME', animeSeries: 'SÉRIE ANIME',
    cartoonMovies: 'FILMES DE DESENHOS', cartoonSeries: 'SÉRIES DE DESENHOS',
    watchFreeAnimeOnline: 'Assistir Anime Grátis Online | JFlix Streaming',
    android: 'Android:'
  }
};

// Get current language from localStorage or browser
function getCurrentLang() {
  let lang = localStorage.getItem('jflix_lang');
  if (!lang || !JFLIX_LANGS[lang]) {
    // Auto-detect from browser
    const browserLang = (navigator.language || 'en').substring(0, 2);
    lang = JFLIX_LANGS[browserLang] ? browserLang : 'en';
  }
  return lang;
}

// Translate a key
function t(key) {
  const lang = getCurrentLang();
  const translations = JFLIX_TRANSLATIONS[lang] || JFLIX_TRANSLATIONS.en;
  return translations[key] || JFLIX_TRANSLATIONS.en[key] || key;
}

// Set language and apply
function setLanguage(lang) {
  if (!JFLIX_LANGS[lang]) return;
  const previousLang = getCurrentLang();
  localStorage.setItem('jflix_lang', lang);

  // Set RTL for Arabic
  document.documentElement.dir = JFLIX_LANGS[lang].dir;
  document.documentElement.lang = lang;

  // Apply translations to current page
  applyTranslations();

  // Update switcher button text
  const switcherBtn = document.querySelector('#jflix-lang-switcher .jflix-lang-btn');
  if (switcherBtn) {
    switcherBtn.innerHTML = `<span class="lang-flag">${JFLIX_LANGS[lang].flag}</span><span class="lang-name">${JFLIX_LANGS[lang].name}</span><i class="fas fa-chevron-down lang-chevron"></i>`;
  }

  // Show toast notification
  showLanguageToast(lang);

  // Update dropdown active states
  document.querySelectorAll('#jflix-lang-switcher .lang-item').forEach(item => {
    item.classList.toggle('active', item.dataset.lang === lang);
  });
}

function showLanguageToast(lang) {
  const toast = document.createElement('div');
  toast.style.cssText = `
    position:fixed;top:70px;right:20px;z-index:99999;
    padding:12px 20px;border-radius:10px;
    background:rgba(19,19,31,0.95);border:1px solid rgba(255,255,255,0.15);
    color:#fff;font-family:Arial,sans-serif;font-size:13px;
    backdrop-filter:blur(10px);box-shadow:0 4px 20px rgba(0,0,0,0.3);
    opacity:0;transform:translateY(-10px);transition:all 0.3s ease;
  `;
  toast.innerHTML = `${JFLIX_LANGS[lang].flag} Language changed to <strong>${JFLIX_LANGS[lang].name}</strong>`;
  document.body.appendChild(toast);

  setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; }, 10);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(-10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Apply translations to elements with data-i18n attribute
// Build reverse lookup: English text → translation key
// This lets us find elements by their English text content and translate them
let _reverseMap = null;
function getReverseMap() {
  if (_reverseMap) return _reverseMap;
  _reverseMap = {};
  const en = JFLIX_TRANSLATIONS.en;
  for (const key in en) {
    _reverseMap[en[key].toLowerCase()] = key;
  }
  return _reverseMap;
}

// Store original English text of translated elements so we can switch back
const _translatedElements = new WeakMap();

function applyTranslations() {
  const lang = getCurrentLang();
  document.documentElement.lang = lang;
  document.documentElement.dir = JFLIX_LANGS[lang].dir;

  // 1. Translate elements with data-i18n attribute (explicit)
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const translated = t(key);
    if (translated && translated !== key) {
      el.textContent = translated;
    }
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const translated = t(key);
    if (translated && translated !== key) {
      el.placeholder = translated;
    }
  });

  // 2. Auto-translate by matching English text content
  // This is the key part that makes it work WITHOUT data-i18n attributes
  if (lang !== 'en') {
    autoTranslatePage(lang);
  } else {
    // Restore original English text
    restoreOriginalText();
  }
}

function autoTranslatePage(lang) {
  const reverseMap = getReverseMap();
  const translations = JFLIX_TRANSLATIONS[lang];
  if (!translations) return;

  // Elements to translate: nav items, buttons, headings, links, spans, labels
  const selectors = [
    'nav a', 'nav span', 'nav li',
    '.nav-item', '.nav-link', '.navbar a',
    'button', 'input[type="submit"]', 'input[type="button"]',
    'h1', 'h2', 'h3', 'h4', 'h5',
    'label', '.btn', '.button',
    '.section-title', '.section-header',
    'a.footer-link', '.footer a', '.footer-section a',
    '.modal-title', '.modal-header h2', '.modal-header h3',
    '.card-header h2', '.card-title',
    '.search-input', '.search-bar input',
    'input[placeholder]', 'textarea[placeholder]',
    '.category-link', '.filter-btn',
    '.hero-title', '.hero-description',
    '.badge', '.tag', '.label-text',
    '.empty-state', '.loading-text',
    'p.section-description', '.subtitle', '.description'
  ];

  const translatedTexts = new Set(); // Avoid double-translating

  document.querySelectorAll(selectors.join(',')).forEach(el => {
    // Skip if inside the language switcher itself
    if (el.closest('#jflix-lang-switcher')) return;
    // Skip if already has data-i18n (handled above)
    if (el.hasAttribute('data-i18n')) return;
    // Skip script/style elements
    if (el.tagName === 'SCRIPT' || el.tagName === 'STYLE') return;
    // Skip elements with child elements (only translate leaf text nodes)
    if (el.children.length > 0) {
      // Try to translate child text nodes
      translateTextNodes(el, reverseMap, translations, lang);
      return;
    }

    const originalText = el.textContent.trim();
    if (!originalText || originalText.length < 1) return;

    // Check if we already stored the original
    if (!_translatedElements.has(el)) {
      _translatedElements.set(el, originalText);
    }

    const storedOriginal = _translatedElements.get(el);
    const lowerText = storedOriginal.toLowerCase();

    if (reverseMap[lowerText]) {
      const key = reverseMap[lowerText];
      if (translations[key] && translations[key] !== storedOriginal) {
        el.textContent = translations[key];
      }
    }
  });

  // Translate placeholders
  document.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
    if (el.closest('#jflix-lang-switcher')) return;
    const originalPlaceholder = el.placeholder.trim();
    if (!originalPlaceholder) return;

    if (!_translatedElements.has(el)) {
      _translatedElements.set(el, { placeholder: originalPlaceholder });
    }

    const stored = _translatedElements.get(el);
    const lowerPlaceholder = (stored.placeholder || '').toLowerCase();

    if (reverseMap[lowerPlaceholder]) {
      const key = reverseMap[lowerPlaceholder];
      if (translations[key]) {
        el.placeholder = translations[key];
      }
    }
  });

  // Translate aria-labels and titles
  document.querySelectorAll('[aria-label], [title]').forEach(el => {
    if (el.closest('#jflix-lang-switcher')) return;
    const originalAria = el.getAttribute('aria-label');
    const originalTitle = el.getAttribute('title');
    if (originalAria) {
      const lower = originalAria.toLowerCase();
      if (reverseMap[lower]) {
        el.setAttribute('aria-label', translations[reverseMap[lower]]);
      }
    }
    if (originalTitle) {
      const lower = originalTitle.toLowerCase();
      if (reverseMap[lower]) {
        el.setAttribute('title', translations[reverseMap[lower]]);
      }
    }
  });

  // Translate document title
  translateDocumentTitle(lang);
}

function translateTextNodes(el, reverseMap, translations, lang) {
  el.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent.trim();
      if (!text) return;

      if (!_translatedElements.has(node)) {
        _translatedElements.set(node, text);
      }

      const stored = _translatedElements.get(node);
      const lower = stored.toLowerCase();

      if (reverseMap[lower]) {
        const key = reverseMap[lower];
        if (translations[key] && translations[key] !== stored) {
          node.textContent = translations[key];
        }
      }
    }
  });
}

function restoreOriginalText() {
  // Restore all text content
  document.querySelectorAll('*').forEach(el => {
    if (el.closest('#jflix-lang-switcher')) return;
    if (_translatedElements.has(el)) {
      const original = _translatedElements.get(el);
      if (typeof original === 'string') {
        el.textContent = original;
      } else if (typeof original === 'object' && original.placeholder) {
        el.placeholder = original.placeholder;
      }
    }
  });

  // Restore text nodes
  // Note: WeakMap doesn't allow iteration, so text nodes are restored via parent elements
  // This is a simplified restore — for full restore, we reload the page
}

function translateDocumentTitle(lang) {
  const translations = JFLIX_TRANSLATIONS[lang];
  if (!translations) return;

  const currentTitle = document.title;
  if (!_translatedElements.has(document)) {
    _translatedElements.set(document, { title: currentTitle });
  }

  const stored = _translatedElements.get(document);
  const originalTitle = stored.title || currentTitle;

  // Try to translate common title patterns
  const titleLower = originalTitle.toLowerCase();
  for (const key in JFLIX_TRANSLATIONS.en) {
    const enVal = JFLIX_TRANSLATIONS.en[key];
    if (titleLower.includes(enVal.toLowerCase())) {
      const translated = translations[key];
      if (translated && translated !== enVal) {
        document.title = originalTitle.replace(new RegExp(enVal, 'i'), translated);
      }
    }
  }
}

// Create language switcher dropdown — inject into navbar
function createLanguageSwitcher() {
  if (document.getElementById('jflix-lang-switcher')) return;

  const currentLang = getCurrentLang();

  // Inject CSS styles (with responsive rules) — only once
  if (!document.getElementById('jflix-lang-switcher-styles')) {
    const styleEl = document.createElement('style');
    styleEl.id = 'jflix-lang-switcher-styles';
    styleEl.textContent = `
.jflix-lang-nav{position:relative;display:inline-flex;align-items:center;flex-shrink:0;}
.jflix-lang-btn{
  display:flex;align-items:center;gap:5px;
  padding:6px 12px;border-radius:20px;
  background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);
  color:#fff;cursor:pointer;font-size:12px;font-family:inherit;
  transition:all 0.25s ease;white-space:nowrap;outline:none;
}
.jflix-lang-btn:hover{background:rgba(229,9,20,0.2);border-color:rgba(229,9,20,0.4);}
.jflix-lang-btn .lang-flag{font-size:14px;line-height:1;}
.jflix-lang-btn .lang-name{font-size:12px;font-weight:500;}
.jflix-lang-btn .lang-chevron{font-size:9px;margin-left:3px;opacity:0.7;}
.jflix-lang-dropdown{
  display:none;position:absolute;top:100%;right:0;margin-top:6px;
  background:rgba(19,19,31,0.98);border:1px solid rgba(255,255,255,0.15);
  border-radius:10px;overflow:hidden;min-width:160px;
  backdrop-filter:blur(10px);box-shadow:0 8px 30px rgba(0,0,0,0.5);
  z-index:10000;
}
.jflix-lang-dropdown .lang-item{
  display:flex;align-items:center;gap:8px;padding:10px 14px;
  cursor:pointer;color:#ccc;font-size:13px;font-family:Arial,sans-serif;
  transition:background 0.2s;
}
.jflix-lang-dropdown .lang-item:hover{background:rgba(255,255,255,0.05);}
.jflix-lang-dropdown .lang-item.active{background:rgba(229,9,20,0.15);color:#e50914;}
.jflix-lang-dropdown .lang-item .item-flag{font-size:16px;}

/* Mobile responsive — compact button beside logo in navbar-left */
@media(max-width:768px){
  .jflix-lang-nav{margin-left:6px;margin-right:2px;order:2 !important;}
  .jflix-lang-btn{
    padding:5px 8px;border-radius:16px;gap:3px;
    min-height:36px;min-width:36px;
    display:flex;align-items:center;justify-content:center;
  }
  .jflix-lang-btn .lang-name{display:none;}
  .jflix-lang-btn .lang-flag{font-size:18px;}
  .jflix-lang-btn .lang-chevron{font-size:8px;margin-left:2px;}
  .jflix-lang-dropdown{
    right:auto;left:0;min-width:140px;
    margin-top:4px;
  }
  .jflix-lang-dropdown .lang-item{padding:12px 14px;font-size:14px;}
}

/* Very small screens */
@media(max-width:400px){
  .jflix-lang-btn{padding:4px 6px;min-width:32px;min-height:32px;}
  .jflix-lang-btn .lang-flag{font-size:16px;}
  .jflix-lang-dropdown{min-width:130px;}
}

/* Tablet */
@media(min-width:769px) and (max-width:1024px){
  .jflix-lang-btn{padding:5px 10px;font-size:11px;}
  .jflix-lang-btn .lang-name{font-size:11px;}
}
`;
    document.head.appendChild(styleEl);
  }

  // Build the switcher element
  const switcher = document.createElement('div');
  switcher.id = 'jflix-lang-switcher';
  switcher.className = 'jflix-lang-nav';

  const button = document.createElement('button');
  button.className = 'jflix-lang-btn';
  button.innerHTML = `<span class="lang-flag">${JFLIX_LANGS[currentLang].flag}</span><span class="lang-name">${JFLIX_LANGS[currentLang].name}</span><i class="fas fa-chevron-down lang-chevron"></i>`;

  const dropdown = document.createElement('div');
  dropdown.className = 'jflix-lang-dropdown';

  Object.entries(JFLIX_LANGS).forEach(([code, info]) => {
    const item = document.createElement('div');
    item.className = 'lang-item' + (code === currentLang ? ' active' : '');
    item.dataset.lang = code;
    item.innerHTML = `<span class="item-flag">${info.flag}</span> <span>${info.name}</span>`;
    item.addEventListener('click', () => {
      setLanguage(code);
      dropdown.style.display = 'none';
      // Update active states
      dropdown.querySelectorAll('.lang-item').forEach(i => i.classList.remove('active'));
      item.classList.add('active');
    });
    dropdown.appendChild(item);
  });

  button.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
  });

  document.addEventListener('click', () => {
    dropdown.style.display = 'none';
  });

  switcher.appendChild(button);
  switcher.appendChild(dropdown);

  // Inject into navbar — placement depends on screen size
  // Mobile: beside the logo in navbar-left
  // Desktop: in navbar-right before auth-buttons
  function injectSwitcher() {
    // Remove from current parent first
    if (switcher.parentNode) switcher.parentNode.removeChild(switcher);

    const isMobile = window.matchMedia('(max-width: 768px)').matches;
    let injected = false;

    if (isMobile) {
      // Mobile: insert into navbar-left, right after the logo
      const navbarLeft = document.querySelector('.navbar-left');
      if (navbarLeft) {
        const logo = navbarLeft.querySelector('.logo, .logo-link');
        if (logo && logo.nextSibling) {
          navbarLeft.insertBefore(switcher, logo.nextSibling);
        } else if (logo) {
          navbarLeft.appendChild(switcher);
        } else {
          navbarLeft.appendChild(switcher);
        }
        injected = true;
      }
    }

    // Desktop (or mobile fallback): navbar-right before auth-buttons
    if (!injected) {
      const navbarRight = document.querySelector('.navbar-right');
      if (navbarRight) {
        const authButtons = navbarRight.querySelector('.auth-buttons');
        if (authButtons) {
          navbarRight.insertBefore(switcher, authButtons);
        } else {
          navbarRight.appendChild(switcher);
        }
        injected = true;
      }
    }

    // Fallback: try nav-links
    if (!injected) {
      const navLinks = document.querySelector('.nav-links');
      if (navLinks) {
        navLinks.appendChild(switcher);
        injected = true;
      }
    }

    // Fallback: try navbar
    if (!injected) {
      const navbar = document.querySelector('.navbar');
      if (navbar) {
        navbar.appendChild(switcher);
        injected = true;
      }
    }

    // Last resort: append to body but positioned in top-right
    if (!injected) {
      switcher.style.position = 'fixed';
      switcher.style.top = '15px';
      switcher.style.right = '15px';
      switcher.style.zIndex = '9998';
      document.body.appendChild(switcher);
    }
  }

  injectSwitcher();

  // Re-inject on resize (debounced) — moves between navbar-left and navbar-right
  let resizeTimer = null;
  window.addEventListener('resize', function () {
    if (resizeTimer) clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      // Only re-inject if the switcher still exists
      if (document.getElementById('jflix-lang-switcher')) {
        injectSwitcher();
      }
    }, 200);
  });
}

// Initialize on page load
function initMultiLanguage() {
  applyTranslations();
  createLanguageSwitcher();

  // Re-translate when dynamic content is added (TMDB loads content via JS)
  if (getCurrentLang() !== 'en') {
    let translateTimer = null;
    const observer = new MutationObserver(() => {
      if (translateTimer) clearTimeout(translateTimer);
      translateTimer = setTimeout(() => {
        applyTranslations();
      }, 500);
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMultiLanguage);
} else {
  initMultiLanguage();
}
