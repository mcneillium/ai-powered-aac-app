// src/services/accountActions.js
// Sign out and delete account, shared by the Classic Profile screen and the
// new Me screen. Account deletion removes synced data and every personal
// store on this device (see localData.js).

import { Alert } from 'react-native';
import { signOut, deleteUser } from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { auth as cloudAuth, db as cloudDb } from '../../firebaseConfig';
import { deleteLocalPersonalData } from './localData';

export async function logOut() {
  try {
    if (cloudAuth) await signOut(cloudAuth);
  } catch (e) {
    Alert.alert('Error', 'Could not log out. Please try again.');
  }
}

export function confirmDeleteAccount() {
  Alert.alert(
    'Delete Account',
    'This will permanently delete your account, all synced data, and the messages, favourites, words and learning stored on this device.\n\nThis cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete Account',
        style: 'destructive',
        onPress: async () => {
          try {
            const currentUser = cloudAuth?.currentUser;
            if (!currentUser) return;
            const uid = currentUser.uid;

            // Delete all user data from Firebase
            try {
              const db = cloudDb;
              await Promise.all([
                remove(ref(db, `users/${uid}`)),
                remove(ref(db, `userSettings/${uid}`)),
                remove(ref(db, `userLogs/${uid}`)),
                remove(ref(db, `userSync/${uid}`)),
                remove(ref(db, `customVocab/${uid}`)),
                remove(ref(db, `vocabRequests/${uid}`)),
              ]);
            } catch (dbErr) {
              console.warn('Could not remove some user data:', dbErr);
            }

            // Clear all personal data on this device, including Voice 2
            // stores (learned prediction data, tile photos) and settings.
            try {
              await deleteLocalPersonalData({ includeSettings: true });
            } catch (localErr) {
              console.warn('Could not clear some local data:', localErr);
            }

            // Delete auth account
            await deleteUser(currentUser);
            Alert.alert('Account Deleted', 'Your account and all associated data have been permanently deleted.');
          } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
              Alert.alert(
                'Re-authentication Required',
                'For security, please log out and log back in, then try deleting again.'
              );
            } else {
              Alert.alert('Error', 'Could not delete account. Please try again.');
            }
          }
        },
      },
    ]
  );
}
