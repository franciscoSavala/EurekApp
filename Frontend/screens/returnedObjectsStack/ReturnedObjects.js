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
import EurekappButton from "../components/Button";
import Constants from "expo-constants";
import useAuthFetch from "../../utils/useAuthFetch";
import { colors } from "../../styles/globalStyles";
import { formatDateES } from "../../utils/dateFormatter";
import EmptyState from "../components/EmptyState";
import AppImage from "../components/AppImage";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ReturnedObjects = ({ navigation }) => {
    const { authFetch } = useAuthFetch();
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [foundObjects, setFoundObjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchReturnedObjects = async () => {
        try {
            const jsonData = await authFetch('get', `${BACK_URL}/found-objects/getReturnedObjects`);
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
                        Encontrado el {formatDateES(item.found_date)}
                    </Text>
                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.seeDetailsButton} onPress={() => {navigation.navigate('FoundObjectDetail', {
                            foundObjectUUID: item.id
                        })}}>
                            <Text style={styles.buttonText}>Detalles</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.seeReturnButton} onPress={() => {navigation.navigate('ReturnedObjectDetail', {
                            foundObjectUUID: item.id
                        })}}>
                            <Text style={styles.buttonText}>Ver devolución</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{width:5}}></View>

                <AppImage
                    b64Json={item.b64Json}
                    style={styles.image}
                    resizeMode="cover"
                />
            </Pressable>
        );
    }

    const NotFoundComponent = () => {
        return (
            <EmptyState icon="box-open" title="Tu organización no ha devuelto ningún objeto aún." />
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
        backgroundColor: colors.background,
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
        backgroundColor: colors.surface,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 16,
    },
    highlightedOrganizationObject: {
        backgroundColor: colors.primary,
    },
    image: {
        width: '100%',     // La imagen ocupará el 100% del ancho del contenedor
        height: undefined, // Mantiene el ratio de aspecto
        aspectRatio: 1,    // Asegura que la imagen mantenga su proporción (cuadrada)
        maxWidth: 130,     // Limita el ancho máximo de la imagen
        maxHeight: 130,    // Limita la altura máxima de la imagen
        borderRadius: 16,
        overflow: 'hidden', // Evita que cualquier contenido fuera del borde del contenedor sea visible
        marginHorizontal: 1,
        flex:2,
    },
    itemTextContainer: {
        flex: 3,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        marginHorizontal: 1,

    },
    itemTitle: {
        color: colors.text,
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    itemText: {
        color: colors.text,
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        marginVertical: 5
    },
    organizationHeader: {
        color: colors.text,
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold'
    },
    seeDetailsButton: {
        backgroundColor: colors.primary,
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
        backgroundColor: colors.primary,
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
        color: colors.text,
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


export default ReturnedObjects;