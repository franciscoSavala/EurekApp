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
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import { useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/FontAwesome6';
import { ROLE_LABELS } from '../../utils/constants';
import EmptyState from '../components/EmptyState';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const RewardExclusionsList = () => {
    const { authFetch } = useAuthFetch();
    const [exclusions, setExclusions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchExclusions = async () => {
        try {
            const raw = await AsyncStorage.getItem('user');
            if (!raw) return;
            const user = JSON.parse(raw);
            const orgId = user?.organization?.id;
            if (!orgId) return;

            const data = await authFetch('get', `${BACK_URL}/found-objects/reward-exclusions/organizations/${orgId}`);
            setExclusions(data?.exclusions ?? data ?? []);
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
                <EmptyState
                    icon="circle-check"
                    title="Sin exclusiones registradas"
                    description="No hay casos de exclusión de recompensa en tu organización."
                />
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
        backgroundColor: colors.background,
        paddingTop: 16,
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
        marginBottom: 4,
    },
    subheading: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
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
        color: colors.text,
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
        color: colors.textMuted,
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

export default RewardExclusionsList;
