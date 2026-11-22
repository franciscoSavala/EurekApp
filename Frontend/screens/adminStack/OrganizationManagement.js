import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";
import Toast from "react-native-toast-message";
import InfoModal from "../components/InfoModal";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ORG_TYPE_LABELS = {
    UNIVERSITY:        "Universidad",
    SCHOOL:            "Colegio",
    HOSPITAL:          "Hospital",
    CORPORATE_OFFICE:  "Empresa",
    CITY_HALL:         "Municipalidad",
    CLUB:              "Club",
    GYM:               "Gimnasio",
    STADIUM:           "Estadio",
    AIRPORT:           "Aeropuerto",
    BUS_TERMINAL:      "Terminal de ómnibus",
    HOTEL:             "Hotel",
    SHOPPING:          "Shopping",
    SHOPPING_MALL:     "Shopping mall",
    RESTAURANT:        "Restaurante",
    EVENT:             "Evento/Festival",
    OTHER:             "Otro",
};

const OrganizationManagement = () => {
    const [orgs, setOrgs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [toggling, setToggling] = useState(null);
    const [selectedOrg, setSelectedOrg] = useState(null);
    const [orgConfirmVisible, setOrgConfirmVisible] = useState(false);
    const [detailOrg, setDetailOrg] = useState(null);
    const [members, setMembers] = useState(null);

    const openDetail = async (org) => {
        setDetailOrg(org);
        setMembers(null);
        try {
            const res = await axiosInstance.get(BACK_URL + `/admin/organizations/${org.id}/members`);
            setMembers(res.data);
        } catch (e) {
            setMembers([]);
            Toast.show({ type: "error", text1: "No se pudieron cargar los miembros de la organización." });
        }
    };

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const res = await axiosInstance.get(BACK_URL + `/admin/organizations`);
            setOrgs(res.data);
        } catch (e) {
            Toast.show({ type: "error", text1: "No se pudo cargar la lista de organizaciones." });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchOrgs(); }, []));

    const handleConfirm = async (org) => {
        setOrgConfirmVisible(false);
        setToggling(org.id);
        try {
            await axiosInstance.put(
                BACK_URL + `/admin/organizations/${org.id}/active`,
                { active: !org.active });
            const msg = org.active ? "Organización desactivada correctamente." : "Organización activada correctamente.";
            Toast.show({ type: "success", text1: msg });
            fetchOrgs();
        } catch (e) {
            const errMsg = e?.response?.data?.message || "No se pudo cambiar el estado de la organización.";
            Toast.show({ type: "error", text1: errMsg });
        } finally {
            setToggling(null);
        }
    };

    const renderOrg = ({ item }) => {
        const isToggling = toggling === item.id;
        const typeLabel  = ORG_TYPE_LABELS[item.organizationType] || item.organizationType;

        return (
            <View style={styles.card}>
                <TouchableOpacity style={styles.cardHeader} activeOpacity={0.7} onPress={() => openDetail(item)}>
                    <View style={styles.titleRow}>
                        <Text style={styles.orgName} numberOfLines={1}>{item.name}</Text>
                        <View style={[
                            styles.statusBadge,
                            item.active ? styles.statusActive : styles.statusInactive,
                        ]}>
                            <Text style={[
                                styles.statusText,
                                { color: item.active ? "#065f46" : "#991b1b" },
                            ]}>
                                {item.active ? "Activa" : "Inactiva"}
                            </Text>
                        </View>
                    </View>

                    {item.organizationType ? (
                        <View style={styles.infoRow}>
                            <Icon name="tag" size={11} color="#638888" />
                            <Text style={styles.subText}>{typeLabel}</Text>
                        </View>
                    ) : null}

                    <View style={styles.infoRow}>
                        <Icon name="location-dot" size={11} color="#638888" />
                        <Text style={styles.subText}>
                            {item.city}{item.province ? `, ${item.province}` : ""}
                        </Text>
                    </View>

                    <View style={styles.infoRow}>
                        <Icon name="envelope" size={11} color="#638888" />
                        <Text style={styles.subText}>{item.contactData}</Text>
                    </View>
                </TouchableOpacity>

                <View style={styles.cardFooter}>
                    <View style={styles.statItem}>
                        <Icon name="users" size={12} color="#4A9999" />
                        <Text style={styles.stat}>
                            {item.employeeCount} miembro{item.employeeCount !== 1 ? "s" : ""}
                        </Text>
                    </View>

                    {isToggling ? (
                        <ActivityIndicator size="small" color="#CC4444" />
                    ) : (
                        <TouchableOpacity
                            style={[styles.toggleBtn, item.active ? styles.toggleBtnRed : styles.toggleBtnTeal]}
                            onPress={() => { setSelectedOrg(item); setOrgConfirmVisible(true); }}
                        >
                            <Text style={styles.toggleBtnText}>{item.active ? "Desactivar" : "Activar"}</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        );
    };

    const ROLE_LABELS = {
        ORGANIZATION_OWNER: "Responsable",
        ORGANIZATION_EMPLOYEE: "Empleado",
        ENCARGADO: "Encargado",
    };

    return (
        <View style={styles.container}>
            <Modal visible={!!detailOrg} transparent animationType="fade" onRequestClose={() => setDetailOrg(null)}>
                <View style={styles.detailOverlay}>
                    <View style={styles.detailBox}>
                        <Text style={styles.detailTitle}>Detalle de la organización</Text>
                        {detailOrg ? (
                            <ScrollView>
                                {[
                                    ["Nombre", detailOrg.name],
                                    ["Tipo", ORG_TYPE_LABELS[detailOrg.organizationType] || detailOrg.organizationType || "—"],
                                    ["Ciudad", detailOrg.city || "—"],
                                    ["Provincia", detailOrg.province || "—"],
                                    ["Contacto", detailOrg.contactData || "—"],
                                    ["Estado", detailOrg.active ? "Activa" : "Inactiva"],
                                ].map(([label, value]) => (
                                    <View key={label} style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{label}</Text>
                                        <Text style={styles.detailValue}>{value}</Text>
                                    </View>
                                ))}
                                <Text style={styles.detailSub}>Miembros</Text>
                                {members === null ? (
                                    <ActivityIndicator size="small" color="#4A9999" />
                                ) : members.length === 0 ? (
                                    <Text style={styles.detailLabel}>Sin miembros.</Text>
                                ) : members.map((m) => (
                                    <View key={m.id} style={styles.detailRow}>
                                        <Text style={styles.detailLabel}>{m.firstName} {m.lastName} ({m.username})</Text>
                                        <Text style={styles.detailValue}>{ROLE_LABELS[m.role] || m.role}</Text>
                                    </View>
                                ))}
                            </ScrollView>
                        ) : null}
                        <TouchableOpacity style={styles.detailClose} onPress={() => setDetailOrg(null)}>
                            <Text style={styles.detailCloseText}>Cerrar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
            {loading && orgs.length === 0 ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#4A9999" />
                </View>
            ) : (
                <FlatList
                    data={orgs}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderOrg}
                    extraData={toggling}
                    contentContainerStyle={styles.list}
                    onRefresh={fetchOrgs}
                    refreshing={loading}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No hay organizaciones registradas.</Text>
                        </View>
                    }
                />
            )}

            <InfoModal
                visible={orgConfirmVisible}
                onClose={() => setOrgConfirmVisible(false)}
                type={selectedOrg?.active ? "warning" : "info"}
                title={selectedOrg?.active ? "¿Desactivar organización?" : "¿Activar organización?"}
                message={
                    selectedOrg?.active
                        ? `Al desactivar "${selectedOrg?.name}", dejará de aparecer en la plataforma y sus empleados serán deslogueados.`
                        : `Al activar "${selectedOrg?.name}", volverá a operar en la plataforma.`
                }
                cancelLabel="Cancelar"
                confirmLabel={selectedOrg?.active ? "Desactivar" : "Activar"}
                onConfirm={() => selectedOrg && handleConfirm(selectedOrg)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f4f7f7" },
    list: { padding: 16, paddingBottom: 48, flexGrow: 1 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center", paddingTop: 60 },
    emptyText: { color: "#638888", fontFamily: "PlusJakartaSans-Regular", fontSize: 14 },
    card: {
        backgroundColor: "#fff", borderRadius: 14,
        padding: 16, marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 4, elevation: 2,
    },
    cardHeader: { marginBottom: 12 },
    detailOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 20 },
    detailBox: { backgroundColor: "#fff", borderRadius: 16, padding: 20, maxHeight: "85%" },
    detailTitle: { fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434", marginBottom: 12 },
    detailRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f0f4f4" },
    detailLabel: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#638888", marginRight: 12 },
    detailValue: { fontSize: 13, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434", flexShrink: 1, textAlign: "right" },
    detailSub: { fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434", marginTop: 14, marginBottom: 6 },
    detailClose: { marginTop: 16, alignSelf: "center", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 10, backgroundColor: "#4A9999" },
    detailCloseText: { color: "#fff", fontSize: 13, fontFamily: "PlusJakartaSans-Bold" },
    titleRow: {
        flexDirection: "row", alignItems: "center",
        justifyContent: "space-between", marginBottom: 8,
    },
    orgName: {
        fontSize: 15, fontFamily: "PlusJakartaSans-Bold",
        color: "#1A3434", flex: 1, marginRight: 8,
    },
    statusBadge: {
        paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 10, borderWidth: 1,
    },
    statusActive:   { backgroundColor: "#d1fae5", borderColor: "#065f46" },
    statusInactive: { backgroundColor: "#fee2e2", borderColor: "#991b1b" },
    statusText: { fontSize: 11, fontFamily: "PlusJakartaSans-Bold" },
    infoRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
    subText: { fontSize: 12, fontFamily: "PlusJakartaSans-Regular", color: "#638888", marginLeft: 6 },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statItem: { flexDirection: "row", alignItems: "center" },
    stat: { fontSize: 12, fontFamily: "PlusJakartaSans-Regular", color: "#555", marginLeft: 6 },
    toggleBtn: {
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 10, minWidth: 90, alignItems: "center",
    },
    toggleBtnRed:  { backgroundColor: "#CC4444" },
    toggleBtnTeal: { backgroundColor: "#4A9999" },
    toggleBtnText: { color: "#fff", fontSize: 13, fontFamily: "PlusJakartaSans-Bold" },
});

export default OrganizationManagement;
