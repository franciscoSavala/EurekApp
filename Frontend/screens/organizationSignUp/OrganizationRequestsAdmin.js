import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
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
import EmptyState from "../components/EmptyState";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const STATUS_CONFIG = {
    PENDING_APPROVAL: { label: "Pendiente", color: "#b45309", bg: "#fef3c7" },
    APPROVED: { label: "Aprobada", color: "#065f46", bg: "#d1fae5" },
    REJECTED: { label: "Rechazada", color: "#991b1b", bg: "#fee2e2" },
    CANCELLED: { label: "Cancelada", color: "#6b7280", bg: "#f3f4f6" },
};

const ORG_TYPE_LABELS = {
    UNIVERSITY: "Universidad", SCHOOL: "Colegio", HOSPITAL: "Hospital",
    CORPORATE_OFFICE: "Empresa", CITY_HALL: "Municipalidad", CLUB: "Club",
    GYM: "Gimnasio", STADIUM: "Estadio", AIRPORT: "Aeropuerto",
    BUS_TERMINAL: "Terminal de ómnibus", HOTEL: "Hotel", SHOPPING: "Shopping",
    RESTAURANT: "Restaurante", EVENT: "Evento/Festival", OTHER: "Otro",
};

const FILTERS = ["TODAS", "PENDING_APPROVAL", "APPROVED", "REJECTED", "CANCELLED"];
const FILTER_LABELS = {
    TODAS: "Todas", PENDING_APPROVAL: "Pendientes", APPROVED: "Aprobadas",
    REJECTED: "Rechazadas", CANCELLED: "Canceladas",
};

const OrganizationRequestsAdmin = ({ navigation }) => {
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeFilter, setActiveFilter] = useState("PENDING_APPROVAL");

    const fetchRequests = async () => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + "/organizations/requests", {
                headers: { Authorization: "Bearer " + jwt },
            });
            setRequests(res.data);
        } catch (e) {
            console.log("Error fetching org requests", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(useCallback(() => { setLoading(true); fetchRequests(); }, []));

    const filtered = activeFilter === "TODAS"
        ? requests
        : requests.filter(r => r.status === activeFilter);

    const renderItem = ({ item }) => {
        const cfg = STATUS_CONFIG[item.status] || STATUS_CONFIG.PENDING_APPROVAL;
        const typeLabel = ORG_TYPE_LABELS[item.organizationType] || item.organizationType;
        return (
            <TouchableOpacity
                style={styles.card}
                onPress={() => navigation.navigate("OrganizationRequestDetail", { requestId: item.id })}
                activeOpacity={0.8}
            >
                <View style={styles.cardHeader}>
                    <Text style={styles.orgName}>{item.organizationName}</Text>
                    <View style={[styles.badge, { backgroundColor: cfg.bg }]}>
                        <Text style={[styles.badgeText, { color: cfg.color }]}>{cfg.label}</Text>
                    </View>
                </View>
                <Text style={styles.meta}>{typeLabel} · {item.city}</Text>
                <Text style={styles.meta}>Responsable: {item.ownerEmail}</Text>
                <Text style={styles.meta}>Solicitante: {item.requestingUserEmail}</Text>
                {item.createdAt && (
                    <Text style={styles.date}>
                        {new Date(item.createdAt).toLocaleDateString("es-AR")}
                    </Text>
                )}
                <View style={styles.arrowRow}>
                    <Text style={styles.viewDetail}>Ver detalle</Text>
                    <Icon name="chevron-right" size={12} color="#4A9999" />
                </View>
            </TouchableOpacity>
        );
    };

    if (loading) {
        return <View style={styles.centered}><ActivityIndicator size="large" color="#4A9999" /></View>;
    }

    return (
        <View style={styles.container}>
            <Text style={styles.screenTitle}>Solicitudes de alta</Text>
            <FlatList
                horizontal
                data={FILTERS}
                keyExtractor={f => f}
                showsHorizontalScrollIndicator={false}
                style={styles.filterRow}
                renderItem={({ item: f }) => (
                    <TouchableOpacity
                        style={[styles.filterChip, activeFilter === f && styles.filterChipActive]}
                        onPress={() => setActiveFilter(f)}
                    >
                        <Text style={[styles.filterText, activeFilter === f && styles.filterTextActive]}>
                            {FILTER_LABELS[f]}
                        </Text>
                    </TouchableOpacity>
                )}
            />
            <FlatList
                data={filtered}
                keyExtractor={item => item.id.toString()}
                renderItem={renderItem}
                contentContainerStyle={styles.list}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchRequests(); }} />
                }
                ListEmptyComponent={
                    <EmptyState icon="inbox" title="No hay solicitudes en esta categoría." />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#F5F5F5", paddingTop: 50 },
    centered: { flex: 1, justifyContent: "center", alignItems: "center" },
    screenTitle: {
        fontSize: 22, fontFamily: "PlusJakartaSans-Bold",
        color: "#1A3434", paddingHorizontal: 16, marginBottom: 8,
    },
    filterRow: { paddingHorizontal: 12, marginBottom: 8, flexGrow: 0 },
    filterChip: {
        borderWidth: 1, borderColor: "#bdc1c1", borderRadius: 20,
        paddingHorizontal: 16, paddingVertical: 7, marginHorizontal: 5,
        backgroundColor: "#fff", flexShrink: 0,
    },
    filterChipActive: { borderColor: "#4A9999", backgroundColor: "#4A9999" },
    filterText: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#638888" },
    filterTextActive: { color: "#fff", fontFamily: "PlusJakartaSans-Bold" },
    list: { paddingHorizontal: 16, paddingBottom: 20 },
    card: {
        backgroundColor: "#fff", borderRadius: 12, padding: 16,
        marginBottom: 12, elevation: 1,
    },
    cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 },
    orgName: { fontSize: 16, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434", flex: 1, marginRight: 8 },
    badge: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
    badgeText: { fontSize: 11, fontFamily: "PlusJakartaSans-Bold" },
    meta: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#555", marginBottom: 2 },
    date: { fontSize: 11, color: "#999", fontFamily: "PlusJakartaSans-Regular", marginTop: 4 },
    arrowRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
    viewDetail: { fontSize: 12, color: "#4A9999", fontFamily: "PlusJakartaSans-Bold" },
});

export default OrganizationRequestsAdmin;
