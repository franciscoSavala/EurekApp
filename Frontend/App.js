import { StatusBar } from 'expo-status-bar';
import React, { useState } from "react";
import {Button, FlatList, StyleSheet, Text, TextInput, View, Image} from 'react-native';
import * as FileSystem from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import axios from "axios";

const imgDir = FileSystem.documentDirectory + 'images';
const BACK_URL = "http://localhost:8080";

const ensureDirExists = async () => {
    const dirInfo = await FileSystem.getInfoAsync(imgDir);
    if(!dirInfo.exists){
        await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true });
    }
}

export default function App() {
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [objectsFound, setObjectsFound] = useState([]);
    const selectImage = async () => {
        let res = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images
        });
        if(!res.canceled){
            console.log(res.assets[0].fileName);
        }
    }
    const queryLostObject = async () => {
        setLoading(true);
        try {
            let res = await axios.get(BACK_URL + "/photos",
                {params: {query: queryObjects}});
            let jsonData = res.data;
            console.log(jsonData)
            setObjectsFound(jsonData.imageScoreDtos);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }

    }

    const renderItem = ({ item }) => (
        <View style={styles.item}>
            <Text>{item.id}</Text>
            <Text>{item.textRepresentation}</Text>
            <Text>{item.score}</Text>
            {item.b64Json && (
                <Image
                    source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                    style={styles.image}
                />
            )}
        </View>
    );

    const ItemSeparator = () => (
        <View style={styles.separator} />
    );

    return (
        <View style={styles.container}>
            <Text>Buscar un objeto: </Text>
            <TextInput
                style={styles.input}
                placeholder={"Describe el objeto que buscas"}
                onChangeText={setQueryObjects}
                value={queryObjects} />
            <Button title="Buscar Objeto" onPress={queryLostObject} />
            {loading ? (
                <Text>Cargando...</Text>
            ) : (
                <FlatList
                    data={objectsFound}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    ItemSeparatorComponent={ItemSeparator}
                />
            )}
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
    item: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    separator: {
        height: 10,
    },
    image: {
        width: 100,
        height: 100,
        marginTop: 10,
    },
});

