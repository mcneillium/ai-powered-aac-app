// src/screens/OnboardingScreen.js
import React, { useEffect } from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

export default function OnboardingScreen() {
  const navigation = useNavigation();

  const completeOnboarding = async () => {
    await AsyncStorage.setItem('hasLaunched', 'true');
    navigation.replace('MainApp');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome to the AAC App!</Text>
      <Text style={styles.text}>You can personalise your experience by selecting a theme and adjusting layout preferences.</Text>
      <Button title="Get Started" onPress={completeOnboarding} color="#4CAF50" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 20 },
  text: { fontSize: 18, marginBottom: 30, textAlign: 'center' },
});
