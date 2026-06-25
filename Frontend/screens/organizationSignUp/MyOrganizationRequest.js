import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";
import Toast from "react-native-toast-message";
import InfoModal from "../components/InfoModal";

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

const RequestCard = ({ request, onCancel }) => {
    const statusCfg = STATUS_CONFIG[request.status] || STATUS_CONFIG.PENDING_APPROVAL;
    const orgTypeLabel = ORG_TYPE_LABELS[request.organizationType] || request.organizationType;
    const displayType = request.organizationType === "OTHER" && request.customOrganizationType
        ? `Otro (${request.customOrganizationType})`
        : orgTypeLabel;

    return (
        <View style={styles.card}>
            <View style={[styles.statusBadge, { backgroundColor: statusCfg.color + "22", borderColor: statusCfg.color }]}>
                <Icon name={statusCfg.icon} size={16} color={statusCfg.color} />
                <Text style={[styles.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
            </View>

            <Text style={styles.sectionTitle}>Organización</Text>
            <Field label="Nombre" value={request.organizationName} />
            <Field label="Tipo" value={displayType} />

            <Text style={styles.sectionTitle}>Dirección</Text>
            <Field label="Calle" value={request.street && `${request.street} ${request.streetNumber}`} />
            <Field label="Ciudad" value={request.city} />
            <Field label="Provincia" value={request.province} />

            <Text style={styles.sectionTitle}>Responsable propuesto</Text>
            <Field label="Nombre" value={request.ownerFirstName && `${request.ownerFirstName} ${request.ownerLastName}`} />
            <Field label="Email" value={request.ownerEmail} />

            {request.reason ? (
                <>
                    <Text style={styles.sectionTitle}>Motivo</Text>
                    <Text style={styles.reasonText}>{request.reason}</Text>
                </>
            ) : null}

            {request.createdAt && (
                <Text style={styles.dateText}>
                    Enviada el {new Date(request.createdAt).toLocaleDateString("es-AR")}
                </Text>
            )}

            {request.status === "PENDING_APPROVAL" && (
                <TouchableOpacity style={styles.cancelButton} onPress={() => onCancel(request.id)}>
                    <Text style={styles.cancelButtonText}>Cancelar solicitud</Text>
                </TouchableOpacity>
            )}
        </View>
    );
};

const MyOrganizationRequest = () => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [cancelling, setCancelling] = useState(false);
    const [cancelTargetId, setCancelTargetId] = useState(null);

    const fetchRequests = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + "/organizations/requests/my", {
                headers: { Authorization: "Bearer " + jwt },
            });
            setRequests(res.data);
        } catch {
            setRequests([]);
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchRequests(); }, []));

    const confirmCancel = async () => {
        setCancelling(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.delete(BACK_URL + `/organizations/requests/${cancelTargetId}`, {
                headers: { Authorization: "Bearer " + jwt },
            });
            Toast.show({ type: "success", text1: "Solicitud cancelada." });
            fetchRequests();
        } catch {
            Toast.show({ type: "error", text1: "No se pudo cancelar la solicitud." });
        } finally {
            setCancelling(false);
            setCancelTargetId(null);
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4A9999" />
            </View>
        );
    }

    if (requests.length === 0) {
        return (
            <View style={styles.centered}>
                <Icon name="file-circle-question" size={50} color="#bdc1c1" />
                <Text style={styles.emptyTitle}>Sin solicitudes</Text>
                <Text style={styles.emptyText}>
                    Todavía no enviaste ninguna solicitud de alta de organización.
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            {requests.map((req) => (
                <RequestCard key={req.id} request={req} onCancel={(id) => setCancelTargetId(id)} />
            ))}
            <InfoModal
                visible={cancelTargetId !== null && !cancelling}
                onClose={() => setCancelTargetId(null)}
                type="warning"
                title="¿Cancelar solicitud?"
                message="Si cancelás la solicitud, deberás volver a iniciarla desde cero."
                cancelLabel="No, mantener"
                confirmLabel="Sí, cancelar"
                onConfirm={confirmCancel}
            />
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { padding: 20, paddingBottom: 40 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", padding: 32 },
    emptyTitle: { fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434", marginTop: 16 },
    emptyText: { fontSize: 14, fontFamily: "PlusJakartaSans-Regular", color: "#638888", textAlign: "center", marginTop: 8 },
    card: {
        backgroundColor: "#f9fafb", borderRadius: 12, padding: 16,
        marginBottom: 20, borderWidth: 1, borderColor: "#E0E0E0",
    },
    statusBadge: {
        flexDirection: "row", alignItems: "center", gap: 8,
        borderWidth: 1, borderRadius: 12, paddingVertical: 6,
        paddingHorizontal: 12, alignSelf: "flex-start", marginBottom: 16,
    },
    statusText: { fontSize: 13, fontFamily: "PlusJakartaSans-Bold" },
    sectionTitle: {
        fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434",
        marginTop: 16, marginBottom: 6,
        borderBottomWidth: 1, borderBottomColor: "#E0E0E0", paddingBottom: 3,
    },
    field: { marginBottom: 8 },
    fieldLabel: { fontSize: 11, fontFamily: "PlusJakartaSans-Regular", color: "#638888" },
    fieldValue: { fontSize: 14, fontFamily: "PlusJakartaSans-Regular", color: "#111818" },
    reasonText: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#111818", lineHeight: 20 },
    dateText: { fontSize: 11, color: "#999", fontFamily: "PlusJakartaSans-Regular", marginTop: 12 },
    cancelButton: {
        backgroundColor: "#CC4444", borderRadius: 10, paddingVertical: 12,
        alignItems: "center", marginTop: 16,
    },
    cancelButtonText: { color: "#fff", fontSize: 14, fontFamily: "PlusJakartaSans-Bold" },
});

export default MyOrganizationRequest;
