import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text, TouchableOpacity,
    View
} from "react-native";
import React, {useEffect, useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappButton from "../components/Button";
import axios from "axios";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ReturnedObjects = ({ navigation }) => {
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [foundObjects, setFoundObjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReturnedObjects = async () => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let res = await axios.get(
                `${BACK_URL}/found-objects/getReturnedObjects`,
                config );
            let jsonData = res.data;
            setFoundObjects(jsonData.found_objects);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchReturnedObjects();
        setRefreshing(false);
    }

    useEffect( () => {
        fetchReturnedObjects();
    }, []);

    const renderItem = ({item}) => {
        const isSelected = item.id === objectSelectedId;
        const date = new Date(item.found_date);
        return (
            <Pressable style={styles.item}
                       onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={styles.itemTitle}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemText}>
                        Descripción: {item.humanDescription}
                    </Text>
                    <Text style={styles.itemText}>
                        Encontrado el {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                    </Text>
                    <View style={styles.seeReturnButtonContainer}>
                        <TouchableOpacity style={styles.seeReturnButton} onPress={() => {navigation.navigate('ReturnedObjectDetail', {
                            foundObjectUUID: item.id
                        })}}>
                            <Text style={styles.seeReturnButtonText}>Ver devolución</Text>
                        </TouchableOpacity>
                    </View>
                </View>
                <Image
                    source={ item.b64Json
                        ? { uri: `data:image/jpeg;base64,${item.b64Json}` }
                        : require('../../assets/defaultImage.png') }
                    style={styles.image}
                    resizeMode="cover"
                />
            </Pressable>
        );
    }

    const NotFoundComponent = () => {
        return (
            <View style={{height: 200, justifyContent: 'center', alignSelf: 'center'}}>
                <Text style={{
                    fontFamily: 'PlusJakartaSans-Regular',
                    fontSize: 20
                }}>Tu organización no ha devuelto ningún objeto aún.</Text>
            </View>
        );
    }
    return (
        <View style={styles.container}>
            <View style={styles.organizationObjectsContainer}>
                { loading ?
                    <View style={{flex: 1, justifyContent: 'center'}}>
                        <ActivityIndicator size="large" style={{alignSelf: 'center'}} color="#111818" />
                    </View>
                    : <FlatList
                        data={foundObjects}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.contentContainer}
                        scrollEnabled={true}
                        ListEmptyComponent={NotFoundComponent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        } />
                }

            </View>

        </View>
    );


}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        flexDirection: 'column',
        justifyContent: 'center',
    },
    organizationObjectsContainer: {
        flex: 1,
        maxWidth: 800,
        //justifyContent: 'flex-start',
        //alignItems: 'center',
        width: '100%',
        alignSelf:"center",
    },
    contentContainer: {
        width:'100%',
    },
    item: {
        height: 175,
        backgroundColor: '#f0f4f4',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 16,
    },
    highlightedOrganizationObject: {
        backgroundColor: '#19e6e6',
    },
    image: {
        width: '100%',     // La imagen ocupará el 100% del ancho del contenedor
        height: undefined, // Mantiene el ratio de aspecto
        aspectRatio: 1,    // Asegura que la imagen mantenga su proporción (cuadrada)
        maxWidth: 130,     // Limita el ancho máximo de la imagen
        maxHeight: 130,    // Limita la altura máxima de la imagen
        borderRadius: 16,
        overflow: 'hidden', // Evita que cualquier contenido fuera del borde del contenedor sea visible
    },
    itemTextContainer: {
        flex: 2,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    itemTitle: {
        color: '#111818',
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    itemText: {
        color: '#111818',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        marginVertical: 5
    },
    organizationHeader: {
        color: '#111818',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold'
    },
    seeReturnButton: {
        backgroundColor: '#19e6e6',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        margin: 5,
        width:"200px",
        maxWidth: "100%"
    },
    seeReturnButtonText: {
        color: '#111818',
        fontWeight: 'bold',
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold'
    },
    seeReturnButtonContainer: {
        width: '100%',
        justifyContent: 'center',
        paddingHorizontal: 20,
    }
});


export default ReturnedObjects;