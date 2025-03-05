// src/screens/CommunicationScreen.js
import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Image,
  TouchableOpacity,
  Text,
  Modal,
  ActivityIndicator,
  Button,
} from 'react-native';
import * as Speech from 'expo-speech';
import { StatusBar } from 'expo-status-bar';
import { searchPictograms, getPictogramUrl } from '../services/arasaacService';
import { logEvent } from '../utils/logger';

export default function CommunicationScreen() {
  const [pictograms, setPictograms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedPictogram, setSelectedPictogram] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentCategory, setCurrentCategory] = useState('');

  const categories = ['Everyday', 'Food', 'Drinks', 'People', 'Places'];
  const [categoryImages, setCategoryImages] = useState({});

  useEffect(() => {
    const fetchRepresentativeImages = async () => {
      const reps = {};
      for (let category of categories) {
        const data = await searchPictograms('en', category);
        if (data && data.length > 0) {
          reps[category] = data[0];
        }
      }
      setCategoryImages(reps);
    };
    fetchRepresentativeImages();
  }, []);

  const handleCategoryCardPress = async (category) => {
    setCurrentCategory(category);
    setModalVisible(true);
    setLoading(true);
    logEvent('Category selected', { category, screen: 'CommunicationScreen' });
    const data = await searchPictograms('en', category);
    if (data) {
      setPictograms(data);
    }
    setLoading(false);
    setSelectedPictogram(null);
  };

  const selectPictogram = (item) => {
    const description =
      item.keywords && item.keywords.length > 0 && item.keywords[0].keyword
        ? item.keywords[0].keyword
        : 'No description available';
    setSelectedPictogram({ ...item, description });
    logEvent('Pictogram selected', { pictogramId: item._id, description, screen: 'CommunicationScreen' });
  };

  const speakSelected = () => {
    if (selectedPictogram) {
      Speech.speak(selectedPictogram.description);
    } else {
      Speech.speak('No pictogram selected');
    }
  };

  const renderCategoryCard = ({ item }) => {
    const rep = categoryImages[item];
    const imageUri = rep ? getPictogramUrl(rep._id, 500) : `https://via.placeholder.com/150?text=${item}`;
    return (
      <TouchableOpacity style={styles.categoryCard} onPress={() => handleCategoryCardPress(item)}>
        <Image source={{ uri: imageUri }} style={styles.categoryImage} />
        <View style={styles.categoryLabelContainer}>
          <Text style={styles.categoryLabel}>{item}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderPictogramItem = ({ item }) => (
    <TouchableOpacity
      style={[
        styles.pictogramItem,
        selectedPictogram && selectedPictogram._id === item._id ? styles.selectedItem : null,
      ]}
      onPress={() => selectPictogram(item)}
    >
      <Image style={styles.gridImage} source={{ uri: getPictogramUrl(item._id, 500) }} />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Select a Category</Text>
      <FlatList
        data={categories}
        renderItem={renderCategoryCard}
        keyExtractor={(item) => item}
        numColumns={2}
        contentContainerStyle={styles.categoryGrid}
      />

      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <Text style={styles.modalHeader}>{currentCategory} Pictograms</Text>
          {loading ? (
            <ActivityIndicator size="large" color="#4CAF50" />
          ) : (
            <FlatList
              data={pictograms}
              keyExtractor={(item, index) => index.toString()}
              renderItem={renderPictogramItem}
              numColumns={3}
              contentContainerStyle={styles.grid}
            />
          )}
          {selectedPictogram && (
            <View style={styles.selectedContainer}>
              <Text style={styles.selectedText}>
                Selected: {selectedPictogram.description}
              </Text>
              <Button title="Speak" onPress={speakSelected} color="#4CAF50" />
            </View>
          )}
          <Button title="Close" onPress={() => setModalVisible(false)} color="#f44336" />
        </View>
      </Modal>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f3',
    paddingTop: 20,
    paddingHorizontal: 10,
  },
  header: {
    fontSize: 26,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 20,
  },
  categoryGrid: {
    alignItems: 'center',
  },
  categoryCard: {
    margin: 10,
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    backgroundColor: '#fff',
    width: 150,
    height: 150,
  },
  categoryImage: {
    width: '100%',
    height: '80%',
  },
  categoryLabelContainer: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    position: 'absolute',
    bottom: 0,
    width: '100%',
    paddingVertical: 5,
    alignItems: 'center',
  },
  categoryLabel: {
    color: '#fff',
    fontSize: 16,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#eef2f3',
    paddingTop: 40,
    paddingHorizontal: 10,
  },
  modalHeader: {
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 15,
  },
  grid: {
    paddingHorizontal: 5,
    paddingBottom: 20,
  },
  pictogramItem: {
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
  selectedContainer: {
    alignItems: 'center',
    marginVertical: 10,
  },
  selectedText: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 5,
  },
});
