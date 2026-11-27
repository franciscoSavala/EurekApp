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
import ErrorRetry from "../components/ErrorRetry";
import AppImage from "../components/AppImage";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const PAGE_SIZE = 20;

const FILTERS = [
    { label: 'Todos', value: 'all' },
    { label: 'Vencidos', value: 'expired' },
];

const Inventory = ({ navigation }) => {
    const { authFetch } = useAuthFetch();
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [institutesObject, setInstitutesObject] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);
    // EU-444: si la carga falla no se sabe qué hay en el inventario; no se puede decir que está vacío.
    const [loadFailed, setLoadFailed] = useState(false);

    // EU-452: "all" lista todo el inventario; "expired" solo los objetos con el plazo de guarda vencido.
    const [filter, setFilter] = useState('all');

    const fetchFoundObjectsFromOrganization = async (institute, pageNum = 0, append = false, activeFilter = filter) => {
        try {
            const expiredParam = activeFilter === 'expired' ? '&expired=true' : '';
            const data = await authFetch('get', `${BACK_URL}/found-objects/organizations/all/${institute.id}?page=${pageNum}&pageSize=${PAGE_SIZE}${expiredParam}`);
            const { found_objects = [], has_more = false } = data;
            setInstitutesObject(prev => append ? [...prev, ...found_objects] : found_objects);
            setHasMore(has_more);
            setPage(pageNum);
            setLoadFailed(false);
        } catch (error) {
            setLoadFailed(true);
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

    const changeFilter = async (newFilter) => {
        if (newFilter === filter || !selectedInstitute) return;
        setFilter(newFilter);
        setLoading(true);
        setInstitutesObject([]);
        setHasMore(false);
        setPage(0);
        await fetchFoundObjectsFromOrganization(selectedInstitute, 0, false, newFilter);
    };

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
        const storageStatus = item.storage_status;
        return (
            <Pressable style={styles.item}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemText}>
                        Encontrado el {formatDateES(item.found_date)}
                    </Text>
                    {storageStatus === 'EXPIRED' && (
                        <View style={styles.expiredBadge}>
                            <Text style={styles.expiredBadgeText}>Vencido</Text>
                        </View>
                    )}
                    {storageStatus === 'EXPIRING' && (
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
            loadFailed
                ? <ErrorRetry message="No pudimos cargar el inventario. Intentá de nuevo." onRetry={() => fetchFoundObjectsFromOrganization(selectedInstitute, 0, false)} />
                : filter === 'expired'
                    ? <EmptyState icon="box-open" title="No hay objetos vencidos." />
                    : <EmptyState icon="box-open" title="¡Tu organización no tiene objetos!" />
        );
    }
    return (
        <View style={styles.container}>
            <View style={styles.organizationObjectsContainer}>
                <View style={styles.filtersRow}>
                    {FILTERS.map((f) => (
                        <TouchableOpacity
                            key={f.value}
                            accessibilityRole="button"
                            style={[styles.chip, filter === f.value && styles.chipActive]}
                            onPress={() => changeFilter(f.value)}
                        >
                            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
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
    filtersRow: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: 'center',
    },
    chip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: '#fff', borderWidth: 1, borderColor: '#dde8e8',
        marginRight: 8,
    },
    chipActive: { backgroundColor: '#4A9999', borderColor: '#4A9999' },
    chipText: { fontSize: 13, fontFamily: 'PlusJakartaSans-Regular', color: '#555' },
    chipTextActive: { color: '#fff', fontFamily: 'PlusJakartaSans-Bold' },
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
});


export default Inventory;