import React, { useState, useCallback } from 'react';
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import { useFocusEffect } from '@react-navigation/native';
import EmptyState from '../components/EmptyState';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const REASON_LABELS = {
    MULTIPLE_CLAIMERS_SAME_OBJECT: 'Múltiples reclamantes del mismo objeto',
    HIGH_CLAIM_FREQUENCY: 'Alta frecuencia de reclamos',
};

const STATUS_COLORS = {
    PENDING: '#f59e0b',
    CONFIRMED_FRAUD: '#ED4337',
    FALSE_POSITIVE: '#008000',
};

const STATUS_LABELS = {
    PENDING: 'Pendiente',
    CONFIRMED_FRAUD: 'Fraude confirmado',
    FALSE_POSITIVE: 'Falso positivo',
};

const FraudAlerts = ({ navigation }) => {
    const { authFetch } = useAuthFetch();
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);
    const [isOwner, setIsOwner] = useState(false);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const [alertsData, raw] = await Promise.all([
                authFetch('get', `${BACK_URL}/fraud-alerts`),
                AsyncStorage.getItem('user'),
            ]);
            setAlerts(alertsData);
            if (raw) {
                const u = JSON.parse(raw);
                setIsOwner(u.role === 'ORGANIZATION_OWNER');
            }
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchAlerts();
        }, [])
    );

    const renderItem = ({ item }) => (
        <TouchableOpacity
            style={styles.item}
            onPress={() => navigation.navigate('FraudAlertDetail', { alertId: item.id })}>
            <View style={styles.itemContent}>
                <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[item.status] || '#aaa' }]}>
                    <Text style={styles.statusChipText}>{STATUS_LABELS[item.status] || item.status}</Text>
                </View>
                <Text style={styles.reasonText}>
                    {REASON_LABELS[item.reason] || item.reason}
                </Text>
                {item.suspectUserEmail ? (
                    <Text style={styles.metaText}>Usuario: {item.suspectUserEmail}</Text>
                ) : null}
                <Text style={styles.metaText}>
                    {item.createdAt ? new Date(item.createdAt).toLocaleString('es-AR') : ''}
                </Text>
            </View>
        </TouchableOpacity>
    );

    const EmptyComponent = () => (
        <EmptyState icon="triangle-exclamation" title="No hay alertas de fraude" />
    );

    return (
        <View style={styles.container}>
            {isOwner && (
                <TouchableOpacity
                    style={styles.reportBtn}
                    onPress={() => navigation.navigate('FraudReport')}>
                    <Text style={styles.reportBtnText}>Ver reporte</Text>
                </TouchableOpacity>
            )}
            {loading ? (
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#111818" />
                </View>
            ) : (
                <FlatList
                    data={alerts}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    refreshControl={
                        <RefreshControl refreshing={loading} onRefresh={fetchAlerts} />
                    }
                    ListEmptyComponent={EmptyComponent}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    reportBtn: {
        margin: 16,
        marginBottom: 0,
        borderWidth: 1,
        borderColor: colors.text,
        borderRadius: 24,
        paddingVertical: 10,
        alignItems: 'center',
    },
    reportBtnText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: colors.text,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    listContent: {
        padding: 16,
        flexGrow: 1,
    },
    item: {
        backgroundColor: colors.surface,
        borderRadius: 16,
        padding: 16,
        marginBottom: 10,
    },
    itemContent: {
        flexDirection: 'column',
        gap: 6,
    },
    statusChip: {
        alignSelf: 'flex-start',
        borderRadius: 12,
        paddingVertical: 3,
        paddingHorizontal: 10,
        marginBottom: 4,
    },
    statusChipText: {
        color: 'white',
        fontSize: 12,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    reasonText: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Bold',
        color: colors.text,
    },
    metaText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: colors.textMuted,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: colors.textMuted,
    },
});

export default FraudAlerts;
