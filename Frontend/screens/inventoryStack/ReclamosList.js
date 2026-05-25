import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from "../../utils/axiosInstance";
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_FILTERS = [
    { label: 'Todos', value: null },
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'En revisión', value: 'EN_REVISION' },
    { label: 'Aprobado', value: 'APROBADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
    { label: 'Devuelto', value: 'DEVUELTO' },
];

const CATEGORY_FILTERS = [
    { label: 'Todas', value: null },
    { label: 'Electrónica', value: 'ELECTRONICA' },
    { label: 'Ropa', value: 'ROPA' },
    { label: 'Documentos', value: 'DOCUMENTOS' },
    { label: 'Llaves', value: 'LLAVES' },
    { label: 'Accesorios', value: 'ACCESORIOS' },
    { label: 'Otros', value: 'OTROS' },
];

const SORT_OPTIONS = [
    { label: 'Fecha', value: 'date' },
    { label: 'Estado', value: 'status' },
    { label: 'Prioridad', value: 'priority' },
];

const STATUS_COLORS = {
    PENDIENTE: '#f59e0b',
    EN_REVISION: '#3b82f6',
    APROBADO: '#22c55e',
    RECHAZADO: '#ED4337',
    DEVUELTO: '#7c3aed',
};

const STATUS_LABELS = {
    PENDIENTE: 'Pendiente',
    EN_REVISION: 'En revisión',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
    DEVUELTO: 'Devuelto',
};

const ReclamosList = ({ navigation }) => {
    const [reclamos, setReclamos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState(null);
    const [categoryFilter, setCategoryFilter] = useState(null);
    const [sortBy, setSortBy] = useState('date');

    const fetchReclamos = async (status, category, sort) => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const params = { sortBy: sort };
            if (status) params.status = status;
            if (category) params.category = category;
            const res = await axiosInstance.get(`${BACK_URL}/reclamos`, {
                headers: { Authorization: `Bearer ${jwt}` },
                params,
            });
            setReclamos(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchReclamos(statusFilter, categoryFilter, sortBy);
        }, [statusFilter, categoryFilter, sortBy])
    );

    const handleFilterChange = (value) => {
        setStatusFilter(value);
    };

    const renderItem = ({ item }) => {
        const color = STATUS_COLORS[item.status] || '#638888';
        const label = STATUS_LABELS[item.status] || item.status;
        const date = item.createdAt ? new Date(item.createdAt) : null;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ReclamoDetail', { reclamoId: item.id })}>

                <View style={styles.cardBody}>
                    {item.b64Json ? (
                        <Image
                            source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                            style={styles.objectImage}
                            resizeMode="cover"
                        />
                    ) : (
                        <View style={[styles.objectImage, styles.objectImagePlaceholder]}>
                            <Text style={styles.objectImagePlaceholderText}>Sin imagen</Text>
                        </View>
                    )}

                    <View style={styles.cardInfo}>
                        <View style={styles.cardHeader}>
                            <View style={[styles.statusBadge, { backgroundColor: color }]}>
                                <Text style={styles.statusBadgeText}>{label}</Text>
                            </View>
                            {item.isSuspicious && (
                                <Text style={styles.suspiciousIcon}>⚠</Text>
                            )}
                        </View>

                        <Text style={styles.objectTitle} numberOfLines={2}>
                            {item.foundObjectTitle || 'Objeto sin nombre'}
                        </Text>

                        {item.foundObjectCategory ? (
                            <View style={styles.categoryBadge}>
                                <Text style={styles.categoryBadgeText}>{item.foundObjectCategory}</Text>
                            </View>
                        ) : null}

                        <Text style={styles.userName} numberOfLines={1}>
                            {item.userFullName || 'Usuario desconocido'}
                        </Text>
                        <Text style={styles.userEmail} numberOfLines={1}>{item.userEmail || '-'}</Text>

                        {date ? (
                            <Text style={styles.dateText}>
                                {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}{' '}
                                {date.getHours()}:{String(date.getMinutes()).padStart(2, '0')}
                            </Text>
                        ) : null}
                    </View>

                    <Text style={styles.chevron}>›</Text>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Filtros */}
            <View style={styles.filtersSection}>
                <Text style={styles.filterLabel}>Estado</Text>
                <View style={styles.filtersRow}>
                    {STATUS_FILTERS.map(f => (
                        <TouchableOpacity
                            key={String(f.value)}
                            style={[styles.filterBtn, statusFilter === f.value && styles.filterBtnActive]}
                            onPress={() => handleFilterChange(f.value)}>
                            <Text style={[styles.filterBtnText, statusFilter === f.value && styles.filterBtnTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.filterLabel}>Categoría</Text>
                <View style={styles.filtersRow}>
                    {CATEGORY_FILTERS.map(f => (
                        <TouchableOpacity
                            key={String(f.value)}
                            style={[styles.filterBtn, categoryFilter === f.value && styles.filterBtnActive]}
                            onPress={() => setCategoryFilter(f.value)}>
                            <Text style={[styles.filterBtnText, categoryFilter === f.value && styles.filterBtnTextActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
                <Text style={styles.filterLabel}>Ordenar por</Text>
                <View style={styles.filtersRow}>
                    {SORT_OPTIONS.map(o => (
                        <TouchableOpacity
                            key={o.value}
                            style={[styles.filterBtn, sortBy === o.value && styles.filterBtnActive]}
                            onPress={() => setSortBy(o.value)}>
                            <Text style={[styles.filterBtnText, sortBy === o.value && styles.filterBtnTextActive]}>
                                {o.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#111818" />
                </View>
            ) : (
                <FlatList
                    data={reclamos}
                    keyExtractor={item => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>No hay reclamos registrados</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    filtersSection: {
        paddingHorizontal: 10,
        paddingTop: 8,
        paddingBottom: 4,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    filterLabel: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 11,
        color: '#638888',
        marginBottom: 4,
        marginTop: 6,
    },
    filtersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 2,
    },
    filterBtn: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 16,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    filterBtnActive: {
        backgroundColor: '#111818',
        borderColor: '#111818',
    },
    filterBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#111818',
    },
    filterBtnTextActive: {
        color: '#fff',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 10,
    },
    card: {
        backgroundColor: '#f0f4f4',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    cardBody: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    objectImage: {
        width: 72,
        height: 72,
        borderRadius: 10,
        flexShrink: 0,
    },
    objectImagePlaceholder: {
        backgroundColor: '#d1d5db',
        justifyContent: 'center',
        alignItems: 'center',
    },
    objectImagePlaceholderText: {
        fontSize: 10,
        color: '#9ca3af',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    cardInfo: {
        flex: 1,
        gap: 3,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 2,
    },
    statusBadge: {
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    statusBadgeText: {
        color: '#fff',
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    suspiciousIcon: {
        fontSize: 14,
        color: '#b45309',
    },
    objectTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: '#111818',
    },
    categoryBadge: {
        backgroundColor: '#e0f7f7',
        borderRadius: 8,
        paddingVertical: 2,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
    },
    categoryBadgeText: {
        fontSize: 11,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#19b8b8',
    },
    userName: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#111818',
    },
    userEmail: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    dateText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 11,
        color: '#638888',
    },
    chevron: {
        fontSize: 24,
        color: '#9ca3af',
        alignSelf: 'center',
    },
    emptyContainer: {
        paddingTop: 60,
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 16,
        color: '#638888',
    },
});

export default ReclamosList;
