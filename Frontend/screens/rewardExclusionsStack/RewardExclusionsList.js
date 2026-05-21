import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from '../../utils/axiosInstance';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome6';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ROLE_LABELS = {
    ORGANIZATION_EMPLOYEE: 'Empleado',
    ENCARGADO: 'Encargado',
    ORGANIZATION_OWNER: 'Responsable de organización',
};

const RewardExclusionsList = () => {
    const [exclusions, setExclusions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchExclusions = async () => {
        try {
            const [jwt, raw] = await Promise.all([
                AsyncStorage.getItem('jwt'),
                AsyncStorage.getItem('user'),
            ]);
            if (!raw) return;
            const user = JSON.parse(raw);
            const orgId = user?.organization?.id;
            if (!orgId) return;

            const res = await axiosInstance.get(
                `${BACK_URL}/found-objects/reward-exclusions/organizations/${orgId}`,
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            setExclusions(res.data?.exclusions ?? res.data ?? []);
        } catch (e) {
            console.warn('Error cargando exclusiones:', e);
        }
    };

    const load = async () => {
        setLoading(true);
        await fetchExclusions();
        setLoading(false);
    };

    const refresh = async () => {
        setRefreshing(true);
        await fetchExclusions();
        setRefreshing(false);
    };

    useFocusEffect(useCallback(() => { load(); }, []));

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit',
        });
    };

    const truncateUUID = (uuid) => uuid ? `${uuid.substring(0, 8)}...` : '—';

    const renderItem = ({ item }) => (
        <View style={styles.card}>
            <View style={styles.cardHeader}>
                <Icon name="ban" size={14} color="#991b1b" />
                <Text style={styles.cardRole}>
                    {ROLE_LABELS[item.userRole] || item.userRole}
                </Text>
            </View>
            <Text style={styles.cardUser}>{item.username}</Text>
            <View style={styles.cardMeta}>
                <View style={styles.metaItem}>
                    <Icon name="calendar" size={12} color="#638888" />
                    <Text style={styles.metaText}> {formatDate(item.excludedAt)}</Text>
                </View>
                <View style={styles.metaItem}>
                    <Icon name="box" size={12} color="#638888" />
                    <Text style={styles.metaText}> Obj: {truncateUUID(item.foundObjectUUID)}</Text>
                </View>
            </View>
            <View style={styles.reasonBadge}>
                <Text style={styles.reasonText}>Sin recompensa · Incompatibilidad de funciones</Text>
            </View>
        </View>
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
            <Text style={styles.heading}>Exclusiones de recompensa</Text>
            <Text style={styles.subheading}>
                Registros de objetos cargados por encargados, empleados o responsables que no reciben puntos.
            </Text>
            {exclusions.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Icon name="circle-check" size={40} color="#c0d0d0" />
                    <Text style={styles.emptyTitle}>Sin exclusiones registradas</Text>
                    <Text style={styles.emptyDesc}>
                        No hay casos de exclusión de recompensa en tu organización.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={exclusions}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderItem}
                    contentContainerStyle={styles.list}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor="#0d9e9e" />
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
        marginBottom: 4,
    },
    subheading: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
        paddingHorizontal: 16,
        marginBottom: 16,
        lineHeight: 18,
    },
    list: {
        paddingHorizontal: 16,
        paddingBottom: 24,
        gap: 12,
    },
    card: {
        backgroundColor: '#fff5f5',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#fecaca',
        gap: 6,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    cardRole: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: '#991b1b',
    },
    cardUser: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#111818',
    },
    cardMeta: {
        flexDirection: 'row',
        gap: 16,
        flexWrap: 'wrap',
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    reasonBadge: {
        backgroundColor: '#fee2e2',
        borderRadius: 8,
        paddingVertical: 4,
        paddingHorizontal: 8,
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    reasonText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 11,
        color: '#991b1b',
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

export default RewardExclusionsList;
