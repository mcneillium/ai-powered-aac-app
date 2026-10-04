// src/services/accountActions.js
// Sign out and delete account, shared by the Classic Profile screen and the
// new Me screen. Account deletion removes synced data and every personal
// store on this device (see localData.js).

import { Alert } from 'react-native';
import { signOut, deleteUser } from 'firebase/auth';
import { ref, remove } from 'firebase/database';
import { auth as cloudAuth, db as cloudDb } from '../../firebaseConfig';
import { deleteLocalPersonalData } from './localData';
import { beginAccountDeletion } from './accountDeletionBarrier';

let deletionInProgress = false;

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
          if (deletionInProgress) return;
          deletionInProgress = true;
          try {
            const currentUser = cloudAuth?.currentUser;
            if (!currentUser) return;
            const uid = currentUser.uid;

            await beginAccountDeletion();
            if (!cloudDb) throw new Error('Account data is unavailable.');
            // Wait for every removal even if one fails. Keep Auth available
            // for an authenticated retry instead of leaving orphaned data.
            const results = await Promise.allSettled([
              'users', 'userSettings', 'userLogs', 'userSync',
              'customVocab', 'vocabRequests', 'feedback',
            ].map(path => Promise.resolve().then(() => remove(ref(cloudDb, `${path}/${uid}`)))));
            if (results.some(result => result.status === 'rejected')) {
              throw new Error('Account data removal was incomplete.');
            }

            // Clear all personal data on this device, including Voice 2
            // stores (learned prediction data, tile photos) and settings.
            await deleteLocalPersonalData({ includeSettings: true });

            // Delete auth account
            await deleteUser(currentUser);
            Alert.alert('Account Deleted', 'Your account and all associated data have been permanently deleted.');
          } catch (error) {
            if (error.code === 'auth/requires-recent-login') {
              Alert.alert(
                'Re-authentication Required',
                'Some data may already have been removed. For security, please log out and log back in, then try deleting again.'
              );
            } else {
              Alert.alert('Deletion Incomplete', 'Your account has not been deleted. Some data may already have been removed. Please try deleting again. Account sync is paused until you log out and log back in.');
            }
          } finally {
            deletionInProgress = false;
          }
        },
      },
    ]
  );
}
