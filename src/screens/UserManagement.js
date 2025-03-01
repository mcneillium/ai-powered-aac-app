// src/pages/UserManagement.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList } from 'react-native';
import { ref, onValue, push } from 'firebase/database';
import { db } from '../firebaseConfig'; // adjust path as needed
import Papa from 'papaparse';

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

  // Function to add a new user manually
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

  // Function to handle CSV upload
  const handleCSVUpload = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        const { data } = results;
        for (const row of data) {
          // Expecting CSV with headers "name" and "email"
          if (row.name && row.email) {
            try {
              const usersRef = ref(db, 'users/');
              await push(usersRef, {
                name: row.name,
                email: row.email,
              });
            } catch (error) {
              console.error("Error adding user from CSV: ", error);
            }
          }
        }
        alert('CSV upload complete.');
      },
      error: (error) => {
        alert("Error parsing CSV: " + error.message);
      }
    });
  };

  // Function to add dummy users
  const addDummyUsers = async () => {
    const dummyUsers = [
      { name: 'Alice', email: 'alice@example.com' },
      { name: 'Bob', email: 'bob@example.com' },
      { name: 'Charlie', email: 'charlie@example.com' },
    ];
    try {
      const usersRef = ref(db, 'users/');
      for (const user of dummyUsers) {
        await push(usersRef, user);
      }
      alert('Dummy users added.');
    } catch (error) {
      alert('Error adding dummy users: ' + error.message);
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

      <View style={styles.uploadSection}>
        <Text style={styles.uploadLabel}>Upload CSV:</Text>
        {/* For web; for mobile, use a document picker */}
        <input type="file" accept=".csv" onChange={handleCSVUpload} style={styles.fileInput} />
      </View>

      <TouchableOpacity style={styles.dummyButton} onPress={addDummyUsers}>
        <Text style={styles.buttonText}>Add Dummy Users</Text>
      </TouchableOpacity>

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
  button: { backgroundColor: '#4CAF50', padding: 15, borderRadius: 5, alignItems: 'center', marginBottom: 10 },
  dummyButton: { backgroundColor: '#2196F3', padding: 15, borderRadius: 5, alignItems: 'center', marginBottom: 20 },
  buttonText: { color: '#fff', fontSize: 16 },
  uploadSection: { marginBottom: 20 },
  uploadLabel: { fontSize: 16, marginBottom: 5 },
  fileInput: { padding: 5 },
  userItem: { padding: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  userText: { fontSize: 16 },
});
