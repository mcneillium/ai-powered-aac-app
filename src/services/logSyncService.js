// src/services/logSyncService.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ref, push } from 'firebase/database';
import { db } from 'firebaseConfig';

export async function pushLogsToFirebase() {
  try {
    const logsString = await AsyncStorage.getItem('userInteractionLog');
    if (!logsString) {
      console.log('No logs found to push.');
      return;
    }
    const logs = JSON.parse(logsString);
    const logsRef = ref(db, 'userLogs');

    // Push each log to Firebase
    for (const log of logs) {
      await push(logsRef, log);
    }

    // Optionally clear the logs after a successful push
    await AsyncStorage.removeItem('userInteractionLog');
    console.log('Logs pushed to Firebase successfully!');
  } catch (error) {
    console.error('Error pushing logs to Firebase:', error);
    throw error;
  }
}
