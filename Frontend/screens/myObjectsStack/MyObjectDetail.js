import React, { useEffect, useState } from 'react';
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
import axiosInstance from '../../utils/axiosInstance';
import Constants from 'expo-constants';
import Icon from 'react-native-vector-icons/FontAwesome6';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_CONFIG = {
    PENDIENTE:   { label: 'Pendiente',               color: '#888',    bg: '#f0f0f0', icon: 'clock' },
    EN_REVISION: { label: 'En revisión',             color: '#b45309', bg: '#fef3c7', icon: 'magnifying-glass' },
    APROBADO:    { label: 'Coincidencia encontrada', color: '#065f46', bg: '#d1fae5', icon: 'circle-check' },
    RECHAZADO:   { label: 'Cerrado',                 color: '#991b1b', bg: '#fee2e2', icon: 'circle-xmark' },
    DEVUELTO:    { label: 'Devuelto',                color: '#1d4ed8', bg: '#dbeafe', icon: 'box-open' },
};

const StatusBadge = ({ status }) => {
    const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.PENDIENTE;
    return (
        <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
            <Icon name={cfg.icon} size={14} color={cfg.color} />
            <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
        </View>
    );
};

const InfoRow = ({ icon, label, value }) => (
    <View style={styles.infoRow}>
        <Icon name={icon} size={14} color="#638888" style={{ marginTop: 2 }} />
        <View style={{ marginLeft: 8, flex: 1 }}>
            <Text style={styles.infoLabel}>{label}</Text>
            <Text style={styles.infoValue}>{value || '—'}</Text>
        </View>
    </View>
);

const MyObjectDetail = ({ route, navigation }) => {
    const { reclamoId } = route.params;
    const [reclamo, setReclamo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetch = async () => {
            try {
                const jwt = await AsyncStorage.getItem('jwt');
                const res = await axiosInstance.get(`${BACK_URL}/reclamos/my/${reclamoId}`, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                setReclamo(res.data);
            } catch (e) {
                console.warn('Error cargando detalle:', e);
            } finally {
                setLoading(false);
            }
        };
        fetch();
    }, [reclamoId]);

    const formatDate = (isoString) => {
        if (!isoString) return '—';
        const d = new Date(isoString);
        return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0d9e9e" />
            </View>
        );
    }

    if (!reclamo) {
        return (
            <View style={styles.centered}>
                <Text style={styles.errorText}>No se pudo cargar el detalle.</Text>
            </View>
        );
    }

    const statusCfg = STATUS_CONFIG[reclamo.status] || STATUS_CONFIG.PENDIENTE;

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>

            {reclamo.b64Json ? (
                <Image
                    source={{ uri: `data:image/jpeg;base64,${reclamo.b64Json}` }}
                    style={styles.image}
                    resizeMode="cover"
                />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Icon name="image" size={40} color="#c0d0d0" />
                    <Text style={styles.imagePlaceholderText}>Sin imagen</Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.title}>
                    {reclamo.foundObjectTitle || reclamo.foundObjectCategory || 'Objeto sin título'}
                </Text>
                <StatusBadge status={reclamo.status} />
            </View>

            {!!reclamo.foundObjectHumanDescription && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Descripción del objeto</Text>
                    <Text style={styles.descText}>{reclamo.foundObjectHumanDescription}</Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información del reclamo</Text>
                <InfoRow icon="calendar" label="Fecha de búsqueda" value={formatDate(reclamo.createdAt)} />
                {!!reclamo.datetimeOfReturn && (
                    <InfoRow icon="box-open" label="Fecha de retiro" value={formatDate(reclamo.datetimeOfReturn)} />
                )}
                <InfoRow icon="tag" label="Categoría" value={reclamo.foundObjectCategory} />
                {!!reclamo.comment && (
                    <InfoRow icon="comment" label="Tu comentario" value={reclamo.comment} />
                )}
                {!!reclamo.foundObjectDate && (
                    <InfoRow icon="box" label="Objeto encontrado el" value={formatDate(reclamo.foundObjectDate)} />
                )}
            </View>

            {reclamo.history && reclamo.history.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Historial de estados</Text>
                    {reclamo.history.map((h, idx) => (
                        <View key={h.id} style={styles.historyItem}>
                            <View style={[styles.historyDot, { backgroundColor: statusCfg.color }]} />
                            <View style={{ flex: 1 }}>
                                <Text style={styles.historyStatus}>
                                    {h.previousStatus
                                        ? `${STATUS_CONFIG[h.previousStatus]?.label || h.previousStatus} → `
                                        : ''}
                                    {STATUS_CONFIG[h.newStatus]?.label || h.newStatus}
                                </Text>
                                <Text style={styles.historyDate}>{formatDate(h.changedAt)}</Text>
                                {!!h.note && <Text style={styles.historyNote}>{h.note}</Text>}
                            </View>
                        </View>
                    ))}
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
        paddingBottom: 32,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    errorText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: '#638888',
    },
    backButton: {
        padding: 16,
        paddingBottom: 8,
    },
    backButtonText: {
        color: '#638888',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    image: {
        width: '100%',
        height: 220,
    },
    imagePlaceholder: {
        width: '100%',
        height: 160,
        backgroundColor: '#f0f4f4',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 8,
    },
    imagePlaceholderText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#aaa',
    },
    section: {
        paddingHorizontal: 16,
        paddingTop: 16,
        gap: 8,
    },
    title: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 20,
        color: '#111818',
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: '#111818',
        marginBottom: 4,
    },
    descText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#444',
        lineHeight: 20,
    },
    badge: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 12,
        gap: 6,
    },
    badgeText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
    },
    infoRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    infoLabel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    infoValue: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#111818',
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 8,
        gap: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    historyDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        marginTop: 4,
    },
    historyStatus: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#111818',
    },
    historyDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    historyNote: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#444',
        marginTop: 2,
        fontStyle: 'italic',
    },
});

export default MyObjectDetail;
