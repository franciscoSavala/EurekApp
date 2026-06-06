import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";
import Toast from "react-native-toast-message";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_CONFIG = {
    PENDING_APPROVAL: { label: "Pendiente de aprobación", color: "#b45309", icon: "clock" },
    APPROVED: { label: "Aprobada", color: "#065f46", icon: "circle-check" },
    REJECTED: { label: "Rechazada", color: "#991b1b", icon: "circle-xmark" },
    CANCELLED: { label: "Cancelada", color: "#6b7280", icon: "ban" },
};

const ORG_TYPE_LABELS = {
    UNIVERSITY: "Universidad", SCHOOL: "Colegio", HOSPITAL: "Hospital",
    CORPORATE_OFFICE: "Empresa", CITY_HALL: "Municipalidad", CLUB: "Club",
    GYM: "Gimnasio", STADIUM: "Estadio", AIRPORT: "Aeropuerto",
    BUS_TERMINAL: "Terminal de ómnibus", HOTEL: "Hotel", SHOPPING: "Shopping",
    RESTAURANT: "Restaurante", EVENT: "Evento/Festival", OTHER: "Otro",
};

const Field = ({ label, value }) => (
    value ? (
        <View style={styles.field}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <Text style={styles.fieldValue}>{value}</Text>
        </View>
    ) : null
);

const OrganizationRequestDetail = ({ route, navigation }) => {
    const { requestId } = route.params;
    const [request, setRequest] = useState(null);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState(false);
    const [adminNote, setAdminNote] = useState("");

    const fetchDetail = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + `/organizations/requests/${requestId}`, {
                headers: { Authorization: "Bearer " + jwt },
            });
            setRequest(res.data);
        } catch (e) {
            Toast.show({ type: "error", text1: "No se pudo cargar la solicitud." });
            navigation.goBack();
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchDetail(); }, []));

    const resolve = async (resolution) => {
        setResolving(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.put(
                BACK_URL + `/organizations/requests/${requestId}/resolve`,
                { resolution, adminNote: adminNote.trim() || null },
                { headers: { Authorization: "Bearer " + jwt } }
            );
            const msg = resolution === "APPROVED" ? "Solicitud aprobada correctamente." : "Solicitud rechazada.";
            Toast.show({ type: "success", text1: msg });
            navigation.goBack();
        } catch (e) {
            const errMsg = e?.response?.data?.message || "No se pudo procesar la solicitud.";
            Toast.show({ type: "error", text1: errMsg });
        } finally {
            setResolving(false);
        }
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#4A9999" /></View>;
    }

    const statusCfg = STATUS_CONFIG[request?.status] || STATUS_CONFIG.PENDING_APPROVAL;
    const orgTypeLabel = ORG_TYPE_LABELS[request?.organizationType] || request?.organizationType;
    const displayType = request?.organizationType === "OTHER" && request?.customOrganizationType
        ? `Otro (${request.customOrganizationType})`
        : orgTypeLabel;
    const isPending = request?.status === "PENDING_APPROVAL";

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + "22", borderColor: statusCfg.color }]}>
                <Icon name={statusCfg.icon} size={16} color={statusCfg.color} />
                <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>

            <Text style={styles.sectionTitle}>Solicitante</Text>
            <Field label="Nombre" value={`${request?.requestingUserFirstName} ${request?.requestingUserLastName}`} />
            <Field label="Email" value={request?.requestingUserEmail} />
            <Field label="Fecha de solicitud" value={request?.createdAt && new Date(request.createdAt).toLocaleString("es-AR")} />

            <Text style={styles.sectionTitle}>Organización</Text>
            <Field label="Nombre" value={request?.organizationName} />
            <Field label="Tipo" value={displayType} />

            <Text style={styles.sectionTitle}>Dirección</Text>
            <Field label="Calle" value={`${request?.street} ${request?.streetNumber}`} />
            <Field label="Ciudad" value={request?.city} />
            <Field label="Provincia" value={request?.province} />
            <Field label="País" value={request?.country} />
            {request?.latitude && (
                <Field label="Coordenadas" value={`${request.latitude.toFixed(5)}, ${request.longitude.toFixed(5)}`} />
            )}

            <Text style={styles.sectionTitle}>Responsable propuesto</Text>
            <Field label="Nombre" value={`${request?.ownerFirstName} ${request?.ownerLastName}`} />
            <Field label="Email" value={request?.ownerEmail} />
            <Field label="Teléfono" value={request?.ownerPhone} />

            <Text style={styles.sectionTitle}>Motivo</Text>
            <Text style={styles.reasonText}>{request?.reason}</Text>

            {isPending && (
                <>
                    <Text style={styles.sectionTitle}>Nota del administrador (opcional)</Text>
                    <TextInput
                        style={styles.noteInput}
                        placeholder="Escribe una nota para el solicitante..."
                        placeholderTextColor="#638888"
                        value={adminNote}
                        onChangeText={setAdminNote}
                        multiline
                        numberOfLines={3}
                        textAlignVertical="top"
                    />

                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.rejectButton]}
                            onPress={() => resolve("REJECTED")}
                            disabled={resolving}
                        >
                            {resolving
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.actionButtonText}>Rechazar</Text>
                            }
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.actionButton, styles.approveButton]}
                            onPress={() => resolve("APPROVED")}
                            disabled={resolving}
                        >
                            {resolving
                                ? <ActivityIndicator color="#fff" />
                                : <Text style={styles.actionButtonText}>Aprobar</Text>
                            }
                        </TouchableOpacity>
                    </View>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { padding: 20, paddingBottom: 48 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    statusBadge: {
        flexDirection: "row", alignItems: "center", gap: 8,
        borderWidth: 1, borderRadius: 12, paddingVertical: 8,
        paddingHorizontal: 14, alignSelf: "flex-start", marginBottom: 20,
    },
    statusText: { fontSize: 13, fontFamily: "PlusJakartaSans-Bold" },
    sectionTitle: {
        fontSize: 15, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434",
        marginTop: 20, marginBottom: 8,
        borderBottomWidth: 1, borderBottomColor: "#E0E0E0", paddingBottom: 4,
    },
    field: { marginBottom: 10 },
    fieldLabel: { fontSize: 11, fontFamily: "PlusJakartaSans-Regular", color: "#638888" },
    fieldValue: { fontSize: 14, fontFamily: "PlusJakartaSans-Regular", color: "#111818" },
    reasonText: { fontSize: 14, fontFamily: "PlusJakartaSans-Regular", color: "#111818", lineHeight: 22 },
    noteInput: {
        borderRadius: 12, backgroundColor: "#f0f4f4",
        paddingHorizontal: 14, paddingVertical: 10,
        fontSize: 14, fontFamily: "PlusJakartaSans-Regular",
        color: "#111818", height: 90,
    },
    actionRow: { flexDirection: "row", gap: 12, marginTop: 24 },
    actionButton: {
        flex: 1, borderRadius: 12, paddingVertical: 14, alignItems: "center",
    },
    approveButton: { backgroundColor: "#4A9999" },
    rejectButton: { backgroundColor: "#CC4444" },
    actionButtonText: { color: "#fff", fontSize: 15, fontFamily: "PlusJakartaSans-Bold" },
});

export default OrganizationRequestDetail;
