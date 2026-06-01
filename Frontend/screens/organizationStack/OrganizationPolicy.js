import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Constants from 'expo-constants';
import useAuthFetch from '../../utils/useAuthFetch';
import { colors } from '../../styles/globalStyles';
import { useFocusEffect } from '@react-navigation/native';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ORG_TYPE_OPTIONS = [
    { label: 'Universidad', value: 'UNIVERSITY' },
    { label: 'Escuela / colegio', value: 'SCHOOL' },
    { label: 'Hospital / clínica', value: 'HOSPITAL' },
    { label: 'Hotel', value: 'HOTEL' },
    { label: 'Restaurante / bar', value: 'RESTAURANT' },
    { label: 'Terminal de ómnibus', value: 'BUS_TERMINAL' },
    { label: 'Estación de tren', value: 'TRAIN_STATION' },
    { label: 'Complejo deportivo', value: 'SPORTS_COMPLEX' },
    { label: 'Gimnasio', value: 'GYM' },
    { label: 'Empresa / oficina corporativa', value: 'CORPORATE_OFFICE' },
    { label: 'Coworking', value: 'COWORKING' },
    { label: 'Cine', value: 'CINEMA' },
    { label: 'Teatro', value: 'THEATER' },
    { label: 'Estadio', value: 'STADIUM' },
    { label: 'Evento / festival', value: 'EVENT' },
    { label: 'Municipalidad', value: 'CITY_HALL' },
    { label: 'Biblioteca', value: 'LIBRARY' },
    { label: 'Museo', value: 'MUSEUM' },
    { label: 'Casino', value: 'CASINO' },
    { label: 'Parque recreativo', value: 'RECREATIONAL_PARK' },
    { label: 'Camping', value: 'CAMPING' },
    { label: 'Crucero / puerto', value: 'CRUISE_PORT' },
    { label: 'Iglesia / templo', value: 'CHURCH' },
    { label: 'Supermercado', value: 'SUPERMARKET' },
    { label: 'Centro comercial', value: 'SHOPPING_MALL' },
    { label: 'Centro de convenciones', value: 'CONVENTION_CENTER' },
    { label: 'Parque de diversiones', value: 'AMUSEMENT_PARK' },
    { label: 'Balneario / playa privada', value: 'PRIVATE_BEACH' },
    { label: 'Otro', value: 'OTHER' },
];

const orgTypeLabel = value => {
    const opt = ORG_TYPE_OPTIONS.find(o => o.value === value);
    return opt ? opt.label : 'Seleccionar...';
};

const OrganizationPolicy = () => {
    const { authFetch } = useAuthFetch();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveOk, setSaveOk] = useState(null);
    const [history, setHistory] = useState([]);
    const [historyExpanded, setHistoryExpanded] = useState(false);

    const [maxStorageDays, setMaxStorageDays] = useState('');
    const [requiresIdentityValidation, setRequiresIdentityValidation] = useState(false);
    const [requiresAdditionalEvidence, setRequiresAdditionalEvidence] = useState(false);
    const [additionalEvidenceDetails, setAdditionalEvidenceDetails] = useState('');
    const [organizationType, setOrganizationType] = useState('OTHER');
    const [orgTypePickerOpen, setOrgTypePickerOpen] = useState(false);

    const fetchPolicy = async () => {
        setLoading(true);
        try {
            const p = await authFetch('get', `${BACK_URL}/organizations/policy`);
            setMaxStorageDays(p.maxStorageDays != null ? String(p.maxStorageDays) : '');
            setRequiresIdentityValidation(p.requiresIdentityValidation === true);
            setRequiresAdditionalEvidence(p.requiresAdditionalEvidence === true);
            setAdditionalEvidenceDetails(p.additionalEvidenceDetails || '');
            setOrganizationType(p.organizationType || 'OTHER');
            setHistory(p.history || []);
        } catch (error) {
            console.log(error);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            fetchPolicy();
        }, [])
    );

    const handleSave = async () => {
        setSaving(true);
        setSaveOk(null);
        try {
            await authFetch('put', `${BACK_URL}/organizations/policy`, {
                maxStorageDays: maxStorageDays ? parseInt(maxStorageDays, 10) : null,
                requiresIdentityValidation,
                requiresAdditionalEvidence,
                additionalEvidenceDetails: additionalEvidenceDetails || null,
                organizationType: organizationType || null,
            });
            setSaveOk(true);
            fetchPolicy();
        } catch (error) {
            console.log(error);
            setSaveOk(false);
        } finally {
            setSaving(false);
        }
    };

    const SectionTitle = ({ text }) => (
        <Text style={styles.sectionTitle}>{text}</Text>
    );

    const FieldLabel = ({ text }) => (
        <Text style={styles.fieldLabel}>{text}</Text>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.text} />
            </View>
        );
    }

    return (
        <View style={styles.screen}>
            <ScrollView contentContainerStyle={styles.container}>
            <SectionTitle text="Almacenamiento" />
            <FieldLabel text="Tiempo máximo de almacenamiento (días)" />
            <TextInput
                style={styles.input}
                placeholder="Sin límite"
                placeholderTextColor={colors.textMuted}
                keyboardType="numeric"
                value={maxStorageDays}
                onChangeText={v => setMaxStorageDays(v.replace(/[^0-9]/g, ''))}
            />

            <SectionTitle text="Tipo de organización" />
            <TouchableOpacity style={styles.dropdown} onPress={() => setOrgTypePickerOpen(true)}>
                <Text style={styles.dropdownText}>{orgTypeLabel(organizationType)}</Text>
                <Text style={styles.dropdownChevron}>▾</Text>
            </TouchableOpacity>
            <Modal
                visible={orgTypePickerOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setOrgTypePickerOpen(false)}>
                <Pressable style={styles.modalBackdrop} onPress={() => setOrgTypePickerOpen(false)}>
                    <Pressable style={styles.modalCard} onPress={() => {}}>
                        <Text style={styles.modalTitle}>Tipo de organización</Text>
                        <ScrollView style={styles.modalList}>
                            {ORG_TYPE_OPTIONS.map(opt => (
                                <TouchableOpacity
                                    key={opt.value}
                                    style={[styles.modalOption, organizationType === opt.value && styles.modalOptionActive]}
                                    onPress={() => {
                                        setOrganizationType(opt.value);
                                        setOrgTypePickerOpen(false);
                                    }}>
                                    <Text style={[styles.modalOptionText, organizationType === opt.value && styles.modalOptionTextActive]}>
                                        {opt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </Pressable>
                </Pressable>
            </Modal>

            <SectionTitle text="Validación de identidad" />
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Requerir validación de identidad</Text>
                <Switch
                    value={requiresIdentityValidation}
                    onValueChange={setRequiresIdentityValidation}
                    trackColor={{ false: '#d1d5db', true: colors.text }}
                    thumbColor={colors.background}
                />
            </View>
            {requiresIdentityValidation && (
                <Text style={styles.helperText}>Se solicitará DNI + foto de la persona</Text>
            )}

            <SectionTitle text="Evidencia adicional" />
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Requerir evidencia adicional de propiedad</Text>
                <Switch
                    value={requiresAdditionalEvidence}
                    onValueChange={setRequiresAdditionalEvidence}
                    trackColor={{ false: '#d1d5db', true: colors.text }}
                    thumbColor={colors.background}
                />
            </View>
            {requiresAdditionalEvidence && (
                <>
                    <FieldLabel text="Detalle de evidencia adicional" />
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        placeholder="Ej: foto del objeto con el dueño"
                        placeholderTextColor={colors.textMuted}
                        multiline
                        value={additionalEvidenceDetails}
                        onChangeText={setAdditionalEvidenceDetails}
                    />
                </>
            )}

            {history.length > 0 && (
                <View style={styles.historySection}>
                    <TouchableOpacity
                        style={styles.historyHeader}
                        onPress={() => setHistoryExpanded(prev => !prev)}>
                        <Text style={styles.sectionTitle}>
                            Historial de cambios ({history.length})
                        </Text>
                        <Text style={styles.historyToggle}>{historyExpanded ? '▲' : '▼'}</Text>
                    </TouchableOpacity>
                    {historyExpanded && history.map(h => (
                        <View key={h.id} style={styles.historyItem}>
                            <Text style={styles.historyDate}>
                                {h.changedAt ? new Date(h.changedAt).toLocaleString('es-AR') : '-'}
                            </Text>
                            <Text style={styles.historyUser}>Por: {h.changedByEmail || '-'}</Text>
                        </View>
                    ))}
                </View>
            )}
            </ScrollView>
            <View style={styles.footer}>
                {saveOk === true && (
                    <Text style={styles.successMsg}>Políticas guardadas correctamente.</Text>
                )}
                {saveOk === false && (
                    <Text style={styles.errorMsg}>Error al guardar. Intenta de nuevo.</Text>
                )}
                <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
                    {saving
                        ? <ActivityIndicator color="#fff" />
                        : <Text style={styles.saveBtnText}>Guardar políticas</Text>}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: colors.background,
    },
    container: {
        padding: 16,
        backgroundColor: colors.background,
        paddingBottom: 24,
    },
    footer: {
        padding: 16,
        backgroundColor: colors.background,
        borderTopWidth: 1,
        borderTopColor: colors.surface,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: colors.background,
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: colors.text,
        marginTop: 20,
        marginBottom: 8,
    },
    fieldLabel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: 4,
    },
    helperText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.textMuted,
        marginBottom: 4,
    },
    input: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: colors.text,
        marginBottom: 4,
    },
    inputMultiline: {
        minHeight: 70,
        textAlignVertical: 'top',
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 8,
    },
    switchLabel: {
        flex: 1,
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: colors.text,
        marginRight: 12,
    },
    dropdown: {
        backgroundColor: colors.surface,
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    dropdownText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: colors.text,
    },
    dropdownChevron: {
        fontSize: 14,
        color: colors.textMuted,
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        backgroundColor: colors.background,
        borderRadius: 16,
        padding: 16,
        width: '100%',
        maxWidth: 480,
        maxHeight: '80%',
    },
    modalTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 16,
        color: colors.text,
        marginBottom: 12,
    },
    modalList: {
        flexGrow: 0,
    },
    modalOption: {
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 10,
    },
    modalOptionActive: {
        backgroundColor: colors.text,
    },
    modalOptionText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: colors.text,
    },
    modalOptionTextActive: {
        color: colors.background,
        fontFamily: 'PlusJakartaSans-Bold',
    },
    saveBtn: {
        backgroundColor: colors.text,
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnText: {
        color: colors.background,
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 14,
    },
    successMsg: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#008000',
        textAlign: 'center',
        marginBottom: 8,
    },
    errorMsg: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#ED4337',
        textAlign: 'center',
        marginBottom: 8,
    },
    historySection: {
        marginTop: 24,
        borderTopWidth: 1,
        borderTopColor: '#d1d5db',
        paddingTop: 12,
    },
    historyHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    historyToggle: {
        fontSize: 14,
        color: colors.textMuted,
    },
    historyItem: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: colors.surface,
    },
    historyDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: colors.text,
    },
    historyUser: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: colors.textMuted,
    },
});

export default OrganizationPolicy;
