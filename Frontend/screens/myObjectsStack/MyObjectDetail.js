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
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import Icon from 'react-native-vector-icons/FontAwesome6';
import { ROLE_LABELS } from '../../utils/constants';

const BACK_URL = Constants.expoConfig.extra.backUrl;

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
    const { authFetch } = useAuthFetch();
    const [reclamo, setReclamo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const load = async () => {
            try {
                const data = await authFetch('get', `${BACK_URL}/reclamos/my/${reclamoId}`);
                setReclamo(data);
            } catch (e) {
                console.warn('Error cargando detalle:', e);
            } finally {
                setLoading(false);
            }
        };
        load();
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
                <InfoRow icon="tag" label="Categoría" value={reclamo.foundObjectCategory} />
                {!!reclamo.comment && (
                    <InfoRow icon="comment" label="Tu comentario" value={reclamo.comment} />
                )}
                {!!reclamo.foundObjectDate && (
                    <InfoRow icon="box" label="Objeto encontrado el" value={formatDate(reclamo.foundObjectDate)} />
                )}
                {!!reclamo.finderFullName && (
                    <InfoRow icon="user" label="Encontrado por"
                        value={`${reclamo.finderFullName}${reclamo.finderRole ? ` (${ROLE_LABELS[reclamo.finderRole] || reclamo.finderRole})` : ''}`} />
                )}
                {reclamo.rewardExcluded && (
                    <View style={styles.warningBox}>
                        <Text style={styles.warningText}>{reclamo.rewardExclusionReason}</Text>
                    </View>
                )}
            </View>

        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
    },
    content: {
        paddingBottom: 32,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    errorText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: colors.textMuted,
    },
    backButton: {
        padding: 16,
        paddingBottom: 8,
    },
    backButtonText: {
        color: colors.textMuted,
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
        backgroundColor: colors.surface,
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
        color: colors.text,
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
        color: colors.text,
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
        color: colors.textMuted,
    },
    infoValue: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: colors.text,
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
        color: colors.text,
    },
    historyDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.textMuted,
    },
    historyNote: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#444',
        marginTop: 2,
        fontStyle: 'italic',
    },
    warningBox: {
        backgroundColor: colors.warningBg,
        borderRadius: 10,
        padding: 12,
        marginTop: 8,
    },
    warningText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.warning,
    },
});

export default MyObjectDetail;
