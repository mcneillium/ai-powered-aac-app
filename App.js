// App.js
// Root component for the AAC app.
//
// Architecture decisions:
// 1. AAC Board is available WITHOUT login (offline-first communication)
// 2. Auth is optional — enables sync, logging, and caregiver features
// 3. Error boundary wraps the entire app to prevent total crash
// 4. Model loading is non-blocking — app renders immediately
// 5. Shared theme from src/theme.js — no inline palette objects

import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, StyleSheet, TouchableOpacity, Platform } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import { NetworkProvider } from './src/contexts/NetworkContext';
import { getPalette } from './src/theme';
import ErrorBoundary from './src/components/ErrorBoundary';
import OfflineBanner from './src/components/OfflineBanner';

// Screens
import AACBoardScreen from './src/screens/AACBoardScreen';
import CommunicationStackScreen from './src/screens/CommunicationScreen';
import EasySentenceBuilderScreen from './src/screens/EasySentenceBuilderScreen';
import EmotionScreen from './src/screens/EmotionScreen';
import ProfileScreen from './src/screens/ProfileScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import FeedbackScreen from './src/screens/FeedbackScreen';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import OnboardingScreen from './src/screens/OnboardingScreen';
import CameraScreen from './src/screens/CameraScreen';

// Non-blocking model load
import { loadImprovedModel } from './src/services/improvedModelLoader';
import { loadAIProfile, recordSessionStart } from './src/services/aiProfileStore';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

// Start model loading in background — do not block app render
loadImprovedModel().catch(err => console.warn('Model load failed (non-blocking):', err));

// Load AI profile and record session start
loadAIProfile()
  .then(() => recordSessionStart())
  .catch(err => console.warn('AI profile load failed (non-blocking):', err));

const TAB_ICONS = {
  'AAC Board': 'grid-outline',
  'Communication': 'chatbubble-ellipses-outline',
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

function MainApp() {
  const insets = useSafeAreaInsets();
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  return (
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
        options={{ title: 'Communicate' }}
      />
      <Tab.Screen name="Communication" component={CommunicationStackScreen} />
      <Tab.Screen name="Sentence" component={EasySentenceBuilderScreen} />
      <Tab.Screen name="Emotion" component={EmotionScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
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
  const { user, loading: authLoading } = useAuth();
  const [hasLaunched, setHasLaunched] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('hasLaunched').then(val => {
      setHasLaunched(val === 'true');
    });
  }, []);

  if (hasLaunched === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2979FF" />
      </View>
    );
  }

  // Show onboarding for first launch (regardless of auth)
  if (!hasLaunched) {
    return <OnboardingScreen onComplete={() => setHasLaunched(true)} />;
  }

  // Main app is ALWAYS available — auth is not required for communication
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
});
