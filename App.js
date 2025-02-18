import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';

// Import your screens – ensure these paths match your project structure.
import CommunicationStackScreen from './src/screens/CommunicationScreen';
import EasySentenceBuilderScreen from './src/screens/EasySentenceBuilderScreen';
import ImagePickerSpeechScreen from './src/screens/ImagePickerSpeechScreen';
import CameraScreen from './src/screens/CameraScreen';
import EmotionScreen from './src/screens/EmotionScreen';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: '#4CAF50',
          tabBarInactiveTintColor: 'gray',
          tabBarStyle: { backgroundColor: '#fff' },
        }}
      >
        <Tab.Screen name="Communication" component={CommunicationStackScreen} />
        <Tab.Screen name="Easy Sentence" component={EasySentenceBuilderScreen} />
        <Tab.Screen name="Image Picker" component={ImagePickerSpeechScreen} />
        <Tab.Screen name="Camera" component={CameraScreen} />
        <Tab.Screen name="Emotion" component={EmotionScreen} />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
