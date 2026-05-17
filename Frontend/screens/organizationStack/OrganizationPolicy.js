import React, { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axiosInstance from "../../utils/axiosInstance";
import Constants from 'expo-constants';
import { useFocusEffect } from '@react-navigation/native';

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ORG_TYPE_OPTIONS = [
    { label: 'Club', value: 'CLUB' },
    { label: 'Aeropuerto', value: 'AIRPORT' },
    { label: 'Shopping', value: 'SHOPPING' },
    { label: 'Otro', value: 'OTHER' },
];

const OrganizationPolicy = () => {
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

    const fetchPolicy = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem('jwt');
            const res = await axiosInstance.get(`${BACK_URL}/organizations/policy`, {
                headers: { Authorization: `Bearer ${jwt}` },
            });
            const p = res.data;
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
            const jwt = await AsyncStorage.getItem('jwt');
            await axiosInstance.put(
                `${BACK_URL}/organizations/policy`,
                {
                    maxStorageDays: maxStorageDays ? parseInt(maxStorageDays, 10) : null,
                    requiresIdentityValidation,
                    requiresAdditionalEvidence,
                    additionalEvidenceDetails: additionalEvidenceDetails || null,
                    organizationType: organizationType || null,
                },
                { headers: { Authorization: `Bearer ${jwt}` } }
            );
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

    const SelectorRow = ({ options, value, onChange }) => (
        <View style={styles.selectorRow}>
            {options.map(opt => (
                <TouchableOpacity
                    key={opt.value}
                    style={[styles.selectorBtn, value === opt.value && styles.selectorBtnActive]}
                    onPress={() => onChange(opt.value)}>
                    <Text style={[styles.selectorBtnText, value === opt.value && styles.selectorBtnTextActive]}>
                        {opt.label}
                    </Text>
                </TouchableOpacity>
            ))}
        </View>
    );

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#111818" />
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
                placeholderTextColor="#638888"
                keyboardType="numeric"
                value={maxStorageDays}
                onChangeText={v => setMaxStorageDays(v.replace(/[^0-9]/g, ''))}
            />

            <SectionTitle text="Tipo de organización" />
            <SelectorRow options={ORG_TYPE_OPTIONS} value={organizationType} onChange={setOrganizationType} />

            <SectionTitle text="Validación de identidad" />
            <View style={styles.switchRow}>
                <Text style={styles.switchLabel}>Requerir validación de identidad</Text>
                <Switch
                    value={requiresIdentityValidation}
                    onValueChange={setRequiresIdentityValidation}
                    trackColor={{ false: '#d1d5db', true: '#111818' }}
                    thumbColor="#fff"
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
                    trackColor={{ false: '#d1d5db', true: '#111818' }}
                    thumbColor="#fff"
                />
            </View>
            {requiresAdditionalEvidence && (
                <>
                    <FieldLabel text="Detalle de evidencia adicional" />
                    <TextInput
                        style={[styles.input, styles.inputMultiline]}
                        placeholder="Ej: foto del objeto con el dueño"
                        placeholderTextColor="#638888"
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
        backgroundColor: '#fff',
    },
    container: {
        padding: 16,
        backgroundColor: '#fff',
        paddingBottom: 24,
    },
    footer: {
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#f0f4f4',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#fff',
    },
    sectionTitle: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 15,
        color: '#111818',
        marginTop: 20,
        marginBottom: 8,
    },
    fieldLabel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
        marginBottom: 4,
    },
    helperText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
        marginBottom: 4,
    },
    input: {
        backgroundColor: '#f0f4f4',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#111818',
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
        color: '#111818',
        marginRight: 12,
    },
    selectorRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    selectorBtn: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 20,
        paddingVertical: 5,
        paddingHorizontal: 12,
    },
    selectorBtnActive: {
        backgroundColor: '#111818',
        borderColor: '#111818',
    },
    selectorBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#111818',
    },
    selectorBtnTextActive: {
        color: '#fff',
    },
    saveBtn: {
        backgroundColor: '#111818',
        borderRadius: 24,
        paddingVertical: 14,
        alignItems: 'center',
    },
    saveBtnText: {
        color: '#fff',
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
        color: '#638888',
    },
    historyItem: {
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    historyDate: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#111818',
    },
    historyUser: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
});

export default OrganizationPolicy;
