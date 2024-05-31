import React, { useState } from 'react';
import {View, Text, TextInput, Button, Image, StyleSheet} from 'react-native';
import Constants from "expo-constants";
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from "buffer";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const UpdateObject = () => {
    const [text, setText] = useState('');
    const [image, setImage] = useState(null);
    const [imageByte, setImageByte] = useState(new Buffer("something"));

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            aspect: [1,1],
            quality: 1,
        })

        if (!result.canceled){
            setImage(result.assets[0])
            setImageByte(new Buffer(result.assets[0].base64, "base64"));
        }
    };

    const submitData = async () => {
        if (!text || !image) {
            alert('Please provide both text and image.');
            return;
        }

        console.log(image);
        const blob = new Blob([imageByte]);
        const formData = new FormData();
        formData.append('file', blob, 'somefilename');
        formData.append('description', text);

        try {
            let response = await fetch( BACK_URL + '/photos', {
                    method: 'POST',
                    body: formData,
                });
            console.log(response)
            if (response.status === 1) {
                alert('Upload Successful')
            }
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
