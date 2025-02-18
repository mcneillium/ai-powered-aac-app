// src/screens/CommunicationScreen.js
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  ScrollView,
  Button,
  Text,
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';

export default function CommunicationScreen() {
  const [pictograms, setPictograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPictogram, setSelectedPictogram] = useState(null);
  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];

  useEffect(() => {
    loadCategory('Everyday');
  }, []);

  const loadCategory = async (category) => {
    setLoading(true);
    const data = await searchPictograms('en', category);
    if (data) {
      setPictograms(data);
    }
    setLoading(false);
    // Clear any previous selection when switching categories
    setSelectedPictogram(null);
  };

  const handleCategorySelect = (category) => {
    loadCategory(category);
  };

  const selectPictogram = (item) => {
    console.log('Pictogram selected:', item);
    // Extract the keyword string from the first keyword object, if available.
    const description =
      item.keywords && item.keywords.length > 0 && item.keywords[0].keyword
        ? item.keywords[0].keyword
        : 'No description available';
    setSelectedPictogram({ ...item, description });
  };

  const speakSelected = () => {
    if (selectedPictogram) {
      Speech.speak(selectedPictogram.description);
    } else {
      Speech.speak('No pictogram selected');
    }
  };

  const renderCategoryButton = (category, index) => (
    <TouchableOpacity
      key={index}
      style={styles.categoryButton}
      onPress={() => handleCategorySelect(category)}
    >
      <Text style={styles.categoryButtonText}>{category}</Text>
    </TouchableOpacity>
  );

  const renderPictogramItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.gridItem,
        selectedPictogram && selectedPictogram._id === item._id
          ? styles.selectedItem
          : null,
      ]}
      onPress={() => selectPictogram(item)}
    >
      <Image
        style={styles.gridImage}
        source={{ uri: getPictogramUrl(item._id, 500) }}
      />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Display currently selected pictogram's description */}
      {selectedPictogram && (
        <View style={styles.selectedContainer}>
          <Text style={styles.selectedText}>
            Selected: {selectedPictogram.description}
          </Text>
        </View>
      )}

      {/* Category Bar */}
      <View style={styles.categoryBarContainer}>
        <ScrollView
          horizontal
          contentContainerStyle={styles.categoryBar}
          showsHorizontalScrollIndicator={false}
        >
          {categories.map((category, index) =>
            renderCategoryButton(category, index)
          )}
        </ScrollView>
      </View>

      {/* Pictogram Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading…</Text>
        </View>
      ) : (
        <FlatList
          data={pictograms}
          keyExtractor={(item, index) => index.toString()}
          renderItem={renderPictogramItem}
          numColumns={3}
          contentContainerStyle={styles.grid}
        />
      )}

      {/* Speak Button */}
      <View style={styles.speakButtonContainer}>
        <Button title="Speak" onPress={speakSelected} color="#4CAF50" />
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f3',
    paddingTop: 10,
  },
  categoryBarContainer: {
    height: 50,
    marginVertical: 10,
  },
  categoryBar: {
    alignItems: 'center',
    paddingHorizontal: 10,
  },
  categoryButton: {
    backgroundColor: '#d0e8ff',
    padding: 10,
    marginHorizontal: 5,
    borderRadius: 5,
  },
  categoryButtonText: {
    fontSize: 16,
    color: '#333',
  },
  grid: {
    paddingHorizontal: 10,
  },
  gridItem: {
    flex: 1,
    margin: 5,
    alignItems: 'center',
  },
  gridImage: {
    width: 100,
    height: 100,
    borderRadius: 10,
  },
  selectedItem: {
    borderWidth: 3,
    borderColor: '#4CAF50',
    borderRadius: 10,
  },
  speakButtonContainer: {
    margin: 20,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: 18,
  },
  selectedContainer: {
    alignItems: 'center',
    marginVertical: 5,
  },
  selectedText: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
