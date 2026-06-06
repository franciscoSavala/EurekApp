import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";
import Toast from "react-native-toast-message";
import DonutChart from "../components/DonutChart";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ROLE_ROWS = [
    { key: "userUsers",         label: "Usuarios",      color: "#4A9999" },
    { key: "orgOwnerUsers",     label: "Responsables",  color: "#7B5EA7" },
    { key: "orgEmployeeUsers",  label: "Empleados",     color: "#2E86AB" },
    { key: "encargadoUsers",    label: "Encargados",    color: "#F0A500" },
    { key: "adminUsers",        label: "Admins",        color: "#CC4444" },
];

const StatCard = ({ value, label, accent }) => (
    <View style={[styles.statCard, accent && { borderLeftColor: accent, borderLeftWidth: 4 }]}>
        <Text style={styles.statValue}>{value ?? "—"}</Text>
        <Text style={styles.statLabel}>{label}</Text>
    </View>
);

const SectionTitle = ({ title }) => (
    <Text style={styles.sectionTitle}>{title}</Text>
);

const GlobalStatisticsDashboard = () => {
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + "/admin/stats", {
                headers: { Authorization: "Bearer " + jwt },
            });
            setStats(res.data);
        } catch (e) {
            Toast.show({ type: "error", text1: "No se pudo cargar el dashboard." });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => { fetchStats(); }, []));

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4A9999" />
            </View>
        );
    }

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.content}
            refreshControl={
                <RefreshControl refreshing={loading} onRefresh={fetchStats} colors={["#4A9999"]} />
            }
        >
            {/* ── Plataforma ── */}
            <SectionTitle title="Plataforma" />
            <View style={styles.grid2}>
                <StatCard value={stats?.totalUsers} label="Usuarios totales" accent="#4A9999" />
                <StatCard value={stats?.activeUsers} label="Usuarios activos" accent="#4caf50" />
            </View>
            <View style={styles.grid2}>
                <StatCard value={stats?.totalOrgs} label="Organizaciones" accent="#7B5EA7" />
                <StatCard value={stats?.activeOrgs} label="Orgs activas" accent="#4caf50" />
            </View>

            {/* ── Objetos encontrados ── */}
            <SectionTitle title="Objetos encontrados" />
            <View style={styles.card}>
                {stats?.totalFoundObjects > 0 ? (
                    <DonutChart
                        recovered={stats.returnedFoundObjects}
                        total={stats.totalFoundObjects}
                        size={160}
                    />
                ) : (
                    <View style={styles.noDataRow}>
                        <Icon name="box-open" size={20} color="#bdc1c1" />
                        <Text style={styles.noDataText}>Sin objetos registrados aún</Text>
                    </View>
                )}
                <Text style={styles.objectTotal}>
                    {stats?.totalFoundObjects ?? 0} objetos encontrados en total
                </Text>
            </View>

            {/* ── Usuarios por rol ── */}
            <SectionTitle title="Usuarios por rol" />
            <View style={styles.card}>
                {ROLE_ROWS.map((row) => (
                    <View key={row.key} style={styles.roleRow}>
                        <View style={styles.roleLabelRow}>
                            <View style={[styles.roleDot, { backgroundColor: row.color }]} />
                            <Text style={styles.roleLabel}>{row.label}</Text>
                        </View>
                        <Text style={[styles.roleCount, { color: row.color }]}>
                            {stats?.[row.key] ?? 0}
                        </Text>
                    </View>
                ))}
            </View>

            {/* ── Solicitudes de alta ── */}
            <SectionTitle title="Solicitudes de alta de org." />
            <View style={styles.grid3}>
                <View style={[styles.requestCard, { borderTopColor: "#b45309" }]}>
                    <Text style={[styles.requestValue, { color: "#b45309" }]}>
                        {stats?.orgRequestsPending ?? 0}
                    </Text>
                    <Text style={styles.requestLabel}>Pendientes</Text>
                </View>
                <View style={[styles.requestCard, { borderTopColor: "#065f46" }]}>
                    <Text style={[styles.requestValue, { color: "#065f46" }]}>
                        {stats?.orgRequestsApproved ?? 0}
                    </Text>
                    <Text style={styles.requestLabel}>Aprobadas</Text>
                </View>
                <View style={[styles.requestCard, { borderTopColor: "#991b1b" }]}>
                    <Text style={[styles.requestValue, { color: "#991b1b" }]}>
                        {stats?.orgRequestsRejected ?? 0}
                    </Text>
                    <Text style={styles.requestLabel}>Rechazadas</Text>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f4f7f7" },
    content: { padding: 16, paddingBottom: 48 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },

    sectionTitle: {
        fontSize: 13,
        fontFamily: "PlusJakartaSans-Bold",
        color: "#638888",
        textTransform: "uppercase",
        letterSpacing: 0.8,
        marginTop: 20,
        marginBottom: 10,
    },

    grid2: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 10,
    },
    statCard: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    statValue: {
        fontSize: 28,
        fontFamily: "PlusJakartaSans-Bold",
        color: "#1A3434",
    },
    statLabel: {
        fontSize: 12,
        fontFamily: "PlusJakartaSans-Regular",
        color: "#638888",
        marginTop: 2,
    },

    card: {
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 16,
        marginBottom: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    noDataRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 8,
    },
    noDataText: {
        fontSize: 14,
        fontFamily: "PlusJakartaSans-Regular",
        color: "#bdc1c1",
    },
    objectTotal: {
        fontSize: 12,
        fontFamily: "PlusJakartaSans-Regular",
        color: "#638888",
        textAlign: "center",
        marginTop: 8,
    },

    roleRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#f0f4f4",
    },
    roleLabelRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
    },
    roleDot: {
        width: 12,
        height: 12,
        borderRadius: 6,
    },
    roleLabel: {
        fontSize: 14,
        fontFamily: "PlusJakartaSans-Regular",
        color: "#1A3434",
    },
    roleCount: {
        fontSize: 16,
        fontFamily: "PlusJakartaSans-Bold",
    },

    grid3: {
        flexDirection: "row",
        gap: 8,
    },
    requestCard: {
        flex: 1,
        backgroundColor: "#fff",
        borderRadius: 14,
        padding: 14,
        borderTopWidth: 4,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
        alignItems: "center",
    },
    requestValue: {
        fontSize: 24,
        fontFamily: "PlusJakartaSans-Bold",
    },
    requestLabel: {
        fontSize: 11,
        fontFamily: "PlusJakartaSans-Regular",
        color: "#638888",
        marginTop: 2,
        textAlign: "center",
    },
});

export default GlobalStatisticsDashboard;
