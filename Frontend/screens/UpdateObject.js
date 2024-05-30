import React, { useState } from 'react';
import {View, Text, TextInput, Button, Image, StyleSheet} from 'react-native';
import axios from 'axios';
import * as ImagePicker from "react-native-image-picker";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const UpdateObject = () => {
    const [text, setText] = useState('');
    const [image, setImage] = useState(null);

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibrary({
            mediaType: 'photo',
            includeBase64: true,
        });

        if (!result.didCancel) {
            setImage(result.assets[0]);
        }
    };

    const submitData = async () => {
        if (!text || !image) {
            alert('Please provide both text and image.');
            return;
        }

        const formData = new FormData();
        formData.append('description', text);
        formData.append('file', {
            uri: image.uri,
            type: image.type,
            name: image.fileName,
        });

        try {
            const response = await axios.post(BACK_URL + '/photos', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });
            console.log(response.data);
        } catch (error) {
            console.error(error);
        }
    };

    return (
        <View style={styles.container}>
            <Text>Text:</Text>
            <TextInput
                value={text}
                onChangeText={setText}
                style={styles.input}
            />
            <Button title="Pick Image" onPress={pickImage} />
            {image && (
                <Image
                    source={{ uri: image.uri }}
                    style={styles.image}
                />
            )}
            <Button title="Submit" onPress={submitData} />
        </View>
    );
};

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
    loadingText: {
        marginTop: 20,
        fontSize: 18,
    },
    list: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});

export default UpdateObject;
