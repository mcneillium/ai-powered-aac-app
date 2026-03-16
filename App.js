// App.js (at project root)
import React, { useState, useEffect } from 'react';
import { NavigationContainer }         from '@react-navigation/native';
import { createBottomTabNavigator }    from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator }  from '@react-navigation/native-stack';
import { Ionicons }                    from '@expo/vector-icons';
import {
  ActivityIndicator,
  View,
  Text,
  StyleSheet
} from 'react-native';
import { AuthProvider, useAuth }       from './src/contexts/AuthContext';
import { SettingsProvider, useSettings } from './src/contexts/SettingsContext';
import LoginScreen                     from './src/screens/LoginScreen';
import SignupScreen                    from './src/screens/SignupScreen';
import CommunicationStackScreen        from './src/screens/CommunicationScreen';
import EasySentenceBuilderScreen       from './src/screens/EasySentenceBuilderScreen';
import CameraScreen                    from './src/screens/CameraScreen';
import EmotionScreen                   from './src/screens/EmotionScreen';
import LiveSceneModeScreen             from './src/screens/LiveSceneModeScreen';
import ProfileScreen                   from './src/screens/ProfileScreen';
import SettingsScreen                  from './src/screens/SettingsScreen';
import OnboardingScreen                from './src/screens/OnboardingScreen';
import { loadImprovedModel }           from './src/services/improvedModelLoader';
import AsyncStorage                    from '@react-native-async-storage/async-storage';
import {
  SafeAreaProvider,
  useSafeAreaInsets
} from 'react-native-safe-area-context';
import { getPalette } from './src/styles/theme';

const Tab       = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function MainApp() {
  const insets   = useSafeAreaInsets();
  const { settings } = useSettings();
  const palette = getPalette(settings.theme);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle:      { backgroundColor: palette.tabBarBg },
        headerTintColor:  palette.text,
        headerTitleStyle: { color: palette.text },
        tabBarActiveTintColor:   palette.tabBarActive,
        tabBarInactiveTintColor: palette.tabBarInactive,
        tabBarStyle: {
          backgroundColor:   palette.tabBarBg,
          borderTopWidth:    0,
          elevation:         5,
          shadowColor:       '#000',
          shadowOffset:      { width: 0, height: -1 },
          shadowOpacity:     0.1,
          shadowRadius:      3,
          borderTopLeftRadius:  15,
          borderTopRightRadius: 15,
          position:          'absolute',
          height:            60 + insets.bottom,
          paddingBottom:     insets.bottom,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Communication') iconName = 'chatbubble-ellipses-outline';
          if (route.name === 'Easy Sentence') iconName = 'text-outline';
          if (route.name === 'Camera')         iconName = 'camera-outline';
          if (route.name === 'Emotion')        iconName = 'happy-outline';
          if (route.name === 'Live Scene')     iconName = 'eye-outline';
          if (route.name === 'Profile')        iconName = 'person-outline';
          return <Ionicons name={iconName} size={size} color={color} />;
        }
      })}
    >
      <Tab.Screen name="Communication" component={CommunicationStackScreen} />
      <Tab.Screen name="Easy Sentence"  component={EasySentenceBuilderScreen} />
      <Tab.Screen name="Camera"         component={CameraScreen} />
      <Tab.Screen name="Emotion"        component={EmotionScreen} />
      <Tab.Screen name="Live Scene"     component={LiveSceneModeScreen} />
      <Tab.Screen name="Profile"        component={ProfileScreen} />
    </Tab.Navigator>
  );
}

function AuthStackScreen() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login"  component={LoginScreen} />
      <AuthStack.Screen name="Signup" component={SignupScreen}/>
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, error } = useAuth();
  const [hasLaunched, setHasLaunched] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem('hasLaunched').then(val => {
      setHasLaunched(val === 'true');
    });
  }, []);

  if (loading || hasLaunched === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>Authentication error</Text>
        <Text style={styles.suberror}>{error.message}</Text>
      </View>
    );
  }
  return user
    ? hasLaunched ? <MainApp /> : <OnboardingScreen onComplete={() => setHasLaunched(true)} />
    : <AuthStackScreen />;
}

function RootNavigator() {
  return (
    <RootStack.Navigator>
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
    </RootStack.Navigator>
  );
}

export default function App() {
  const [modelLoading, setModelLoading] = useState(true);

  useEffect(() => {
    loadImprovedModel()
      .catch(err => console.warn('Model load failed', err))
      .finally(() => setModelLoading(false));
  }, []);

  if (modelLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  return (
    <AuthProvider>
      <SettingsProvider>
        <SafeAreaProvider>
          <NavigationContainer>
            <RootNavigator/>
          </NavigationContainer>
        </SafeAreaProvider>
      </SettingsProvider>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex:            1,
    justifyContent:  'center',
    alignItems:      'center',
    backgroundColor: '#f5f5f5'
  },
  error: {
    fontSize:   18,
    fontWeight: 'bold',
    color:      '#d32f2f',
    marginBottom: 8
  },
  suberror: {
    fontSize:  14,
    color:     '#666',
    textAlign: 'center',
    paddingHorizontal: 20
  }
});
