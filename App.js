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
import { ActivityIndicator, AppState, View, Text, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider } from './src/contexts/AuthContext';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { NetworkProvider, useNetwork } from './src/contexts/NetworkContext';
import { getPalette, getExperience, fonts } from './src/theme';
import { TAB_BAR_HEIGHT, TAB_BAR_MARGIN } from './src/components/tabBarMetrics';
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
import OnboardingScreen from './src/screens/OnboardingScreen';
import CameraScreen from './src/screens/CameraScreen';
import InsightsScreen from './src/screens/InsightsScreen';
import VocabManagerScreen from './src/screens/VocabManagerScreen';
import LicensesScreen from './src/screens/LicensesScreen';
import LearningScreen from './src/screens/LearningScreen';

// Non-blocking model load
import { loadImprovedModel } from './src/services/improvedModelLoader';
import { loadAIProfile, recordSessionStart, flushAIProfile } from './src/services/aiProfileStore';
import { loadCustomVocab } from './src/services/customVocabStore';
import { loadPronunciations } from './src/services/pronunciationStore';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// Start model loading in background — do not block app render
loadImprovedModel().catch(err => console.warn('Model load failed (non-blocking):', err));

// Load AI profile and record session start
loadAIProfile()
  .then(() => recordSessionStart())
  .catch(err => console.warn('AI profile load failed (non-blocking):', err));
loadCustomVocab().catch(err => console.warn('Custom vocab load failed (non-blocking):', err));
loadPronunciations().catch(err => console.warn('Pronunciation load failed (non-blocking):', err));

const TAB_ICONS = {
  'AAC Board': ['chatbubble-ellipses', 'chatbubble-ellipses-outline'],
  'Contexts': ['compass', 'compass-outline'],
  'Sentence': ['text', 'text-outline'],
  'Emotion': ['happy', 'happy-outline'],
  'Profile': ['person-circle', 'person-circle-outline'],
};

// Tab names per experience. Route names stay the same (they are what saved
// navigation state and the native tests refer to).
const TAB_TITLES = {
  child: { 'AAC Board': 'Talk', Contexts: 'Places', Sentence: 'Build', Emotion: 'Feelings', Profile: 'Me' },
  adult: { 'AAC Board': 'Talk', Contexts: 'Situations', Sentence: 'Builder', Emotion: 'Feelings', Profile: 'Me' },
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

// Floating tab bar: a dark rounded bar with the current tab as a filled pill.
// Its footprint is fixed (tabBarMetrics) so screens can keep content clear.
function FloatingTabBar({ state, descriptors, navigation, palette, titles }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.tabBar,
        { backgroundColor: palette.tabBarBg, bottom: Math.max(insets.bottom, 6), height: TAB_BAR_HEIGHT },
      ]}
      accessibilityRole="tablist"
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const title = titles[route.name] || descriptors[route.key].options.title || route.name;
        const [on, off] = TAB_ICONS[route.name] || ['help', 'help-outline'];
        const color = focused ? palette.tabBarActive : palette.tabBarInactive;
        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };
        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={[styles.tabItem, focused && { backgroundColor: palette.tabBarPill }]}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={`${route.name} tab`}
            accessibilityHint={title}
          >
            <Ionicons name={focused ? on : off} size={22} color={color} />
            <Text
              style={[styles.tabLabel, { color, fontFamily: focused ? fonts.bold : fonts.regular }]}
              numberOfLines={1}
              maxFontSizeMultiplier={1.3}
            >
              {title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MainApp() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  const experience = getExperience(settings.experience);
  const titles = TAB_TITLES[experience.id] || TAB_TITLES.adult;

  return (
    <>
      <Tab.Navigator
        tabBar={(props) => <FloatingTabBar {...props} palette={palette} titles={titles} />}
        screenOptions={({ route, navigation }) => ({
          headerStyle: { backgroundColor: palette.headerBg },
          headerShadowVisible: false,
          headerTintColor: palette.text,
          headerTitleStyle: { color: palette.text, fontFamily: experience.headlineFont, fontSize: 24 },
          headerRight: () => (
            <SettingsHeaderButton tintColor={palette.text} navigation={navigation} />
          ),
          title: titles[route.name] || route.name,
          sceneStyle: { backgroundColor: palette.background },
        })}
      >
        <Tab.Screen
          name="AAC Board"
          component={AACBoardScreen}
          // The board draws its own header (name, situation, quick phrases,
          // settings) so the message bar sits as high as possible.
          options={{ headerShown: false }}
        />
        <Tab.Screen name="Contexts" component={ContextPackScreen} />
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

  if (!hasLaunched) {
    return <OnboardingScreen onComplete={() => setHasLaunched(true)} />;
  }

  return <MainApp />;
}

function RootNavigator() {
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);
  // While offline, the offline banner already covers the status bar; the
  // native header must not add the status-bar height again (it left an
  // empty band above every pushed screen's header).
  const { isOnline } = useNetwork();

  return (
    <RootStack.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: palette.headerBg },
        headerShadowVisible: false,
        headerTintColor: palette.text,
        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 20 },
        contentStyle: { backgroundColor: palette.background },
        headerTopInsetEnabled: isOnline,
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
        name="Licenses"
        component={LicensesScreen}
        options={{ title: 'Credits & Licences' }}
      />
      <RootStack.Screen
        name="Learning"
        component={LearningScreen}
        options={{ title: 'What Voice has learned' }}
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
  tabBar: {
    position: 'absolute',
    left: TAB_BAR_MARGIN,
    right: TAB_BAR_MARGIN,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    gap: 2,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 12,
  },
  tabItem: {
    flex: 1,
    height: TAB_BAR_HEIGHT - 12,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  tabLabel: { fontSize: 12 },
  headerBtn: {
    marginRight: Platform.OS === 'ios' ? 16 : 12,
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
