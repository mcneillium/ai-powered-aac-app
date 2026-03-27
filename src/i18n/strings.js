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
