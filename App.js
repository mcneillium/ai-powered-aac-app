import React, { useState, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { ActivityIndicator, View, Text, StyleSheet } from 'react-native';
import { AuthProvider, useAuth } from './src/contexts/AuthContext';
import LoginScreen from './src/screens/LoginScreen';
import SignupScreen from './src/screens/SignupScreen';
import CommunicationStackScreen from './src/screens/CommunicationScreen';
import EasySentenceBuilderScreen from './src/screens/EasySentenceBuilderScreen';
import CameraScreen from './src/screens/CameraScreen';
import EmotionScreen from './src/screens/EmotionScreen';
import LiveSceneModeScreen from './src/screens/LiveSceneModeScreen';
import { loadImprovedModel } from './src/services/improvedModelLoader'; // New loader import
import * as tf from '@tensorflow/tfjs';

const Tab = createBottomTabNavigator();
const AuthStack = createNativeStackNavigator();

function MainApp() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#4CAF50',
        tabBarInactiveTintColor: 'gray',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopWidth: 0,
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -1 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          borderTopLeftRadius: 15,
          borderTopRightRadius: 15,
          position: 'absolute',
          height: 60,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName;
          if (route.name === 'Communication') {
            iconName = 'chatbubble-ellipses-outline';
          } else if (route.name === 'Easy Sentence') {
            iconName = 'text-outline';
          } else if (route.name === 'Camera') {
            iconName = 'camera-outline';
          } else if (route.name === 'Emotion') {
            iconName = 'happy-outline';
          } else if (route.name === 'Live Scene') {
            iconName = 'eye-outline';
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Communication" component={CommunicationStackScreen} />
      <Tab.Screen name="Easy Sentence" component={EasySentenceBuilderScreen} />
      <Tab.Screen name="Camera" component={CameraScreen} />
      <Tab.Screen name="Emotion" component={EmotionScreen} />
      <Tab.Screen name="Live Scene" component={LiveSceneModeScreen} />
    </Tab.Navigator>
  );
}

function AuthStackScreen() {
  return (
    <AuthStack.Navigator>
      <AuthStack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
      <AuthStack.Screen name="Signup" component={SignupScreen} options={{ headerShown: false }} />
    </AuthStack.Navigator>
  );
}

function AppNavigator() {
  const { user, loading, error } = useAuth();

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>Authentication error</Text>
        <Text style={styles.errorSubtext}>{error.message}</Text>
      </View>
    );
  }

  return user ? <MainApp /> : <AuthStackScreen />;
}

export default function App() {
  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(null);

  // Load the improved model when the app starts
  useEffect(() => {
    const initModel = async () => {
      try {
        await loadImprovedModel();
        setModelLoading(false);
      } catch (err) {
        console.error('Error loading improved model:', err);
        setModelError(err);
        setModelLoading(false);
      }
    };
    initModel();
  }, []);

  if (modelLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#4CAF50" />
      </View>
    );
  }

  if (modelError) {
    console.warn('App continuing without improved model. Some features may be limited.');
  }

  return (
    <AuthProvider>
      <NavigationContainer>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  errorText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#d32f2f',
    marginBottom: 8,
  },
  errorSubtext: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 20,
  },
});
