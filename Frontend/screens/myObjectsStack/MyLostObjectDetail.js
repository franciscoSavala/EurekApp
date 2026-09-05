import React, { useState } from 'react';
import { formatDateTimeLocaleES } from '../../utils/dateFormatter';
import { CATEGORY_LABELS } from '../../utils/constants';
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
import AppImage from '../components/AppImage';
import UsabilityFeedbackModal from '../components/UsabilityFeedbackModal';

const BACK_URL = Constants.expoConfig.extra.backUrl;

// Con tres estados el booleano isClosed ya no alcanza, y encadenar ternarios en cada lugar donde
// se muestra el estado se vuelve ilegible. Cada estado declara acá cómo se ve.
const STATUS_META = {
    ACTIVE:         { label: 'Buscando',    icon: 'clock',        bg: '#ccf2f2', color: '#0d6e6e' },
    PENDING_PICKUP: { label: 'Por retirar', icon: 'box-open',     bg: '#fdeccd', color: '#b45309' },
    CLOSED:         { label: 'Cerrada',     icon: 'circle-check', bg: '#e6ecec', color: '#638888' },
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

const MyLostObjectDetail = ({ route, navigation }) => {
    const { lostObject } = route.params;
    const { authFetch } = useAuthFetch();
    const status = lostObject.status || 'ACTIVE';
    const isClosed = status === 'CLOSED';
    const isPendingPickup = status === 'PENDING_PICKUP';
    const statusMeta = STATUS_META[status] || STATUS_META.ACTIVE;
    const [promptVisible, setPromptVisible] = useState(false);
    const [reopenPromptVisible, setReopenPromptVisible] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [feedbackVisible, setFeedbackVisible] = useState(false);

    const closeSearch = async (recovered) => {
        setSubmitting(true);
        try {
            await authFetch('post', `${BACK_URL}/lost-objects/${lostObject.uuid}/close`, { recovered });
            Toast.show({ type: 'success', text1: 'Búsqueda cerrada' });
            setPromptVisible(false);
            /* EU-369: cerrar la búsqueda es el momento en que la persona ya recorrió la aplicación
             * entera —cargó el objeto, recibió avisos, revisó coincidencias— y puede opinar sobre
             * ella. Antes se le preguntaba al empleado al cargar cada objeto, que es quien menos
             * tiene para decir sobre la experiencia de buscar.
             *
             * Se pregunta tanto si recuperó el objeto como si no: las dos experiencias importan, y
             * la segunda más. La búsqueda YA quedó cerrada en el servidor antes de esto, así que
             * omitir la encuesta no deshace nada. */
            setFeedbackVisible(true);
        } catch (e) {
            const msg = e?.response?.data?.message || 'No se pudo cerrar la búsqueda. Intentá de nuevo.';
            Toast.show({ type: 'error', text1: 'Error', text2: msg });
        } finally {
            setSubmitting(false);
        }
    };

    /* La búsqueda ya está cerrada; la encuesta es lo último que queda antes de volver al listado,
     * tanto si la responde como si la omite. */
    const handleFeedbackClose = () => {
        setFeedbackVisible(false);
        navigation.goBack();
    };

    // Fue hasta la organización, vio el objeto y no era el suyo: la búsqueda NO se cierra, vuelve a
    // "Buscando" y sigue recibiendo avisos.
    const reopenSearch = async () => {
        setSubmitting(true);
        try {
            await authFetch('post', `${BACK_URL}/lost-objects/${lostObject.uuid}/reopen`);
            Toast.show({
                type: 'success',
                text1: 'Seguimos buscando',
                text2: 'Te avisamos si aparece otro objeto parecido.',
            });
            setReopenPromptVisible(false);
            navigation.goBack();
        } catch (e) {
            const msg = e?.response?.data?.message || 'No se pudo actualizar la búsqueda. Intentá de nuevo.';
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

            {/* EU-326: la foto es opcional al guardar; sin ella el backend no manda imageUrl. */}
            {lostObject.imageUrl ? (
                <AppImage
                    imageUrl={lostObject.imageUrl}
                    style={styles.image}
                    resizeMode="contain"
                    accessibilityLabel="Foto de la búsqueda guardada"
                />
            ) : (
                <View style={styles.imagePlaceholder}>
                    <Icon name="magnifying-glass" size={40} color="#c0d0d0" />
                    <Text style={styles.imagePlaceholderText}>Búsqueda guardada sin foto</Text>
                </View>
            )}

            <View style={styles.section}>
                <Text style={styles.title}>Búsqueda guardada</Text>
                <View style={[styles.badge, { backgroundColor: statusMeta.bg }]}>
                    <Icon name={statusMeta.icon} size={14} color={statusMeta.color} />
                    <Text style={[styles.badgeText, { color: statusMeta.color }]}>
                        {statusMeta.label}
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
                <InfoRow icon="calendar" label="Fecha y hora en la que lo perdiste" value={formatDateTimeLocaleES(lostObject.lostDate)} />
                {/* La categoría la deduce la IA y el filtro es DURO: si se infirió mal, el objeto no
                    aparece nunca y sin señal alguna. Se muestra siempre —incluso cuando no se pudo
                    deducir— para que el usuario pueda darse cuenta. */}
                <InfoRow
                    icon="tag"
                    label="Categoría detectada"
                    value={lostObject.category
                        ? (CATEGORY_LABELS[lostObject.category] || lostObject.category)
                        : 'Sin determinar'}
                />
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
                {/* El id de la organización no le dice nada al usuario: se muestra el nombre. */}
                {!!lostObject.organizationName && (
                    <InfoRow icon="building" label="Organización en la que lo perdiste" value={lostObject.organizationName} />
                )}
            </View>

            {isClosed && (
                <View style={styles.infoBox}>
                    <Icon name="circle-info" size={16} color="#638888" />
                    <Text style={styles.infoBoxText}>
                        Esta búsqueda está cerrada. Si seguís buscando, registrá una nueva.
                    </Text>
                </View>
            )}

            {isPendingPickup && (
                <>
                    <View style={[styles.infoBox, styles.pickupBox]}>
                        <Icon name="box-open" size={16} color="#b45309" />
                        <View style={{ flex: 1, gap: 4 }}>
                            <Text style={[styles.infoBoxText, styles.pickupText, styles.pickupTitle]}>
                                Reconociste un objeto como tuyo
                            </Text>
                            {/* El nombre y el contacto se resuelven a partir del objeto reclamado. Si
                                el objeto ya no está, vienen vacíos y no se muestra la línea, en vez
                                de un renglón a medias. */}
                            {!!lostObject.matchedOrganizationName && (
                                <Text style={[styles.infoBoxText, styles.pickupText]}>
                                    Retiralo en {lostObject.matchedOrganizationName}.
                                </Text>
                            )}
                            {!!lostObject.matchedOrganizationContactData && (
                                <Text style={[styles.infoBoxText, styles.pickupText]}>
                                    Contacto: {lostObject.matchedOrganizationContactData}
                                </Text>
                            )}
                            <Text style={[styles.infoBoxText, styles.pickupText]}>
                                Por seguridad te van a pedir algunos datos y una foto antes de entregártelo.
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.closeButton} onPress={() => setPromptVisible(true)}>
                        <Text style={styles.closeButtonText}>Cerrar búsqueda</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={styles.secondaryButton}
                                      onPress={() => setReopenPromptVisible(true)}>
                        <Text style={styles.secondaryButtonText}>No era mi objeto</Text>
                    </TouchableOpacity>
                </>
            )}

            {!isClosed && !isPendingPickup && (
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
            )}

            <Modal visible={reopenPromptVisible} transparent animationType="fade"
                   onRequestClose={() => setReopenPromptVisible(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>¿El objeto no era tuyo?</Text>
                        {/* Se aclara que la búsqueda NO se cierra: es lo que la diferencia del otro
                            modal, que sí es definitivo. */}
                        <Text style={styles.modalSubtitle}>
                            Tu búsqueda vuelve a "Buscando" y te seguimos avisando si aparece otro
                            objeto parecido. No se cierra.
                        </Text>
                        {submitting ? (
                            <ActivityIndicator size="large" color="#0d9e9e" style={{ marginVertical: 12 }} />
                        ) : (
                            <View style={styles.modalButtons}>
                                <TouchableOpacity style={[styles.modalBtn, styles.modalBtnYes]} onPress={reopenSearch}>
                                    <Text style={styles.modalBtnText}>Seguir buscando</Text>
                                </TouchableOpacity>
                            </View>
                        )}
                        {!submitting && (
                            <TouchableOpacity onPress={() => setReopenPromptVisible(false)}>
                                <Text style={styles.modalCancel}>Cancelar</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

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
            <UsabilityFeedbackModal
                visible={feedbackVisible}
                onClose={handleFeedbackClose}
                context="close_search"
            />
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
    image: {
        // La foto la saca el usuario y suele ser vertical: 'contain' dentro de un cuadrado acotado
        // y centrado. Con 'cover' a lo ancho de la pantalla quedaba un recorte enorme e ilegible.
        width: '100%',
        maxWidth: 360,
        aspectRatio: 1,
        alignSelf: 'center',
        borderRadius: 16,
        marginBottom: 8,
        backgroundColor: '#f0f4f4',
    },
    imagePlaceholder: {
        // Mismo formato que la foto, para que la pantalla no cambie de forma según haya o no imagen.
        width: '100%',
        maxWidth: 360,
        aspectRatio: 1,
        alignSelf: 'center',
        borderRadius: 16,
        marginBottom: 8,
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
    badgeText: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 13,
        color: '#0d6e6e',
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
    pickupBox: {
        backgroundColor: '#fdeccd',
    },
    pickupText: {
        color: '#8a4008',
    },
    pickupTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
    },
    secondaryButton: {
        marginHorizontal: 16,
        marginTop: 10,
        borderRadius: 24,
        paddingVertical: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#c9d4d4',
    },
    secondaryButtonText: {
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
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
