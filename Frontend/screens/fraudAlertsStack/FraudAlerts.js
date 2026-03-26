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
import axios from 'axios';
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';

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
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchAlerts = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const res = await axios.get(`${BACK_URL}/fraud-alerts`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setAlerts(res.data);
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
        <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay alertas de fraude</Text>
        </View>
    );

    return (
        <View style={styles.container}>
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
        backgroundColor: '#fff',
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
        backgroundColor: '#f0f4f4',
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
        color: '#111818',
    },
    metaText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#638888',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: '#638888',
    },
});

export default FraudAlerts;
