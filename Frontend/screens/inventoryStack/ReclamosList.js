import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_FILTERS = [
    { label: 'Todos', value: null },
    { label: 'Pendiente', value: 'PENDIENTE' },
    { label: 'En revisión', value: 'EN_REVISION' },
    { label: 'Aprobado', value: 'APROBADO' },
    { label: 'Rechazado', value: 'RECHAZADO' },
];

const STATUS_COLORS = {
    PENDIENTE: '#f59e0b',
    EN_REVISION: '#3b82f6',
    APROBADO: '#22c55e',
    RECHAZADO: '#ED4337',
};

const STATUS_LABELS = {
    PENDIENTE: 'Pendiente',
    EN_REVISION: 'En revisión',
    APROBADO: 'Aprobado',
    RECHAZADO: 'Rechazado',
};

const ReclamosList = ({ navigation }) => {
    const [reclamos, setReclamos] = useState([]);
    const [loading, setLoading] = useState(false);
    const [statusFilter, setStatusFilter] = useState(null);

    const fetchReclamos = async (status) => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const params = {};
            if (status) params.status = status;
            const res = await axios.get(`${BACK_URL}/reclamos`, {
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
            fetchReclamos(statusFilter);
        }, [statusFilter])
    );

    const handleFilterChange = (value) => {
        setStatusFilter(value);
    };

    const renderStars = (rating) => {
        if (!rating) return null;
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    const renderItem = ({ item }) => {
        const color = STATUS_COLORS[item.status] || '#638888';
        const label = STATUS_LABELS[item.status] || item.status;
        const date = item.createdAt ? new Date(item.createdAt) : null;

        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate('ReclamoDetail', { reclamoId: item.id })}>

                <View style={styles.cardHeader}>
                    <View style={[styles.statusBadge, { backgroundColor: color }]}>
                        <Text style={styles.statusBadgeText}>{label}</Text>
                    </View>
                    <View style={styles.headerRight}>
                        {item.isSuspicious && (
                            <Text style={styles.suspiciousIcon}>⚠</Text>
                        )}
                        <Text style={styles.confidenceText}>{item.confidenceLevel}</Text>
                    </View>
                </View>

                <Text style={styles.objectTitle}>
                    {item.foundObjectTitle || item.foundObjectUUID || 'Objeto sin nombre'}
                </Text>

                {item.foundObjectCategory ? (
                    <View style={styles.categoryBadge}>
                        <Text style={styles.categoryBadgeText}>{item.foundObjectCategory}</Text>
                    </View>
                ) : null}

                <Text style={styles.userName}>
                    {item.userFullName || 'Usuario desconocido'}
                </Text>
                <Text style={styles.userEmail}>{item.userEmail || '-'}</Text>

                {item.starRating ? (
                    <Text style={styles.stars}>{renderStars(item.starRating)}</Text>
                ) : null}

                {date ? (
                    <Text style={styles.dateText}>
                        {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}{' '}
                        {date.getHours()}:{String(date.getMinutes()).padStart(2, '0')}
                    </Text>
                ) : null}
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            {/* Filtros */}
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
    filtersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        paddingHorizontal: 10,
        paddingVertical: 8,
        gap: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
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
        padding: 14,
        marginBottom: 10,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
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
    headerRight: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    suspiciousIcon: {
        fontSize: 16,
        color: '#b45309',
    },
    confidenceText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    objectTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: '#111818',
        marginBottom: 4,
    },
    categoryBadge: {
        backgroundColor: '#e0f7f7',
        borderRadius: 8,
        paddingVertical: 2,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
        marginBottom: 6,
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
        marginBottom: 4,
    },
    stars: {
        fontSize: 14,
        color: '#f59e0b',
        marginBottom: 2,
    },
    dateText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 11,
        color: '#638888',
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
