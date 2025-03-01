// src/pages/UserManagement.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { ref, onValue, push } from 'firebase/database';
import { db } from '../firebaseConfig'; // adjust the path as necessary

export default function UserManagement() {
  const [users, setUsers] = useState([]);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');

  // Fetch users from the "users" node in the database
  useEffect(() => {
    const usersRef = ref(db, 'users/');
    const unsubscribe = onValue(usersRef, snapshot => {
      const data = snapshot.val();
      if (data) {
        const usersList = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setUsers(usersList);
      } else {
        setUsers([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Function to add a new user
  const addUser = async () => {
    if (!newUserName || !newUserEmail) {
      return alert('Please enter both name and email.');
    }
    try {
      const usersRef = ref(db, 'users/');
      await push(usersRef, {
        name: newUserName,
        email: newUserEmail,
      });
      setNewUserName('');
      setNewUserEmail('');
    } catch (error) {
      alert('Error adding user: ' + error.message);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>User Management</Text>
      
      <View style={styles.form}>
        <TextInput
          style={styles.input}
          placeholder="Name"
          value={newUserName}
          onChangeText={setNewUserName}
        />
        <TextInput
          style={styles.input}
          placeholder="Email"
          value={newUserEmail}
          onChangeText={setNewUserEmail}
          keyboardType="email-address"
        />
        <TouchableOpacity style={styles.button} onPress={addUser}>
          <Text style={styles.buttonText}>Add User</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={users}
        keyExtractor={item => item.id}
        renderItem={({ item }) => (
          <View style={styles.userItem}>
            <Text style={styles.userText}>{item.name} - {item.email}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: 'bold', marginBottom: 20 },
  form: { marginBottom: 20 },
  input: { borderWidth: 1, borderColor: '#ccc', padding: 10, marginBottom: 10, borderRadius: 5 },
  button: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 5, alignItems: 'center' },
  buttonText: { color: '#fff', fontSize: 16 },
  userItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  userText: { fontSize: 16 },
});
