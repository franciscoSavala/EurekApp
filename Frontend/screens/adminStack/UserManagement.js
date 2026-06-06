import React, { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
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

const ROLE_CONFIG = {
    USER:                  { label: "Usuario",       color: "#4A9999" },
    ORGANIZATION_OWNER:    { label: "Responsable",   color: "#7B5EA7" },
    ORGANIZATION_EMPLOYEE: { label: "Empleado",      color: "#2E86AB" },
    ENCARGADO:             { label: "Encargado",     color: "#F0A500" },
    ADMIN:                 { label: "Administrador", color: "#CC4444" },
};

const FILTERS = [
    { label: "Todos",         value: null },
    { label: "Usuarios",      value: "USER" },
    { label: "Responsables",  value: "ORGANIZATION_OWNER" },
    { label: "Empleados",     value: "ORGANIZATION_EMPLOYEE" },
    { label: "Encargados",    value: "ENCARGADO" },
    { label: "Admins",        value: "ADMIN" },
];

const UserManagement = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeFilter, setActiveFilter] = useState(null);
    const [toggling, setToggling] = useState(null);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userConfirmVisible, setUserConfirmVisible] = useState(false);

    const fetchUsers = async (roleFilter) => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const url = roleFilter
                ? BACK_URL + `/admin/users?role=${roleFilter}`
                : BACK_URL + `/admin/users`;
            const res = await axiosInstance.get(url, {
                headers: { Authorization: "Bearer " + jwt },
            });
            setUsers(res.data);
        } catch (e) {
            Toast.show({ type: "error", text1: "No se pudo cargar la lista de usuarios." });
        } finally {
            setLoading(false);
        }
    };

    // Carga inicial al enfocar la pantalla
    useFocusEffect(useCallback(() => {
        fetchUsers(activeFilter);
    }, []));

    // Re-fetch cuando cambia el filtro
    useEffect(() => {
        fetchUsers(activeFilter);
    }, [activeFilter]);

    const confirmToggle = async (user) => {
        setUserConfirmVisible(false);
        setToggling(user.id);
        const actionPast = user.active ? "desactivado" : "activado";
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.put(
                BACK_URL + `/admin/users/${user.id}/active`,
                { active: !user.active },
                { headers: { Authorization: "Bearer " + jwt } }
            );
            Toast.show({ type: "success", text1: `Usuario ${actionPast} correctamente.` });
            fetchUsers(activeFilter);
        } catch (e) {
            const msg = e?.response?.data?.message || "No se pudo cambiar el estado del usuario.";
            Toast.show({ type: "error", text1: msg });
        } finally {
            setToggling(null);
        }
    };

    const renderUser = ({ item }) => {
        const roleCfg = ROLE_CONFIG[item.role] || { label: item.role, color: "#555" };
        const isToggling = toggling === item.id;

        return (
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <View style={styles.nameRow}>
                        <Text style={styles.fullName}>{item.firstName} {item.lastName}</Text>
                        <View style={[styles.roleBadge, { backgroundColor: roleCfg.color + "22", borderColor: roleCfg.color }]}>
                            <Text style={[styles.roleText, { color: roleCfg.color }]}>{roleCfg.label}</Text>
                        </View>
                    </View>
                    <Text style={styles.email}>{item.username}</Text>
                    {item.organizationName ? (
                        <View style={styles.orgRow}>
                            <Icon name="sitemap" size={11} color="#638888" />
                            <Text style={styles.orgName}>{item.organizationName}</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.cardFooter}>
                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Icon name="star" size={11} color="#F0A500" />
                            <Text style={styles.stat}>{item.XP ?? 0} XP</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Icon name="rotate-left" size={11} color="#4A9999" />
                            <Text style={styles.stat}>{item.returnedObjects ?? 0} devueltos</Text>
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[
                            styles.toggleBtn,
                            item.active ? styles.toggleBtnActive : styles.toggleBtnInactive,
                        ]}
                        onPress={() => { setSelectedUser(item); setUserConfirmVisible(true); }}
                        disabled={isToggling}
                    >
                        {isToggling ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <Text style={styles.toggleBtnText}>
                                {item.active ? "Desactivar" : "Activar"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filtersScroll}
                contentContainerStyle={styles.filtersRow}
            >
                {FILTERS.map((f) => (
                    <TouchableOpacity
                        key={f.label}
                        style={[styles.chip, activeFilter === f.value && styles.chipActive]}
                        onPress={() => setActiveFilter(f.value)}
                    >
                        <Text style={[styles.chipText, activeFilter === f.value && styles.chipTextActive]}>
                            {f.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#4A9999" />
                </View>
            ) : (
                <FlatList
                    data={users}
                    keyExtractor={(item) => String(item.id)}
                    renderItem={renderUser}
                    style={{ flex: 1 }}
                    contentContainerStyle={styles.list}
                    extraData={toggling}
                    onRefresh={() => fetchUsers(activeFilter)}
                    refreshing={loading}
                    ListEmptyComponent={
                        <View style={styles.centered}>
                            <Text style={styles.emptyText}>No hay usuarios en esta categoría.</Text>
                        </View>
                    }
                />
            )}

            <InfoModal
                visible={userConfirmVisible}
                onClose={() => setUserConfirmVisible(false)}
                type="warning"
                title={selectedUser?.active ? "¿Desactivar usuario?" : "¿Activar usuario?"}
                message={
                    selectedUser?.active
                        ? `Al desactivar a ${selectedUser?.firstName} ${selectedUser?.lastName}, no podrá iniciar sesión en la plataforma.`
                        : `Al activar a ${selectedUser?.firstName} ${selectedUser?.lastName}, podrá volver a iniciar sesión.`
                }
                cancelLabel="Cancelar"
                confirmLabel={selectedUser?.active ? "Desactivar" : "Activar"}
                onConfirm={() => selectedUser && confirmToggle(selectedUser)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f4f7f7" },
    filtersScroll: { height: 56, flexGrow: 0, flexShrink: 0 },
    filtersRow: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: "center",
    },
    chip: {
        paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
        backgroundColor: "#fff", borderWidth: 1, borderColor: "#dde8e8",
        marginRight: 8,
    },
    chipActive: { backgroundColor: "#4A9999", borderColor: "#4A9999" },
    chipText: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#555" },
    chipTextActive: { color: "#fff", fontFamily: "PlusJakartaSans-Bold" },
    list: { padding: 16, paddingBottom: 48, flexGrow: 1, justifyContent: "flex-start" },
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
    nameRow: {
        flexDirection: "row", alignItems: "center",
        marginBottom: 4, flexWrap: "wrap",
    },
    fullName: {
        fontSize: 15, fontFamily: "PlusJakartaSans-Bold",
        color: "#1A3434", marginRight: 8, flexShrink: 1,
    },
    roleBadge: {
        paddingHorizontal: 10, paddingVertical: 3,
        borderRadius: 10, borderWidth: 1,
    },
    roleText: { fontSize: 11, fontFamily: "PlusJakartaSans-Bold" },
    email: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#638888" },
    orgRow: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
    orgName: { fontSize: 12, fontFamily: "PlusJakartaSans-Regular", color: "#638888" },
    cardFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    statsRow: { flexDirection: "row", alignItems: "center" },
    statItem: { flexDirection: "row", alignItems: "center", marginRight: 14 },
    stat: { fontSize: 12, fontFamily: "PlusJakartaSans-Regular", color: "#555", marginLeft: 4 },
    toggleBtn: {
        paddingHorizontal: 16, paddingVertical: 8,
        borderRadius: 10, minWidth: 90, alignItems: "center",
    },
    toggleBtnActive: { backgroundColor: "#CC4444" },
    toggleBtnInactive: { backgroundColor: "#4A9999" },
    toggleBtnText: { color: "#fff", fontSize: 13, fontFamily: "PlusJakartaSans-Bold" },
});

export default UserManagement;
