import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, Image, ActivityIndicator, StyleSheet } from 'react-native';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';

const PictogramSearchScreen = () => {
  const [query, setQuery] = useState('');
  const [pictograms, setPictograms] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    setLoading(true);
    // Pass the language code "en" along with the query to the search function
    const results = await searchPictograms('en', query);
    if (results) {
      setPictograms(results);
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
      {loading && <ActivityIndicator size="large" color="#0000ff" />}
      <FlatList
        data={pictograms}
        keyExtractor={(item, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.itemContainer}>
            {/* Use getPictogramUrl with the pictogram's _id */}
            <Image style={styles.image} source={{ uri: getPictogramUrl(item._id, 500) }} />
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
    borderColor: '#ccc',
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
