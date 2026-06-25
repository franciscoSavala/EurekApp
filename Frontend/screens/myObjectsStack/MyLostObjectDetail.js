import React, { useState } from 'react';
import { formatDateTimeLocaleES } from '../../utils/dateFormatter';
import {
    ActivityIndicator,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import Icon from 'react-native-vector-icons/FontAwesome6';
import useAuthFetch from '../../utils/useAuthFetch';

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

const MyLostObjectDetail = ({ route, navigation }) => {
    const { lostObject } = route.params;
    const { authFetch } = useAuthFetch();
    const isClosed = lostObject.status === 'CLOSED';
    const [promptVisible, setPromptVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    const closeSearch = async (recovered) => {
        setSubmitting(true);
        try {
            await authFetch('post', `${BACK_URL}/lost-objects/${lostObject.uuid}/close`, { recovered });
            Toast.show({ type: 'success', text1: 'Búsqueda cerrada' });
            setPromptVisible(false);
            navigation.goBack();
        } catch (e) {
            const msg = e?.response?.data?.message || 'No se pudo cerrar la búsqueda. Intentá de nuevo.';
            Toast.show({ type: 'error', text1: 'Error', text2: msg });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                <Text style={styles.backButtonText}>← Volver</Text>
            </TouchableOpacity>

            <View style={styles.imagePlaceholder}>
                <Icon name="magnifying-glass" size={40} color="#c0d0d0" />
                <Text style={styles.imagePlaceholderText}>Búsqueda guardada</Text>
            </View>

            <View style={styles.section}>
                <Text style={styles.title}>Búsqueda guardada</Text>
                <View style={[styles.badge, isClosed && styles.badgeClosed]}>
                    <Icon name={isClosed ? 'circle-check' : 'clock'} size={14} color={isClosed ? '#638888' : '#0d6e6e'} />
                    <Text style={[styles.badgeText, isClosed && styles.badgeTextClosed]}>
                        {isClosed ? 'Cerrada' : 'Buscando'}
                    </Text>
                </View>
            </View>

            {!!lostObject.description && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Descripción de la búsqueda</Text>
                    <Text style={styles.descText}>{lostObject.description}</Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.sectionTitle}>Información</Text>
                <InfoRow icon="calendar" label="Fecha de registro" value={formatDateTimeLocaleES(lostObject.lostDate)} />
                {isClosed && !!lostObject.closedDate && (
                    <InfoRow icon="circle-check" label="Cerrada el" value={formatDateTimeLocaleES(lostObject.closedDate)} />
                )}
                {isClosed && lostObject.recovered != null && (
                    <InfoRow
                        icon={lostObject.recovered ? 'circle-check' : 'circle-xmark'}
                        label="¿Recuperaste tu objeto?"
                        value={lostObject.recovered ? 'Sí, lo recuperé' : 'No lo recuperé'}
                    />
                )}
                {!!lostObject.organizationId && (
                    <InfoRow icon="building" label="Organización" value={lostObject.organizationId} />
                )}
            </View>

            {!isClosed ? (
                <>
                    <View style={styles.infoBox}>
                        <Icon name="bell" size={16} color="#0d6e6e" />
                        <Text style={styles.infoBoxText}>
                            Te notificaremos por email cuando encontremos un objeto similar al que describiste.
                        </Text>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={() => setPromptVisible(true)}>
                        <Text style={styles.closeButtonText}>Cerrar búsqueda</Text>
                    </TouchableOpacity>
                </>
            ) : (
                <View style={styles.infoBox}>
                    <Icon name="circle-info" size={16} color="#638888" />
                    <Text style={styles.infoBoxText}>
                        Esta búsqueda está cerrada. Si seguís buscando, registrá una nueva.
                    </Text>
                </View>
            )}

            <Modal visible={promptVisible} transparent animationType="fade" onRequestClose={() => setPromptVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>¿Recuperaste tu objeto?</Text>
                        <Text style={styles.modalSubtitle}>
                            Esto cierra la búsqueda de forma definitiva. No se puede reabrir.
                        </Text>
                        {submitting ? (
                            <ActivityIndicator size="large" color="#0d9e9e" style={{ marginVertical: 12 }} />
                        ) : (
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnYes]} onPress={() => closeSearch(true)}>
                                    <Text style={styles.modalBtnText}>Sí</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnNo]} onPress={() => closeSearch(false)}>
                                    <Text style={styles.modalBtnText}>No</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {!submitting && (
                            <TouchableOpacity onPress={() => setPromptVisible(false)}>
                                <Text style={styles.modalCancel}>Cancelar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>
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
    backButton: {
        padding: 16,
        paddingBottom: 8,
    },
    backButtonText: {
        color: '#638888',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
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
        backgroundColor: '#ccf2f2',
    },
    badgeClosed: {
        backgroundColor: '#e6ecec',
    },
    badgeText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#0d6e6e',
    },
    badgeTextClosed: {
        color: '#638888',
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
    infoBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginHorizontal: 16,
        marginTop: 20,
        backgroundColor: '#e6fafa',
        borderRadius: 12,
        padding: 14,
    },
    infoBoxText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#0d6e6e',
        flex: 1,
        lineHeight: 18,
    },
    closeButton: {
        backgroundColor: '#0d9e9e',
        marginHorizontal: 16,
        marginTop: 20,
        borderRadius: 24,
        paddingVertical: 12,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.4)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 32,
    },
    modalCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 24,
        width: '100%',
        maxWidth: 360,
        alignItems: 'center',
        gap: 12,
    },
    modalTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 18,
        color: '#111818',
        textAlign: 'center',
    },
    modalSubtitle: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
        textAlign: 'center',
        lineHeight: 18,
    },
    modalButtons: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalBtn: {
        borderRadius: 24,
        paddingVertical: 10,
        paddingHorizontal: 36,
        alignItems: 'center',
    },
    modalBtnYes: {
        backgroundColor: '#0d9e9e',
    },
    modalBtnNo: {
        backgroundColor: '#638888',
    },
    modalBtnText: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
    },
    modalCancel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#638888',
        marginTop: 8,
    },
});

export default MyLostObjectDetail;
