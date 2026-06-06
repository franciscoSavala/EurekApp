import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
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

    const fetchOrgs = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + `/admin/organizations`, {
                headers: { Authorization: "Bearer " + jwt },
            });
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
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.put(
                BACK_URL + `/admin/organizations/${org.id}/active`,
                { active: !org.active },
                { headers: { Authorization: "Bearer " + jwt } }
            );
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
                <View style={styles.cardHeader}>
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
                </View>

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

    return (
        <View style={styles.container}>
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
