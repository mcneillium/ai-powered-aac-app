// App.js — Root component for the AAC app.
//
// Child-friendly navigation: 5 tabs max, large icons, 1-word labels.
// Tabs: Talk (AAC Board), Feel (Emotion), Look (Camera), Words (QuickPhrases), More (menu)
// All other screens accessible via stack navigation from "More" or headers.

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity, Platform, AppState, ScrollView, Text, InteractionManager } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider } from './src/contexts/AuthContext';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { getPalette } from './src/theme';
import ErrorBoundary, { ScreenErrorBoundary } from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import QuickRepairOverlay from './src/components/QuickRepairOverlay';
import CrisisOverlay from './src/components/CrisisOverlay';
import ListenerDisplay from './src/components/ListenerDisplay';
import PartnerCoachOverlay from './src/components/PartnerCoachOverlay';
import SymbolImage from './src/components/SymbolImage';

// Screens
import AACBoardScreen from './src/screens/AACBoardScreen';
import ContextPackScreen from './src/screens/ContextPackScreen';
import EasySentenceBuilderScreen from './src/screens/EasySentenceBuilderScreen';
import EmotionScreen from './src/screens/EmotionScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CameraScreen from './src/screens/CameraScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import VocabManagerScreen from './src/screens/VocabManagerScreen';
import SocialScreen from './src/screens/SocialScreen';
import QuickPhrasesScreen from './src/screens/QuickPhrasesScreen';
import LiveSceneModeScreen from './src/screens/LiveSceneModeScreen';
import CommunicationScreen from './src/screens/CommunicationScreen';

// Non-blocking startup
import { loadImprovedModel } from './src/services/improvedModelLoader';
import { loadAIProfile, recordSessionStart, flushAIProfile } from './src/services/aiProfileStore';
import { loadCustomVocab } from './src/services/customVocabStore';
import { loadAlertState } from './src/services/caregiverAlerts';
import { runPrecacheIfNeeded } from './src/services/symbolCacheService';
import { loadFavorites } from './src/services/favoritesService';
import { loadCustomBoards } from './src/services/customBoardsService';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

loadImprovedModel().catch(() => {});
loadAIProfile()
  .then(() => recordSessionStart())
  .catch(() => {});
loadCustomVocab().catch(() => {});
loadAlertState().catch(() => {});
loadFavorites().catch(() => {});
loadCustomBoards().catch(() => {});

// Pre-cache symbols in background after animations settle
InteractionManager.runAfterInteractions(() => {
  runPrecacheIfNeeded(null).catch(() => {});
});

AppState.addEventListener('change', state => {
  if (state === 'background' || state === 'inactive') {
    flushAIProfile().catch(() => {});
  }
});

// Tab icon hexcodes (OpenMoji)
const TAB_HEXCODES = {
  Talk: '1F4AC',
  Feel: '1F60A',
  Look: '1F4F7',
  Words: '1F4D6',
  More: '2699',
};

// Fallback Ionicons for when OpenMoji symbols aren't available
const TAB_ICONS_FALLBACK = {
  Talk: 'chatbubble-ellipses',
  Feel: 'happy',
  Look: 'camera',
  Words: 'book',
  More: 'menu',
};

function TabIcon({ route, color, focused }) {
  const hex = TAB_HEXCODES[route.name];
  if (hex) {
    return (
      <View style={focused ? styles.tabIconFocused : undefined}>
        <SymbolImage hexcode={hex} size={32} />
      </View>
    );
  }
  return <Ionicons name={TAB_ICONS_FALLBACK[route.name] || 'help-outline'} size={28} color={color} />;
}

function SettingsHeaderButton({ tintColor, navigation }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      style={styles.headerBtn}
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Ionicons name="settings-outline" size={22} color={tintColor} />
    </TouchableOpacity>
  );
}

// "More" screen — simple menu for caregiver/secondary screens
function MoreScreen({ navigation }) {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  const menuItems = [
    { label: 'Profile', icon: 'person-outline', screen: 'ProfileModal' },
    { label: 'Settings', icon: 'settings-outline', screen: 'Settings' },
    { label: 'Vocabulary', icon: 'library-outline', screen: 'VocabManager' },
    { label: 'Insights', icon: 'analytics-outline', screen: 'Insights' },
    { label: 'Situations', icon: 'apps-outline', screen: 'ContextPack' },
    { label: 'Sentences', icon: 'text-outline', screen: 'SentenceBuilder' },
    { label: 'Social', icon: 'chatbubbles-outline', screen: 'Social' },
    { label: 'Pictures', icon: 'images-outline', screen: 'Communication' },
    { label: 'Feedback', icon: 'mail-outline', screen: 'Feedback' },
  ];

  return (
    <ScrollView style={[styles.moreContainer, { backgroundColor: palette.background }]} contentContainerStyle={styles.moreContent}>
      {menuItems.map(item => (
        <TouchableOpacity
          key={item.screen}
          style={[styles.moreItem, { backgroundColor: palette.cardBg, borderColor: palette.border }]}
          onPress={() => navigation.navigate(item.screen)}
          accessibilityRole="button"
          accessibilityLabel={item.label}
        >
          <View style={[styles.moreIconBg, { backgroundColor: palette.primary + '22' }]}>
            <Ionicons name={item.icon} size={28} color={palette.primary} />
          </View>
          <Text style={[styles.moreLabel, { color: palette.text }]}>{item.label}</Text>
          <Ionicons name="chevron-forward" size={22} color={palette.textSecondary} />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function MainApp() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  return (
    <>
      <Tab.Navigator
        screenOptions={({ route, navigation }) => ({
          headerStyle: { backgroundColor: palette.tabBarBg },
          headerTintColor: palette.text,
          headerTitleStyle: { color: palette.text, fontWeight: '600' },
          headerRight: () => (
            <SettingsHeaderButton tintColor={palette.text} navigation={navigation} />
          ),
          tabBarActiveTintColor: palette.tabBarActive,
          tabBarInactiveTintColor: palette.tabBarInactive,
          tabBarStyle: {
            backgroundColor: palette.tabBarBg,
            borderTopWidth: 0,
            elevation: 8,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -2 },
            shadowOpacity: 0.12,
            shadowRadius: 4,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            position: 'absolute',
            height: 70 + insets.bottom,
            paddingBottom: insets.bottom,
            paddingTop: 6,
          },
          tabBarLabelStyle: {
            fontSize: 13,
            fontWeight: '700',
            marginTop: 2,
          },
          tabBarIcon: ({ color, focused }) => (
            <TabIcon route={route} color={color} focused={focused} />
          ),
          tabBarAccessibilityLabel: `${route.name} tab`,
        })}
      >
        <Tab.Screen
          name="Talk"
          component={AACBoardScreen}
          options={{ title: 'Talk' }}
        />
        <Tab.Screen
          name="Feel"
          component={EmotionScreen}
          options={{ title: 'Feel' }}
        />
        <Tab.Screen
          name="Look"
          component={CameraScreen}
          options={{ title: 'Look' }}
        />
        <Tab.Screen
          name="Words"
          component={QuickPhrasesScreen}
          options={{ title: 'Words' }}
        />
        <Tab.Screen
          name="More"
          component={MoreScreen}
          options={{ title: 'More' }}
        />
      </Tab.Navigator>
      <QuickRepairOverlay />
      <CrisisOverlay />
      <PartnerCoachOverlay />
      <ListenerDisplay />
    </>
  );
}

function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const [hasLaunched, setHasLaunched] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('hasLaunched').then(val => {
      setHasLaunched(val === 'true');
    }).catch(() => {
      setHasLaunched(false);
    });
  }, []);

  if (hasLaunched === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2979FF" />
      </View>
    );
  }

  if (!hasLaunched) {
    return <OnboardingScreen onComplete={() => setHasLaunched(true)} />;
  }

  return <MainApp />;
}

function RootNavigator() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.tabBarBg },
        headerTintColor: palette.text,
      }}
    >
      <RootStack.Screen name="App" component={AppNavigator} options={{ headerShown: false }} />
      <RootStack.Screen name="Settings" options={{ title: 'Settings' }}>
        {() => <ScreenErrorBoundary screenName="Settings"><SettingsScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="Feedback" options={{ title: 'Feedback' }}>
        {() => <ScreenErrorBoundary screenName="Feedback"><FeedbackScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="Camera" options={{ title: 'Camera' }}>
        {() => <ScreenErrorBoundary screenName="Camera"><CameraScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="Insights" options={{ title: 'Insights' }}>
        {() => <ScreenErrorBoundary screenName="Insights"><InsightsScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="VocabManager" options={{ title: 'Vocabulary' }}>
        {() => <ScreenErrorBoundary screenName="VocabManager"><VocabManagerScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="Social" options={{ title: 'Social' }}>
        {() => <ScreenErrorBoundary screenName="Social"><SocialScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="QuickPhrases" options={{ title: 'Quick Phrases' }}>
        {() => <ScreenErrorBoundary screenName="QuickPhrases"><QuickPhrasesScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="ProfileModal" options={{ title: 'Profile' }}>
        {() => <ScreenErrorBoundary screenName="Profile"><ProfileScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="ContextPack" options={{ title: 'Situations' }}>
        {() => <ScreenErrorBoundary screenName="ContextPack"><ContextPackScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="SentenceBuilder" options={{ title: 'Sentences' }}>
        {() => <ScreenErrorBoundary screenName="SentenceBuilder"><EasySentenceBuilderScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="Communication" options={{ title: 'Pictures' }}>
        {() => <ScreenErrorBoundary screenName="Communication"><CommunicationScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="LiveScene" options={{ title: 'Live Scene' }}>
        {() => <ScreenErrorBoundary screenName="LiveScene"><LiveSceneModeScreen /></ScreenErrorBoundary>}
      </RootStack.Screen>
      <RootStack.Screen name="Login" component={AuthStackScreen} options={{ headerShown: false, presentation: 'modal' }} />
    </RootStack.Navigator>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <SettingsProvider>
          <NetworkProvider>
            <SafeAreaProvider>
              <OfflineBanner />
              <NavigationContainer>
                <RootNavigator />
              </NavigationContainer>
            </SafeAreaProvider>
          </NetworkProvider>
        </SettingsProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  headerBtn: {
    marginRight: Platform.OS === 'ios' ? 16 : 12,
    padding: 4,
  },
  tabIconFocused: {
    backgroundColor: '#2979FF18',
    borderRadius: 12,
    padding: 2,
  },
  moreContainer: { flex: 1 },
  moreContent: { padding: 16, paddingBottom: 100 },
  moreItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    gap: 14,
  },
  moreIconBg: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreLabel: { flex: 1, fontSize: 18, fontWeight: '600' },
});
