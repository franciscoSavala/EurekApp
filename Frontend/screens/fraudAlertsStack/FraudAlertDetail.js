import React, { useState, useEffect } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import { STATUS_COLORS, STATUS_LABELS, humanizeReason } from '../../utils/fraudLabels';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FraudAlertDetail = ({ route }) => {
    const { alertId } = route.params;
    const { authFetch } = useAuthFetch();
    const [alert, setAlert] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState(false);

    useEffect(() => {
        fetchDetail();
    }, []);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const data = await authFetch('get', `${BACK_URL}/fraud-alerts/${alertId}`);
            setAlert(data);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    // Única acción posible (EU-288): marcar la alerta como falsa alarma, lo que levanta el bloqueo.
    const markFalseAlarm = async () => {
        setResolving(true);
        try {
            await authFetch('post', `${BACK_URL}/fraud-alerts/${alertId}/resolve`, {});
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

    const suspects = alert.suspectUsers || [];

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={[styles.statusChip, { backgroundColor: STATUS_COLORS[alert.status] || '#aaa' }]}>
                <Text style={styles.statusChipText}>{STATUS_LABELS[alert.status] || alert.status}</Text>
            </View>

            <Text style={styles.sectionLabel}>Motivo</Text>
            <Text style={styles.value}>{humanizeReason(alert.reason) || alert.reason}</Text>

            <Text style={styles.sectionLabel}>Detalle</Text>
            <Text style={styles.value}>{alert.details || 'Sin detalle adicional'}</Text>

            <Text style={styles.sectionLabel}>DNI de quien retira</Text>
            <Text style={styles.value}>{alert.dni || 'No especificado'}</Text>

            <Text style={styles.sectionLabel}>
                {suspects.length === 1 ? 'Usuario involucrado' : `Usuarios involucrados (${suspects.length})`}
            </Text>
            {suspects.length > 0 ? (
                suspects.map((u, i) => (
                    <View key={i} style={styles.suspectRow}>
                        <Text style={styles.value}>{u.fullName || 'Desconocido'}</Text>
                        {u.email ? <Text style={styles.metaText}>{u.email}</Text> : null}
                    </View>
                ))
            ) : (
                <Text style={styles.value}>Sin usuarios registrados (solo el DNI)</Text>
            )}

            {alert.returnedByEmployeeFullName ? (
                <>
                    <Text style={styles.sectionLabel}>Empleado que entregó</Text>
                    <Text style={styles.value}>{alert.returnedByEmployeeFullName}</Text>
                    {alert.returnedByEmployeeEmail ? (
                        <Text style={styles.metaText}>{alert.returnedByEmployeeEmail}</Text>
                    ) : null}
                </>
            ) : null}

            {alert.foundObjectTitle ? (
                <>
                    <Text style={styles.sectionLabel}>Objeto asociado</Text>
                    <Text style={styles.value}>{alert.foundObjectTitle}</Text>
                    {alert.foundObjectDescription ? (
                        <Text style={styles.metaText}>{alert.foundObjectDescription}</Text>
                    ) : null}
                </>
            ) : null}

            <Text style={styles.sectionLabel}>Fecha de detección</Text>
            <Text style={styles.value}>
                {alert.createdAt ? new Date(alert.createdAt).toLocaleString('es-AR') : '-'}
            </Text>

            {alert.status !== 'ACTIVE' && (
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
                    El DNI y los usuarios involucrados fueron bloqueados automáticamente al detectarse la alerta.
                    Si se trató de un error, marcá la alerta como falsa alarma para levantar el bloqueo.
                </Text>
            </View>

            {alert.status === 'ACTIVE' && (
                <View style={styles.buttonsRow}>
                    {resolving ? (
                        <ActivityIndicator size="small" color="#111818" />
                    ) : (
                        <TouchableOpacity
                            style={[styles.btn, { backgroundColor: '#008000' }]}
                            onPress={markFalseAlarm}>
                            <Text style={styles.btnText}>Marcar falsa alarma</Text>
                        </TouchableOpacity>
                    )}
                </View>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        color: colors.textMuted,
        marginTop: 16,
        marginBottom: 2,
    },
    value: {
        fontSize: 15,
        fontFamily: 'PlusJakartaSans-Regular',
        color: colors.text,
    },
    metaText: {
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: colors.textMuted,
    },
    suspectRow: {
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#e5e7eb',
    },
    infoBox: {
        marginTop: 24,
        backgroundColor: colors.surface,
        borderRadius: 10,
        padding: 14,
    },
    infoText: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: colors.textMuted,
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
