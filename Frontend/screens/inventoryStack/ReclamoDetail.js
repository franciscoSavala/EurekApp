import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Image,
    ScrollView,
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

const ReclamoDetail = ({ route }) => {
    const { reclamoId } = route.params;
    const [reclamo, setReclamo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const res = await axios.get(`${BACK_URL}/reclamos/${reclamoId}`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            setReclamo(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchDetail();
        }, [reclamoId])
    );

    const handleStatusUpdate = async (newStatus) => {
        setUpdating(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            await axios.put(
                `${BACK_URL}/reclamos/${reclamoId}/status`,
                { newStatus },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
            await fetchDetail();
        } catch (e) {
            console.error(e);
        } finally {
            setUpdating(false);
        }
    };

    const renderStars = (rating) => {
        if (!rating) return '';
        return '★'.repeat(rating) + '☆'.repeat(5 - rating);
    };

    const formatDate = (dt) => {
        if (!dt) return '-';
        const d = new Date(dt);
        return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#111818" />
            </View>
        );
    }

    if (!reclamo) {
        return (
            <View style={styles.loadingContainer}>
                <Text style={styles.errorText}>No se pudo cargar el reclamo.</Text>
            </View>
        );
    }

    const statusColor = STATUS_COLORS[reclamo.status] || '#638888';
    const statusLabel = STATUS_LABELS[reclamo.status] || reclamo.status;

    return (
        <ScrollView contentContainerStyle={styles.container}>

            {/* Estado e indicadores */}
            <View style={styles.section}>
                <View style={styles.statusRow}>
                    <View style={[styles.statusBadgeLarge, { backgroundColor: statusColor }]}>
                        <Text style={styles.statusBadgeLargeText}>{statusLabel}</Text>
                    </View>
                    <Text style={styles.confidencePill}>
                        Confianza: {reclamo.confidenceLevel || '-'}
                    </Text>
                    {reclamo.isSuspicious && (
                        <View style={styles.suspiciousBadge}>
                            <Text style={styles.suspiciousBadgeText}>⚠ Sospechoso</Text>
                        </View>
                    )}
                </View>
            </View>

            {/* Reclamante */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Reclamante</Text>
                <InfoRow label="Nombre" value={reclamo.userFullName} />
                <InfoRow label="Email" value={reclamo.userEmail} />
                <InfoRow label="ID usuario" value={reclamo.userId != null ? String(reclamo.userId) : '-'} />
                {reclamo.isSuspicious && (
                    <View style={styles.fraudWarning}>
                        <Text style={styles.fraudWarningText}>
                            ⚠ Este usuario tiene alertas de fraude confirmadas en tu organización.
                        </Text>
                    </View>
                )}
            </View>

            {/* Objeto encontrado */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Objeto encontrado</Text>
                {reclamo.b64Json ? (
                    <Image
                        source={{ uri: `data:image/jpeg;base64,${reclamo.b64Json}` }}
                        style={styles.objectImage}
                        resizeMode="cover"
                    />
                ) : null}
                <InfoRow label="Título" value={reclamo.foundObjectTitle} />
                <InfoRow label="Categoría" value={reclamo.foundObjectCategory} />
                <InfoRow label="Descripción" value={reclamo.foundObjectHumanDescription} />
                <InfoRow label="Descripción AI" value={reclamo.foundObjectAiDescription} />
                <InfoRow label="Fecha de hallazgo" value={formatDate(reclamo.foundObjectDate)} />
                {reclamo.foundObjectLatitude != null && (
                    <InfoRow
                        label="Ubicación"
                        value={`${reclamo.foundObjectLatitude?.toFixed(5)}, ${reclamo.foundObjectLongitude?.toFixed(5)}`}
                    />
                )}
            </View>

            {/* Info del reclamo */}
            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información del reclamo</Text>
                <InfoRow label="Fecha del reclamo" value={formatDate(reclamo.createdAt)} />
                <InfoRow label="Última actualización" value={formatDate(reclamo.updatedAt)} />
                {reclamo.starRating ? (
                    <InfoRow label="Puntuación" value={renderStars(reclamo.starRating)} />
                ) : null}
                {reclamo.comment ? (
                    <InfoRow label="Comentario" value={reclamo.comment} />
                ) : null}
            </View>

            {/* Botones de acción */}
            {reclamo.status === 'PENDIENTE' && (
                <View style={styles.actionsSection}>
                    <Text style={styles.sectionTitle}>Acciones</Text>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#3b82f6' }]}
                        onPress={() => handleStatusUpdate('EN_REVISION')}
                        disabled={updating}>
                        {updating
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.actionBtnText}>Marcar en revisión</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {reclamo.status === 'EN_REVISION' && (
                <View style={styles.actionsSection}>
                    <Text style={styles.sectionTitle}>Acciones</Text>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#22c55e' }]}
                        onPress={() => handleStatusUpdate('APROBADO')}
                        disabled={updating}>
                        {updating
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.actionBtnText}>Aprobar reclamo</Text>}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.actionBtn, { backgroundColor: '#ED4337', marginTop: 8 }]}
                        onPress={() => handleStatusUpdate('RECHAZADO')}
                        disabled={updating}>
                        {updating
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.actionBtnText}>Rechazar reclamo</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {/* Historial */}
            {reclamo.history && reclamo.history.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Historial del reclamo</Text>
                    {reclamo.history.map((h, idx) => (
                        <View key={h.id || idx} style={styles.historyItem}>
                            <View style={styles.historyDot} />
                            <View style={styles.historyContent}>
                                <Text style={styles.historyChange}>
                                    {h.previousStatus
                                        ? `${STATUS_LABELS[h.previousStatus] || h.previousStatus} → ${STATUS_LABELS[h.newStatus] || h.newStatus}`
                                        : `Establecido: ${STATUS_LABELS[h.newStatus] || h.newStatus}`}
                                </Text>
                                <Text style={styles.historyMeta}>
                                    {formatDate(h.changedAt)} · {h.changedByEmail || '-'}
                                </Text>
                                {h.note ? <Text style={styles.historyNote}>{h.note}</Text> : null}
                            </View>
                        </View>
                    ))}
                </View>
            )}
        </ScrollView>
    );
};

const InfoRow = ({ label, value }) => (
    <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>{label}:</Text>
        <Text style={styles.infoValue}>{value || '-'}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        padding: 16,
        backgroundColor: '#fff',
        paddingBottom: 40,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    errorText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#638888',
    },
    section: {
        marginBottom: 20,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: '#111818',
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
        paddingBottom: 4,
    },
    statusRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
    },
    statusBadgeLarge: {
        borderRadius: 12,
        paddingVertical: 5,
        paddingHorizontal: 14,
    },
    statusBadgeLargeText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
    confidencePill: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
        backgroundColor: '#f0f4f4',
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    suspiciousBadge: {
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        paddingVertical: 3,
        paddingHorizontal: 10,
    },
    suspiciousBadgeText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 12,
        color: '#b45309',
    },
    fraudWarning: {
        backgroundColor: '#fef3c7',
        borderRadius: 10,
        padding: 10,
        marginTop: 8,
    },
    fraudWarningText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#b45309',
    },
    objectImage: {
        width: '100%',
        height: 200,
        borderRadius: 12,
        marginBottom: 10,
        maxWidth: 400,
    },
    infoRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        marginBottom: 6,
    },
    infoLabel: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#638888',
        marginRight: 6,
        minWidth: 120,
    },
    infoValue: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#111818',
        flex: 1,
    },
    actionsSection: {
        marginBottom: 20,
        maxWidth: 800,
        width: '100%',
        alignSelf: 'center',
    },
    actionBtn: {
        borderRadius: 24,
        paddingVertical: 12,
        alignItems: 'center',
    },
    actionBtnText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
    historyItem: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    historyDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#111818',
        marginTop: 4,
        marginRight: 10,
    },
    historyContent: {
        flex: 1,
    },
    historyChange: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#111818',
    },
    historyMeta: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 11,
        color: '#638888',
        marginTop: 2,
    },
    historyNote: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#111818',
        marginTop: 2,
        fontStyle: 'italic',
    },
});

export default ReclamoDetail;
