// App.js
// Root component for the AAC app.
//
// Architecture decisions:
// 1. AAC Board is available WITHOUT login (offline-first communication)
// 2. Auth is optional — enables sync, logging, and caregiver features
// 3. Error boundary wraps the entire app to prevent total crash
// 4. Model loading is non-blocking — app renders immediately
// 5. QuickRepairOverlay floats above all screens for instant phrase access
// 6. Shared theme from src/theme.js — no inline palette objects

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, AppState, View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider } from './src/contexts/AuthContext';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { getPalette } from './src/theme';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';
import QuickRepairOverlay from './src/components/QuickRepairOverlay';

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
import CameraScreen from './src/screens/CameraScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import VocabManagerScreen from './src/screens/VocabManagerScreen';
import LicensesScreen from './src/screens/LicensesScreen';
import StudioBoardScreen from './src/screens/StudioBoardScreen';
import StudioScreen from './src/screens/StudioScreen';
import WelcomeSheet from './src/components/studio/WelcomeSheet';
import { getScheme } from './src/design/tokens';

// On-device prediction (pure JS; no model download, no TensorFlow at startup)
import { initPrediction, flushPrediction } from './src/services/suggestionEngine';
import { loadAIProfile, recordSessionStart, flushAIProfile } from './src/services/aiProfileStore';
import { loadCustomVocab } from './src/services/customVocabStore';
import { loadPronunciations } from './src/services/pronunciationStore';
import { loadTilePhotos } from './src/services/tilePhotoStore';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// Load any personal prediction data in the background — suggestions already
// work from the built-in model before this finishes.
initPrediction();

// Load AI profile and record session start
loadAIProfile()
  .then(() => recordSessionStart())
  .catch(err => console.warn('AI profile load failed (non-blocking):', err));
loadCustomVocab().catch(err => console.warn('Custom vocab load failed (non-blocking):', err));
loadPronunciations().catch(err => console.warn('Pronunciation load failed (non-blocking):', err));
loadTilePhotos().catch(() => {});

const TAB_ICONS = {
  'AAC Board': 'grid-outline',
  'Contexts': 'apps-outline',
  'Sentence': 'text-outline',
  'Emotion': 'happy-outline',
  'Profile': 'person-outline',
};

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

// Voice 2 navigation: four destinations, styled with the design tokens.
const STUDIO_TAB_ICONS = {
  Talk: 'chatbubble-ellipses-outline',
  Phrases: 'albums-outline',
  Personalise: 'color-palette-outline',
  Me: 'person-circle-outline',
};

function StudioApp() {
  const { settings } = useSettings();
  const c = getScheme(settings.theme);
  return (
    <Tab.Navigator
      screenOptions={({ route, navigation }) => ({
        headerStyle: { backgroundColor: c.paper },
        headerShadowVisible: false,
        headerTintColor: c.ink,
        headerTitleStyle: { color: c.ink, fontWeight: '700' },
        headerRight: () => <SettingsHeaderButton tintColor={c.ink} navigation={navigation} />,
        tabBarActiveTintColor: c.signal,
        tabBarInactiveTintColor: c.inkSoft,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        tabBarStyle: { backgroundColor: c.card, borderTopColor: c.line },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={STUDIO_TAB_ICONS[route.name] || 'ellipse-outline'} size={size} color={color} />
        ),
        tabBarAccessibilityLabel: `${route.name} tab`,
      })}
    >
      <Tab.Screen name="Talk" component={StudioBoardScreen} options={{ headerShown: false }} />
      <Tab.Screen name="Phrases" component={ContextPackScreen} options={{ title: 'Phrases' }} />
      <Tab.Screen name="Personalise" component={StudioScreen} options={{ title: 'Personalise' }} />
      <Tab.Screen name="Me" component={ProfileScreen} options={{ title: 'Me' }} />
    </Tab.Navigator>
  );
}

function MainApp() {
  const { settings, loading } = useSettings();
  // Wait for saved settings so the layout never flashes the wrong board.
  if (loading) return <View style={styles.center} />;
  // The new board is the default for new installs; existing users keep the
  // familiar board until they choose the new one (Settings or Personalise).
  if (settings.boardLayout !== 'classic') return <StudioApp />;
  return <ClassicApp />;
}

function ClassicApp() {
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
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: -1 },
            shadowOpacity: 0.1,
            shadowRadius: 3,
            borderTopLeftRadius: 15,
            borderTopRightRadius: 15,
            position: 'absolute',
            height: 60 + insets.bottom,
            paddingBottom: insets.bottom,
          },
          tabBarIcon: ({ color, size }) => (
            <Ionicons name={TAB_ICONS[route.name] || 'help-outline'} size={size} color={color} />
          ),
          tabBarAccessibilityLabel: `${route.name} tab`,
        })}
      >
        <Tab.Screen
          name="AAC Board"
          component={AACBoardScreen}
          // Compact layout (opt-in) hides this header to give the word grid
          // more room; Settings is then reachable from the board's page row.
          options={{ title: 'Communicate', headerShown: settings.compactLayout !== true }}
        />
        <Tab.Screen
          name="Contexts"
          component={ContextPackScreen}
          options={{ title: 'Situations' }}
        />
        <Tab.Screen name="Sentence" component={EasySentenceBuilderScreen} />
        <Tab.Screen name="Emotion" component={EmotionScreen} />
        <Tab.Screen name="Profile" component={ProfileScreen} />
      </Tab.Navigator>
      <QuickRepairOverlay />
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
    AsyncStorage.getItem('hasLaunched')
      .then(val => setHasLaunched(val === 'true'))
      // On read failure, skip onboarding rather than trapping the user on
      // the loading spinner forever.
      .catch(() => setHasLaunched(true));
  }, []);

  // Persist any unsaved AI-profile learning when the app goes to background —
  // the profile store only writes every N updates otherwise.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') {
        flushAIProfile().catch(() => {});
        flushPrediction().catch(() => {});
      }
    });
    return () => sub.remove();
  }, []);

  if (hasLaunched === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2979FF" />
      </View>
    );
  }

  // First run: the board is usable immediately; the welcome sheet sits on
  // top and can be closed at once. It never blocks communication.
  return (
    <>
      <MainApp />
      {!hasLaunched && <WelcomeSheet onDone={() => setHasLaunched(true)} />}
    </>
  );
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
      <RootStack.Screen
        name="App"
        component={AppNavigator}
        options={{ headerShown: false }}
      />
      <RootStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings' }}
      />
      <RootStack.Screen
        name="Feedback"
        component={FeedbackScreen}
        options={{ title: 'Feedback' }}
      />
      <RootStack.Screen
        name="Camera"
        component={CameraScreen}
        options={{ title: 'Camera' }}
      />
      <RootStack.Screen
        name="Insights"
        component={InsightsScreen}
        options={{ title: 'Communication Insights' }}
      />
      <RootStack.Screen
        name="VocabManager"
        component={VocabManagerScreen}
        options={{ title: 'Manage Vocabulary' }}
      />
      <RootStack.Screen
        name="Studio"
        component={StudioScreen}
        options={{ title: 'Personalise' }}
      />
      <RootStack.Screen
        name="Sentence"
        component={EasySentenceBuilderScreen}
        options={{ title: 'Sentence builder' }}
      />
      <RootStack.Screen
        name="Emotion"
        component={EmotionScreen}
        options={{ title: 'Feelings' }}
      />
      <RootStack.Screen
        name="Licenses"
        component={LicensesScreen}
        options={{ title: 'Credits & Licences' }}
      />
      <RootStack.Screen
        name="Login"
        component={AuthStackScreen}
        options={{ headerShown: false, presentation: 'modal' }}
      />
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
              <OfflineBanner>
                <NavigationContainer>
                  <RootNavigator />
                </NavigationContainer>
              </OfflineBanner>
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
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
