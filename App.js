import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { loadModel } from './src/services/tfModel';

import CommunicationStackScreen from './src/screens/CommunicationScreen';
import EasySentenceBuilderScreen from './src/screens/EasySentenceBuilderScreen';
import CameraScreen from './src/screens/CameraScreen';
import EmotionScreen from './src/screens/EmotionScreen';
import LiveSceneModeScreen from './src/screens/LiveSceneModeScreen'; // New Live Scene screen

const Tab = createBottomTabNavigator();

export default function App() {
  useEffect(() => {
    loadModel();
  }, []);

  return (
    <NavigationContainer>
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
            } else if (route.name === 'Image Picker') {
              iconName = 'images-outline';
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
    </NavigationContainer>
  );
}
