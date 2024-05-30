import React, { useState } from "react";
import {Button, FlatList, StyleSheet, Text, TextInput, View, Image} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation }) => {
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [objectsFound, setObjectsFound] = useState([]);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);

    const queryLostObject = async () => {
        setLoading(true);
        setButtonWasPressed(true);
        console.log(BACK_URL)
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
            <Text>{item.description}</Text>
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
            {buttonWasPressed ? (
                loading ? (
                        <Text style={styles.loadingText}>Cargando...</Text>
                    ) : (
                        <FlatList
                            data={objectsFound}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={renderItem}
                            ItemSeparatorComponent={ItemSeparator}
                            contentContainerStyle={styles.list}
                        />
                    )
            ) : (<View />)
            }

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

export default FindObject;