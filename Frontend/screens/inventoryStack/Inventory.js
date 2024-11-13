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

const Inventory = ({ navigation }) => {
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [institutesObject, setInstitutesObject] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFoundObjectsFromOrganization = async (institute) => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            console.log(selectedInstitute);
            let res = await axios.get(
                `${BACK_URL}/found-objects/organizations/all/${institute.id}`,
                config );
            let jsonData = res.data;
            setInstitutesObject(jsonData.found_objects);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchFoundObjectsFromOrganization(selectedInstitute);
        setRefreshing(false);
    }

    useEffect(() => {
        const getContextInstitute = async () => {
            const institute = {
                id: await AsyncStorage.getItem('org.id'),
                name: await AsyncStorage.getItem('org.name')
            };
            setSelectedInstitute( institute );
            await fetchFoundObjectsFromOrganization(institute);
        }
        getContextInstitute();

    }, []);

    const renderItem = ({item}) => {
        const date = new Date(item.found_date);
        return (
            <Pressable style={styles.item}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemText}>
                        Encontrado el {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                    </Text>
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.seeDetailsButton} onPress={() => {navigation.navigate('FoundObjectDetail', {
                            foundObjectUUID: item.id
                        })}}>
                            <Text style={styles.buttonText}>Detalles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.seeReturnButton} onPress={() => {navigation.navigate('ReturnObjectForm', {
                            objectId: item.id
                        })}}>
                            <Text style={styles.buttonText}>Devolver</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{width:5}}></View>

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
                }}>¡Tu organización no tiene objetos!</Text>
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
                        data={institutesObject}
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
            {/*
            <EurekappButton text='Devolver este objeto'
                            onPress={() => navigation.navigate('ReturnObjectForm', {
                                objectId: objectSelectedId
                            })}/> */}
        </View>
    );


}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    organizationObjectsContainer: {
        flex: 1,
        maxWidth: 800,
        width: '100%',
        alignSelf:"center",
    },
    contentContainer: {
    },
    item: {
        height: 150,
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
        maxWidth: 120,     // Limita el ancho máximo de la imagen
        maxHeight: 120,    // Limita la altura máxima de la imagen
        borderRadius: 16,
        overflow: 'hidden', // Evita que cualquier contenido fuera del borde del contenedor sea visible
    },
    itemTextContainer: {
        flex: 2,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    itemText: {
        color: '#111818',
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Regular'
    },
    organizationHeader: {
        color: '#111818',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold'
    },
    seeDetailsButton: {
        backgroundColor: '#19e6e6',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        margin: 2,
        width:"175px",
        maxWidth:"40%"
    },
    seeReturnButton: {
        backgroundColor: '#19e6e6',
        paddingVertical: 8,
        paddingHorizontal: 5,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'center',
        margin: 2,
        width:"175px",
        maxWidth:"59%"
    },
    buttonText: {
        color: '#111818',
        fontWeight: 'bold',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Bold',
        textAlign: "center",
    },
    buttonsContainer: {
        width: '100%',
        justifyContent: 'center',
        //paddingHorizontal: 20,
        flexDirection: "row",
        marginHorizontal: 2,
    }
});


export default Inventory;