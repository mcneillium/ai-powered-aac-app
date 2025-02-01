// /src/screens/PictogramSearchScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { searchPictograms } from '../services/arasaacService';

const PictogramSearchScreen = () => {
  const [query, setQuery] = useState('');
  const [pictograms, setPictograms] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    const results = await searchPictograms(query);
    if (results) {
      setPictograms(results); // Adjust this based on how the API returns the data.
    }
    setLoading(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.heading}>Search Pictograms</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter a category or keyword"
        value={query}
        onChangeText={setQuery}
      />
      <Button title="Search" onPress={handleSearch} />
      {loading && <ActivityIndicator size="large" colour="#0000ff" />}
      <FlatList
        data={pictograms}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            {/* Adjust property names based on the API response */}
            <Image style={styles.image} source={{ uri: item.url }} />
            <Text>{item.name}</Text>
          </View>
        )}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20
  },
  heading: {
    fontSize: 24,
    marginBottom: 15
  },
  input: {
    height: 40,
    borderColour: '#ccc',
    borderWidth: 1,
    marginBottom: 10,
    paddingHorizontal: 8
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 10
  },
  image: {
    width: 50,
    height: 50,
    marginRight: 10
  }
});

export default PictogramSearchScreen;
