// src/screens/MeScreen.js
// "Me" tab for the new board: account (optional), your data, and help.
// Everything here is optional; communication never depends on an account.

import React from 'react';
import { ScrollView, Text, View, StyleSheet, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { isFirebaseAvailable } from '../../firebaseConfig';
import { usePaper } from '../design/usePaper';
import { Card, ListRow, Notice } from '../design/components';
import { space, type } from '../design/tokens';
import { logOut, confirmDeleteAccount } from '../services/accountActions';
import { deleteLocalPersonalData } from '../services/localData';

export default function MeScreen() {
  const navigation = useNavigation();
  const { user } = useAuth();
  const { c } = usePaper();
  // Anonymous sessions only exist to carry a token; in the UI they are guests.
  const account = user && !user.isAnonymous ? user : null;
  const cloud = isFirebaseAvailable();

  const confirmDeleteLocal = () => {
    Alert.alert(
      'Delete my words and messages?',
      'Removes from this phone: spoken history, favourites, your own words and their photos, photo scenes, saved message drafts, temporary exports, pronunciations and everything Voice has learned. Your settings stay. If you are signed in, your own words are kept in your account and sync back to this phone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteLocalPersonalData();
              Alert.alert('Deleted', account ? 'Your messages and learning were removed from this phone. Your own words sync back from your account.' : 'Your words and messages were removed from this phone.');
            } catch {
              Alert.alert('Deletion incomplete', 'Some personal data could not be removed. Please try again.');
            }
          },
        },
      ]
    );
  };

  return (
    <ScrollView style={{ backgroundColor: c.paper }} contentContainerStyle={styles.content}>
      <Card title="Account">
        <Text style={[type.title, { color: c.ink }]}>{account ? (account.email || 'Signed in') : 'Using Voice without an account'}</Text>
        <Text style={[type.body, { color: c.inkSoft, marginTop: 4, marginBottom: space.sm }]}>
          {account
            ? 'Presentation settings and your own words sync to your account. Learning and online-suggestion choices apply only on this device. Photos and learning stay on this phone, apart from the phone\'s own backup if it is turned on.'
            : 'Everything works on this phone. An account is only needed to sync between devices.'}
        </Text>
        {!cloud ? (
          <Notice icon="cloud-offline-outline">Accounts and sync are not available in this version. Everything else works.</Notice>
        ) : account ? (
          <>
            <ListRow icon="log-out-outline" text="Sign out" onPress={logOut} />
            <ListRow icon="trash-outline" iconColor={c.danger} text="Delete account" onPress={confirmDeleteAccount} />
          </>
        ) : (
          <ListRow icon="log-in-outline" text="Sign in or create an account" onPress={() => navigation.navigate('Login')} />
        )}
      </Card>

      <Card title="Communication tools">
        <ListRow icon="images-outline" text="My scenes and communication tools" meta="Pictures, repair phrases and portable cards" onPress={() => navigation.navigate('CommunicationTools')} />
        <ListRow icon="chatbubbles-outline" text="My messages" meta="Save a thought, try word forms and return to it" onPress={() => navigation.navigate('ConversationWorkspace')} />
        <ListRow icon="print-outline" text="Export or print my board" meta="Portable words, photos and a paper backup" onPress={() => navigation.navigate('PortableBoard')} />
        <ListRow icon="sparkles-outline" text="How suggestions learn" meta="See your learning status and try a private demo" onPress={() => navigation.navigate('PredictionDiagnostics')} />
      </Card>

      <Card title="Your data">
        <ListRow icon="analytics-outline" text="Communication insights (on this phone)" onPress={() => navigation.navigate('Insights')} />
        <ListRow icon="people-outline" text="Vocabulary requests (caregivers)" onPress={() => navigation.navigate('VocabManager')} />
        <ListRow icon="trash-outline" iconColor={c.danger} text="Delete my words and messages" onPress={confirmDeleteLocal} />
      </Card>

      <Card title="Help and about">
        <ListRow icon="settings-outline" text="All settings" onPress={() => navigation.navigate('Settings')} />
        <ListRow icon="chatbox-ellipses-outline" text="Send feedback" onPress={() => navigation.navigate('Feedback')} />
        <ListRow icon="document-text-outline" text="Credits and licences" onPress={() => navigation.navigate('Licenses')} />
      </Card>
      <View style={{ height: space.lg }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({ content: { padding: space.lg } });
