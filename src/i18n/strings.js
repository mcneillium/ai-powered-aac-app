// src/i18n/strings.js
// Centralized UI strings for internationalization.
// All user-facing text should import from here.
//
// Architecture: Simple key-value lookup per language.
// Add new languages by adding a new object to STRINGS.
// The active language comes from user settings.
//
// This is the foundation — screens should migrate to using
// t('key') instead of hardcoded English strings over time.

const STRINGS = {
  en: {
    // App-wide
    appName: 'Voice',
    tagline: 'communication for everyone',

    // Navigation
    tabCommunicate: 'Communicate',
    tabSentence: 'Sentence',
    tabEmotion: 'Emotion',
    tabProfile: 'Profile',
    tabContexts: 'Contexts',

    // AAC Board
    tapToSpeak: 'Tap words to build a sentence',
    speakSentence: 'Speak',
    clearSentence: 'Clear',
    deleteLastWord: 'Delete last word',
    sentenceHistory: 'Recent Sentences',
    favourites: 'Favourites',
    noFavourites: 'No favourites yet. Build a sentence and tap the star to save it.',
    noHistory: 'No history yet. Speak a sentence to save it here.',
    suggestions: 'Suggestions',
    addToFavourites: 'Add to favourites',
    removeFromFavourites: 'Remove from favourites',
    showFavourites: 'Show favourites',
    hideFavourites: 'Hide favourites',
    showHistory: 'Show sentence history',
    hideHistory: 'Hide sentence history',
    openCamera: 'Open camera to describe what you see',
    showOnScreen: 'Show sentence on full screen for your conversation partner',
    goToPage: 'Go to',
    goBack: 'Go back',
    goHome: 'Go to home page',
    sentence: 'Sentence',

    // Quick Repair
    quickPhrases: 'Quick Phrases',
    closeQuickPhrases: 'Close quick phrases',
    quickPhrasesHint: 'Opens quick repair phrase panel',
    quickPhrasesLabel: 'Quick phrases. Tap for instant communication repair phrases like wait, yes, no, help.',
    scanningSelectHint: 'Scanning — tap or press switch to select',

    // Context Packs
    chooseContext: 'Choose a context',
    chooseContextHint: 'Tap a situation above to see relevant phrases',
    contextPack: 'context pack',

    // Display Mode
    displayMode: 'Display Mode',
    listenerMode: 'Listener Mode',
    waitingForSpeech: 'Waiting for speech...',
    noSentenceToDisplay: 'No sentence to display',
    tapToClose: 'Tap anywhere to close',
    tapToCloseLabel: 'Tap anywhere to close display mode',

    // Voice Presets
    voiceStyle: 'Voice style',

    // Scanning
    scan: 'Scan',
    scanning: 'Scanning',
    startScanning: 'Start switch scanning',
    stopScanning: 'Stop switch scanning',
    scanNext: 'Next',
    scanSelect: 'Select',
    scanSlower: 'Slower',
    scanFaster: 'Faster',
    scanAuto: 'Auto',
    scanStep: 'Step',

    // Emotions
    iAm: 'I am',
    speakEmotion: 'Speak',
    saveEmotion: 'Save',

    // Auth
    logIn: 'Log In',
    signUp: 'Create Account',
    logOut: 'Log Out',
    forgotPassword: 'Forgot password?',
    guestMode: 'Guest Mode',
    deleteAccount: 'Delete Account',

    // Settings
    settings: 'Settings',
    theme: 'Theme',
    gridSize: 'Grid Size',
    speechRate: 'Speech Speed',
    speechPitch: 'Speech Pitch',
    voice: 'Voice',
    aiPersonalisation: 'AI Personalisation',
    resetAIData: 'Reset AI Data',
    privacyPolicy: 'Privacy Policy',
    sendFeedback: 'Send Feedback',

    // Camera
    camera: 'Camera',
    gallery: 'Gallery',
    sayAboutThis: 'Say something about this:',

    // Common
    yes: 'Yes',
    no: 'No',
    cancel: 'Cancel',
    ok: 'OK',
    error: 'Error',
    loading: 'Loading...',
    offline: 'Offline — communication still works',
  },

  es: {
    appName: 'Voice',
    tagline: 'comunicación para todos',
    tabCommunicate: 'Comunicar',
    tabSentence: 'Frase',
    tabEmotion: 'Emoción',
    tabProfile: 'Perfil',
    tabContexts: 'Contextos',
    tapToSpeak: 'Toca palabras para construir una frase',
    speakSentence: 'Hablar',
    clearSentence: 'Borrar',
    deleteLastWord: 'Borrar última palabra',
    sentenceHistory: 'Frases recientes',
    favourites: 'Favoritos',
    noFavourites: 'Sin favoritos todavía. Construye una frase y toca la estrella para guardarla.',
    noHistory: 'Sin historial todavía. Di una frase para guardarla aquí.',
    suggestions: 'Sugerencias',
    addToFavourites: 'Añadir a favoritos',
    removeFromFavourites: 'Quitar de favoritos',
    showFavourites: 'Mostrar favoritos',
    hideFavourites: 'Ocultar favoritos',
    showHistory: 'Mostrar historial',
    hideHistory: 'Ocultar historial',
    openCamera: 'Abrir cámara para describir lo que ves',
    showOnScreen: 'Mostrar frase en pantalla completa',
    goToPage: 'Ir a',
    goBack: 'Volver',
    goHome: 'Ir a inicio',
    sentence: 'Frase',
    quickPhrases: 'Frases rápidas',
    closeQuickPhrases: 'Cerrar frases rápidas',
    quickPhrasesHint: 'Abre panel de frases rápidas',
    quickPhrasesLabel: 'Frases rápidas. Toca para frases de reparación como espera, sí, no, ayuda.',
    scanningSelectHint: 'Escaneando — toca o presiona para seleccionar',
    chooseContext: 'Elige un contexto',
    chooseContextHint: 'Toca una situación arriba para ver frases relevantes',
    contextPack: 'paquete de contexto',
    displayMode: 'Modo pantalla',
    listenerMode: 'Modo oyente',
    waitingForSpeech: 'Esperando habla...',
    noSentenceToDisplay: 'No hay frase para mostrar',
    tapToClose: 'Toca para cerrar',
    tapToCloseLabel: 'Toca en cualquier lugar para cerrar',
    voiceStyle: 'Estilo de voz',
    scan: 'Escanear',
    scanning: 'Escaneando',
    startScanning: 'Iniciar escaneo',
    stopScanning: 'Detener escaneo',
    scanNext: 'Siguiente',
    scanSelect: 'Seleccionar',
    scanSlower: 'Más lento',
    scanFaster: 'Más rápido',
    scanAuto: 'Auto',
    scanStep: 'Paso',
    iAm: 'Estoy',
    speakEmotion: 'Hablar',
    saveEmotion: 'Guardar',
    logIn: 'Iniciar sesión',
    signUp: 'Crear cuenta',
    logOut: 'Cerrar sesión',
    forgotPassword: '¿Olvidaste tu contraseña?',
    guestMode: 'Modo invitado',
    deleteAccount: 'Eliminar cuenta',
    settings: 'Ajustes',
    theme: 'Tema',
    gridSize: 'Tamaño de cuadrícula',
    speechRate: 'Velocidad del habla',
    speechPitch: 'Tono del habla',
    voice: 'Voz',
    aiPersonalisation: 'Personalización IA',
    resetAIData: 'Restablecer datos IA',
    privacyPolicy: 'Política de privacidad',
    sendFeedback: 'Enviar comentarios',
    camera: 'Cámara',
    gallery: 'Galería',
    sayAboutThis: 'Di algo sobre esto:',
    yes: 'Sí',
    no: 'No',
    cancel: 'Cancelar',
    ok: 'OK',
    error: 'Error',
    loading: 'Cargando...',
    offline: 'Sin conexión — la comunicación sigue funcionando',
  },

  fr: {
    appName: 'Voice',
    tagline: 'communication pour tous',
    tabCommunicate: 'Communiquer',
    tabSentence: 'Phrase',
    tabEmotion: 'Émotion',
    tabProfile: 'Profil',
    tabContexts: 'Contextes',
    tapToSpeak: 'Touchez des mots pour construire une phrase',
    speakSentence: 'Parler',
    clearSentence: 'Effacer',
    deleteLastWord: 'Supprimer le dernier mot',
    sentenceHistory: 'Phrases récentes',
    favourites: 'Favoris',
    noFavourites: 'Pas encore de favoris.',
    noHistory: 'Pas encore d\'historique.',
    suggestions: 'Suggestions',
    addToFavourites: 'Ajouter aux favoris',
    removeFromFavourites: 'Retirer des favoris',
    showFavourites: 'Afficher les favoris',
    hideFavourites: 'Masquer les favoris',
    showHistory: 'Afficher l\'historique',
    hideHistory: 'Masquer l\'historique',
    goBack: 'Retour',
    goHome: 'Accueil',
    voiceStyle: 'Style de voix',
    startScanning: 'Démarrer le balayage',
    stopScanning: 'Arrêter le balayage',
    iAm: 'Je suis',
    speakEmotion: 'Parler',
    logIn: 'Se connecter',
    signUp: 'Créer un compte',
    logOut: 'Se déconnecter',
    settings: 'Paramètres',
    yes: 'Oui',
    no: 'Non',
    cancel: 'Annuler',
    ok: 'OK',
    loading: 'Chargement...',
    offline: 'Hors ligne — la communication fonctionne toujours',
  },
  de: {
    appName: 'Voice',
    tagline: 'Kommunikation für alle',
    tabCommunicate: 'Kommunizieren',
    tabSentence: 'Satz',
    tabEmotion: 'Gefühl',
    tabProfile: 'Profil',
    tabContexts: 'Kontexte',
    tapToSpeak: 'Wörter antippen, um einen Satz zu bilden',
    speakSentence: 'Sprechen',
    clearSentence: 'Löschen',
    deleteLastWord: 'Letztes Wort löschen',
    sentenceHistory: 'Letzte Sätze',
    favourites: 'Favoriten',
    noFavourites: 'Noch keine Favoriten.',
    noHistory: 'Noch kein Verlauf.',
    suggestions: 'Vorschläge',
    addToFavourites: 'Zu Favoriten hinzufügen',
    removeFromFavourites: 'Aus Favoriten entfernen',
    showFavourites: 'Favoriten anzeigen',
    hideFavourites: 'Favoriten ausblenden',
    showHistory: 'Verlauf anzeigen',
    hideHistory: 'Verlauf ausblenden',
    goBack: 'Zurück',
    goHome: 'Startseite',
    voiceStyle: 'Sprachstil',
    startScanning: 'Scannen starten',
    stopScanning: 'Scannen stoppen',
    iAm: 'Ich bin',
    speakEmotion: 'Sprechen',
    logIn: 'Anmelden',
    signUp: 'Konto erstellen',
    logOut: 'Abmelden',
    settings: 'Einstellungen',
    yes: 'Ja',
    no: 'Nein',
    cancel: 'Abbrechen',
    ok: 'OK',
    loading: 'Laden...',
    offline: 'Offline — Kommunikation funktioniert weiterhin',
  },
  pt: {
    appName: 'Voice',
    tagline: 'comunicação para todos',
    tapToSpeak: 'Toque em palavras para construir uma frase',
    speakSentence: 'Falar',
    clearSentence: 'Limpar',
    deleteLastWord: 'Apagar última palavra',
    favourites: 'Favoritos',
    suggestions: 'Sugestões',
    goBack: 'Voltar',
    goHome: 'Início',
    settings: 'Configurações',
    yes: 'Sim',
    no: 'Não',
    cancel: 'Cancelar',
    ok: 'OK',
    loading: 'Carregando...',
    offline: 'Offline — a comunicação continua funcionando',
  },
  ar: {
    appName: 'Voice',
    tagline: 'التواصل للجميع',
    tapToSpeak: 'اضغط على الكلمات لبناء جملة',
    speakSentence: 'تحدث',
    clearSentence: 'مسح',
    deleteLastWord: 'حذف آخر كلمة',
    favourites: 'المفضلة',
    suggestions: 'اقتراحات',
    goBack: 'رجوع',
    goHome: 'الرئيسية',
    settings: 'الإعدادات',
    yes: 'نعم',
    no: 'لا',
    cancel: 'إلغاء',
    ok: 'حسناً',
    loading: '...جاري التحميل',
    offline: 'غير متصل — التواصل لا يزال يعمل',
  },
};

let currentLanguage = 'en';

/**
 * Set the active language.
 */
export function setLanguage(lang) {
  if (STRINGS[lang]) {
    currentLanguage = lang;
  }
}

/**
 * Get the current language code.
 */
export function getLanguage() {
  return currentLanguage;
}

/**
 * Get available language codes.
 */
export function getAvailableLanguages() {
  return Object.keys(STRINGS);
}

/**
 * Translate a key to the current language.
 * Falls back to English if key is missing in current language.
 */
export function t(key) {
  return STRINGS[currentLanguage]?.[key] || STRINGS.en?.[key] || key;
}
