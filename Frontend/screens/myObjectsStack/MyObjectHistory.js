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
import { useFocusEffect } from '@react-navigation/native';
import axiosInstance from '../../utils/axiosInstance';
import Constants from 'expo-constants';
import Icon from 'react-native-vector-icons/FontAwesome6';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_CONFIG = {
    PENDIENTE:   { label: 'Pendiente',               color: '#888',    bg: '#f0f0f0' },
    EN_REVISION: { label: 'En revisión',             color: '#b45309', bg: '#fef3c7' },
    APROBADO:    { label: 'Coincidencia encontrada', color: '#065f46', bg: '#d1fae5' },
    RECHAZADO:   { label: 'Cerrado',                 color: '#991b1b', bg: '#fee2e2' },
};

const StatusChip = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
    return (
        <View style={[styles.chip, { backgroundColor: cfg.bg }]}>
            <Text style={[styles.chipText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
    );
};

const MyObjectHistory = ({ navigation }) => {
    const [reclamos, setReclamos] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchReclamos = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const res = await axiosInstance.get(`${BACK_URL}/reclamos/my`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setReclamos(res.data);
        } catch (e) {
            console.warn('Error cargando historial:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchReclamos(); }, []));

    const formatDate = (isoString) => {
        if (!isoString) return '';
        const d = new Date(isoString);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    };

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('MyObjectDetail', { reclamoId: item.id })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.foundObjectTitle || item.foundObjectCategory || 'Objeto sin título'}
                </Text>
                <StatusChip status={item.status} />
            </View>
            {!!item.foundObjectHumanDescription && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.foundObjectHumanDescription}</Text>
            )}
            <View style={styles.cardFooter}>
                <Icon name="calendar" size={12} color="#638888" />
                <Text style={styles.cardDate}> Reclamo: {formatDate(item.createdAt)}</Text>
            </View>
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0d9e9e" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.heading}>Mis búsquedas guardadas</Text>
            {reclamos.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Icon name="magnifying-glass" size={40} color="#c0d0d0" />
                    <Text style={styles.emptyTitle}>Sin búsquedas guardadas</Text>
                    <Text style={styles.emptyDesc}>
                        Cuando guardes una búsqueda, aparecerá acá con su estado actualizado.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={reclamos}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
        paddingTop: 16,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    heading: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 22,
        color: '#111818',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        gap: 12,
    },
    card: {
        backgroundColor: '#f7fafa',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#e0ecec',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    cardTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: '#111818',
        flex: 1,
        marginRight: 8,
    },
    cardDesc: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
        marginBottom: 8,
        lineHeight: 18,
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    cardDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    chip: {
        borderRadius: 20,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    chipText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 11,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        gap: 12,
    },
    emptyTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 18,
        color: '#111818',
        textAlign: 'center',
    },
    emptyDesc: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#638888',
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default MyObjectHistory;
