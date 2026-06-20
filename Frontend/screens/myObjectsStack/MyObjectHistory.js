import React, { useCallback, useState } from 'react';
import { formatDateES } from '../../utils/dateFormatter';
import {
    ActivityIndicator,
    FlatList,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import Icon from 'react-native-vector-icons/FontAwesome6';
import EmptyState from '../components/EmptyState';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_CONFIG = {
    PENDIENTE:   { label: 'Pendiente',               color: '#888',    bg: '#f0f0f0' },
    EN_REVISION: { label: 'En revisión',             color: '#b45309', bg: '#fef3c7' },
    APROBADO:    { label: 'Coincidencia encontrada', color: '#065f46', bg: '#d1fae5' },
    RECHAZADO:   { label: 'Cerrado',                 color: '#991b1b', bg: '#fee2e2' },
    DEVUELTO:    { label: 'Devuelto',                color: '#1d4ed8', bg: '#dbeafe' },
    BUSCANDO:    { label: 'Buscando',                color: '#0d6e6e', bg: '#ccf2f2' },
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
    const { authFetch } = useAuthFetch();
    const [reclamos, setReclamos] = useState([]);
    const [lostObjects, setLostObjects] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [reclamosRes, lostRes] = await Promise.allSettled([
                authFetch('get', `${BACK_URL}/reclamos/my`),
                authFetch('get', `${BACK_URL}/lost-objects/my`),
            ]);
            if (reclamosRes.status === 'fulfilled') setReclamos(reclamosRes.value);
            if (lostRes.status === 'fulfilled') setLostObjects(lostRes.value);
        } catch (e) {
            console.warn('Error cargando historial:', e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchData(); }, []));


    const renderReclamo = ({ item }) => (
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
                {item.status === 'DEVUELTO' && item.datetimeOfReturn ? (
                    <Text style={styles.cardDate}> Retirado: {formatDateES(item.datetimeOfReturn)}</Text>
                ) : (
                    <Text style={styles.cardDate}> Búsqueda: {formatDateES(item.createdAt)}</Text>
                )}
            </View>
        </TouchableOpacity>
    );

    const renderLostObject = ({ item }) => (
        <TouchableOpacity
            style={styles.card}
            onPress={() => navigation.navigate('MyLostObjectDetail', { lostObject: item })}
        >
            <View style={styles.cardHeader}>
                <Text style={styles.cardTitle} numberOfLines={1}>
                    Búsqueda abierta
                </Text>
                <StatusChip status="BUSCANDO" />
            </View>
            {!!item.description && (
                <Text style={styles.cardDesc} numberOfLines={2}>{item.description}</Text>
            )}
            <View style={styles.cardFooter}>
                <Icon name="calendar" size={12} color="#638888" />
                <Text style={styles.cardDate}> Registrada: {formatDateES(item.lostDate)}</Text>
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

    const isEmpty = reclamos.length === 0 && lostObjects.length === 0;

    if (isEmpty) {
        return (
            <View style={styles.container}>
                <EmptyState
                    icon="magnifying-glass"
                    title="Sin búsquedas guardadas"
                    description="Cuando guardes una búsqueda, aparecerá acá con su estado actualizado."
                />
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
            {reclamos.length > 0 && (
                <>
                    <Text style={styles.heading}>Mis búsquedas guardadas</Text>
                    <FlatList
                        data={reclamos}
                        keyExtractor={(item) => `reclamo-${item.id}`}
                        renderItem={renderReclamo}
                        scrollEnabled={false}
                        contentContainerStyle={styles.list}
                    />
                </>
            )}

            {lostObjects.length > 0 && (
                <>
                    <Text style={[styles.heading, reclamos.length > 0 && { marginTop: 24 }]}>
                        Búsquedas abiertas
                    </Text>
                    <FlatList
                        data={lostObjects}
                        keyExtractor={(item) => `lost-${item.uuid}`}
                        renderItem={renderLostObject}
                        scrollEnabled={false}
                        contentContainerStyle={styles.list}
                    />
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
        paddingTop: 16,
    },
    scrollContent: {
        paddingBottom: 32,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    heading: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 22,
        color: colors.text,
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    list: {
        paddingHorizontal: 16,
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
        color: colors.text,
        flex: 1,
        marginRight: 8,
    },
    cardDesc: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
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
        color: colors.textMuted,
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
        color: colors.text,
        textAlign: 'center',
    },
    emptyDesc: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: colors.textMuted,
        textAlign: 'center',
        lineHeight: 20,
    },
});

export default MyObjectHistory;
