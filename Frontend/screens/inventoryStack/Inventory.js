import Toast from 'react-native-toast-message';
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
import React, {useCallback, useEffect, useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {useFocusEffect} from "@react-navigation/native";
import EurekappButton from "../components/Button";
import Constants from "expo-constants";
import useAuthFetch from "../../utils/useAuthFetch";
import { colors } from "../../styles/globalStyles";
import { formatDateES } from "../../utils/dateFormatter";
import EmptyState from "../components/EmptyState";
import AppImage from "../components/AppImage";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const PAGE_SIZE = 20;

const Inventory = ({ navigation }) => {
    const { authFetch } = useAuthFetch();
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [institutesObject, setInstitutesObject] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    const [maxStorageDays, setMaxStorageDays] = useState(null);
    const [userRole, setUserRole] = useState(null);

    useEffect(() => {
        const fetchPolicy = async () => {
            try {
                const data = await authFetch('get', `${BACK_URL}/organizations/policy`);
                if (data.maxStorageDays != null) {
                    setMaxStorageDays(data.maxStorageDays);
                }
            } catch (e) {
                if (__DEV__) console.warn('fetchPolicy error:', e);
            }
        };
        const loadUserRole = async () => {
            try {
                const raw = await AsyncStorage.getItem('user');
                if (raw) setUserRole(JSON.parse(raw).role);
            } catch (e) {}
        };
        fetchPolicy();
        loadUserRole();
    }, []);

    const getStorageStatus = (foundDate) => {
        if (!maxStorageDays || !foundDate) return null;
        const days = (Date.now() - new Date(foundDate).getTime()) / (1000 * 60 * 60 * 24);
        if (days >= maxStorageDays) return 'expired';
        if (days >= maxStorageDays * 0.8) return 'expiring';
        return null;
    };

    const fetchFoundObjectsFromOrganization = async (institute, pageNum = 0, append = false) => {
        try {
            const data = await authFetch('get', `${BACK_URL}/found-objects/organizations/all/${institute.id}?page=${pageNum}&pageSize=${PAGE_SIZE}`);
            const { found_objects = [], has_more = false } = data;
            setInstitutesObject(prev => append ? [...prev, ...found_objects] : found_objects);
            setHasMore(has_more);
            setPage(pageNum);
        } catch (error) {
            if (__DEV__) console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo cargar el inventario. Verificá tu conexión.' });
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchFoundObjectsFromOrganization(selectedInstitute, 0, false);
        setRefreshing(false);
    }

    const loadMore = () => {
        if (!hasMore || loadingMore || loading) return;
        setLoadingMore(true);
        fetchFoundObjectsFromOrganization(selectedInstitute, page + 1, true);
    };

    useFocusEffect(
        useCallback(() => {
            const getContextInstitute = async () => {
                const institute = {
                    id: await AsyncStorage.getItem('org.id'),
                    name: await AsyncStorage.getItem('org.name')
                };
                setSelectedInstitute(institute);
                await fetchFoundObjectsFromOrganization(institute, 0, false);
            };
            getContextInstitute();
        }, [])
    );

    const renderItem = ({item}) => {
        const storageStatus = getStorageStatus(item.found_date);
        return (
            <Pressable style={styles.item}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemText}>
                        Encontrado el {formatDateES(item.found_date)}
                    </Text>
                    {storageStatus === 'expired' && (
                        <View style={styles.expiredBadge}>
                            <Text style={styles.expiredBadgeText}>Vencido</Text>
                        </View>
                    )}
                    {storageStatus === 'expiring' && (
                        <View style={styles.expiringBadge}>
                            <Text style={styles.expiringBadgeText}>Por vencer</Text>
                        </View>
                    )}
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

                <AppImage
                    imageUrl={item.imageUrl}
                    style={styles.image}
                    resizeMode="cover"
                    accessibilityLabel="Imagen del objeto"
                />
            </Pressable>
        );
    }

    const NotFoundComponent = () => {
        return (
            <EmptyState icon="box-open" title="¡Tu organización no tiene objetos!" />
        );
    }
    return (
        <View style={styles.container}>
            {(userRole === 'ENCARGADO' || userRole === 'ORGANIZATION_OWNER') && (
                <TouchableOpacity
                    style={styles.reclamosBtn}
                    onPress={() => navigation.navigate('ReclamosList')}>
                    <Text style={styles.reclamosBtnText}>Ver reclamos</Text>
                </TouchableOpacity>
            )}
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
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.3}
                        ListFooterComponent={loadingMore ? <ActivityIndicator size="small" color="#111818" style={{marginVertical: 12}} /> : null}
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
        backgroundColor: colors.background
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
        color: colors.text,
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Regular'
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
    },
    expiredBadge: {
        backgroundColor: '#ED4337',
        borderRadius: 8,
        paddingVertical: 2,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    expiredBadgeText: {
        color: colors.background,
        fontSize: 11,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    expiringBadge: {
        backgroundColor: '#f59e0b',
        borderRadius: 8,
        paddingVertical: 2,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
        marginTop: 4,
    },
    expiringBadgeText: {
        color: colors.background,
        fontSize: 11,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    reclamosBtn: {
        backgroundColor: '#111818',
        margin: 10,
        marginBottom: 4,
        borderRadius: 24,
        paddingVertical: 10,
        alignItems: 'center',
        maxWidth: 800,
        width: '95%',
        alignSelf: 'center',
    },
    reclamosBtnText: {
        color: colors.background,
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
});


export default Inventory;