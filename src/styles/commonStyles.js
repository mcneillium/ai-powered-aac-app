// src/styles/commonStyles.js
import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#eef2f3',
    paddingTop: 50,
    paddingHorizontal: 10,
  },
  image: {
    width: 200,
    height: 200,
    marginVertical: 15,
    borderRadius: 10,
  },
  imageName: {
    fontSize: 18,
    marginBottom: 15,
    textAlign: 'center',
  },
  // ...other shared styles
});
