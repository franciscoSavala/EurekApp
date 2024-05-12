import { StatusBar } from 'expo-status-bar';
import {Button, StyleSheet, Text, TextInput, View} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

const imgDir = FileSystem.documentDirectory + 'images';
const BACK_URL = "http://localhost:8080";

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(imgDir);
  if(!dirInfo.exists){
    await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true });
  }
}

export default function App() {

  const selectImage = async () => {
    let res = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images
    });
    if(!res.canceled){
      console.log(res.assets[0].fileName);
    }
  }
  const queryImage = async () => {
    let res = await fetch(BACK_URL + "/photo");
    let jsonData = res.json();

  }
  return (
    <View style={styles.container}>
      <Text>Postear un objeto perdido: </Text>
      <Button title={"Upload Image"} onPress={selectImage}></Button>
      <Text>Buscar un objeto: </Text>
      <TextInput style={styles.input}></TextInput>
      <Button title={"Query Image"} onPress={}></Button>
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  input: {
    width: 300,
    height: 40,
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 5,
    paddingLeft: 10, // Esto es opcional, agrega espacio a la izquierda del texto
  },
});
