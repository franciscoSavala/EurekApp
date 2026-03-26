import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import Constants from 'expo-constants';

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

const FraudAlertDetail = ({ route }) => {
    const { alertId } = route.params;
    const [alert, setAlert] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        fetchDetail();
    }, []);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const res = await axios.get(`${BACK_URL}/fraud-alerts/${alertId}`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setAlert(res.data);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    const resolve = async (resolution) => {
        setResolving(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            await axios.post(
                `${BACK_URL}/fraud-alerts/${alertId}/resolve`,
                { resolution },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            await fetchDetail();
        } catch (error) {
            console.log(error);
        } finally {
            setResolving(false);
        }
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#111818" />
            </View>
        );
    }

    if (!alert) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.metaText}>No se pudo cargar la alerta.</Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[alert.status] || '#aaa' }]}>
                <Text style={styles.statusChipText}>{STATUS_LABELS[alert.status] || alert.status}</Text>
            </View>

            <Text style={styles.sectionLabel}>Motivo</Text>
            <Text style={styles.value}>{REASON_LABELS[alert.reason] || alert.reason}</Text>

            <Text style={styles.sectionLabel}>Detalle</Text>
            <Text style={styles.value}>{alert.details || 'Sin detalle adicional'}</Text>

            <Text style={styles.sectionLabel}>Usuario sospechoso</Text>
            <Text style={styles.value}>
                {alert.suspectUserFullName || 'Desconocido'}
                {alert.suspectUserEmail ? `\n${alert.suspectUserEmail}` : ''}
            </Text>

            <Text style={styles.sectionLabel}>Objeto asociado</Text>
            <Text style={styles.value}>{alert.foundObjectUUID || 'No especificado'}</Text>

            <Text style={styles.sectionLabel}>Fecha de detección</Text>
            <Text style={styles.value}>
                {alert.createdAt ? new Date(alert.createdAt).toLocaleString('es-AR') : '-'}
            </Text>

            {alert.status !== 'PENDING' && (
                <>
                    <Text style={styles.sectionLabel}>Resuelto por</Text>
                    <Text style={styles.value}>{alert.resolvedByEmail || '-'}</Text>
                    <Text style={styles.sectionLabel}>Fecha de resolución</Text>
                    <Text style={styles.value}>
                        {alert.resolvedAt ? new Date(alert.resolvedAt).toLocaleString('es-AR') : '-'}
                    </Text>
                </>
            )}

            <View style={styles.infoBox}>
                <Text style={styles.infoText}>
                    El usuario no será bloqueado automáticamente. La revisión humana es obligatoria antes de tomar cualquier acción.
                </Text>
            </View>

            {alert.status === 'PENDING' && (
                <View style={styles.buttonsRow}>
                    {resolving ? (
                        <ActivityIndicator size="small" color="#111818" />
                    ) : (
                        <>
                            <TouchableOpacity
                                style={[styles.btn, { backgroundColor: '#ED4337' }]}
                                onPress={() => resolve('CONFIRMED_FRAUD')}>
                                <Text style={styles.btnText}>Confirmar fraude</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.btn, { backgroundColor: '#008000' }]}
                                onPress={() => resolve('FALSE_POSITIVE')}>
                                <Text style={styles.btnText}>Falso positivo</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    content: {
        padding: 20,
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    statusChip: {
        alignSelf: 'flex-start',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 12,
        marginBottom: 20,
    },
    statusChipText: {
        color: 'white',
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    sectionLabel: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#638888',
        marginTop: 16,
        marginBottom: 2,
    },
    value: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#111818',
    },
    metaText: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#638888',
    },
    infoBox: {
        marginTop: 24,
        backgroundColor: '#f0f4f4',
        borderRadius: 10,
        padding: 14,
    },
    infoText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#638888',
    },
    buttonsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 24,
    },
    btn: {
        flex: 1,
        paddingVertical: 12,
        borderRadius: 24,
        alignItems: 'center',
    },
    btnText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
});

export default FraudAlertDetail;
