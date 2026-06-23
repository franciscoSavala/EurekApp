import React, { useCallback, useContext, useState } from "react";
import { formatDateTimeLocaleES } from '../../utils/dateFormatter';
import {
    ActivityIndicator,
    FlatList,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Toast from 'react-native-toast-message';
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";
import EmptyState from "../components/EmptyState";
import { LoginContext } from "../../hooks/useUser";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const TYPE_LABELS = {
    EMPLOYEE_INVITATION: "Solicitud de organización",
    ROLE_CHANGED: "Cambio de rol",
    MATCH_FOUND: "Coincidencia encontrada",
    REWARD_EARNED: "Recompensa obtenida",
    REWARD_BLOCKED: "Recompensa no otorgada",
    FRAUD_BLOCK_LIFTED: "Bloqueo levantado",
    FRAUD_EMPLOYEE_INVOLVED: "Empleado involucrado en fraude",
    FRAUD_ALERT: "Alerta de fraude",
    ORG_REGISTRATION_REQUEST: "Solicitud de alta de organización",
    ORG_REQUEST_APPROVED: "Solicitud aprobada",
    ORG_REQUEST_REJECTED: "Solicitud rechazada",
};


const Notifications = ({ navigation, route }) => {
    const { setUserRole } = useContext(LoginContext);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchNotifications = async () => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + "/notifications", {
                headers: { Authorization: "Bearer " + jwt },
            });
            setNotifications(res.data);
        } catch (e) {
            console.log("Error fetching notifications", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useFocusEffect(
        useCallback(() => {
            setLoading(true);
            fetchNotifications();
        }, [])
    );

    const markAsRead = async (id) => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.post(BACK_URL + `/notifications/${id}/read`, {}, {
                headers: { Authorization: "Bearer " + jwt },
            });
            setNotifications((prev) =>
                prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
            );
        } catch (e) {
            console.log("Error marking notification as read", e);
        }
    };

    const handleAccept = async (requestId, notifId) => {
        try {
            setNotifications(prev => prev.map(n =>
                n.id === notifId ? { ...n, related_request_id: null } : n
            ));
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.post(
                BACK_URL + "/organizations/acceptAddEmployeeRequest",
                { requestId },
                { headers: { Authorization: "Bearer " + jwt } }
            );
            if (res.data?.token) {
                await AsyncStorage.setItem('jwt', res.data.token);
            }
            if (res.data?.refreshToken) {
                await AsyncStorage.setItem('refreshToken', res.data.refreshToken);
            }
            if (res.data?.user) {
                await AsyncStorage.setItem('user.first_name', res.data.user.firstName.toString());
                await AsyncStorage.setItem('user', JSON.stringify(res.data.user));
                setUserRole(res.data.user.role);
            }
            if (res.data?.organization) {
                await AsyncStorage.setItem('org.id', res.data.organization.id.toString());
                await AsyncStorage.setItem('org.name', res.data.organization.name);
                await AsyncStorage.setItem('organization', JSON.stringify(res.data.organization));
            }
            await markAsRead(notifId);
            fetchNotifications();
            const orgName = res.data?.organization?.name ?? "la organización";
            Toast.show({
                type: 'success',
                text1: '¡Solicitud aceptada!',
                text2: `Ahora formas parte de ${orgName}.`,
            });
            if (Platform.OS === 'web') {
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (e) {
            console.log("Error accepting request", e);
            Toast.show({
                type: 'error',
                text1: 'Error',
                text2: 'No se pudo aceptar la solicitud. Intentá de nuevo.',
            });
        }
    };

    const handleReject = async (requestId, notifId) => {
        try {
            setNotifications(prev => prev.map(n =>
                n.id === notifId ? { ...n, related_request_id: null } : n
            ));
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.post(
                BACK_URL + "/organizations/declineAddEmployeeRequest",
                { requestId },
                { headers: { Authorization: "Bearer " + jwt } }
            );
            await markAsRead(notifId);
            fetchNotifications();
        } catch (e) {
            console.log("Error rejecting request", e);
        }
    };

    const handleRefreshSession = async (notifId) => {
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + "/user/refreshUserDetails", {
                headers: { Authorization: "Bearer " + jwt },
            });
            if (res.data?.user) {
                await AsyncStorage.setItem("user.first_name", res.data.user.firstName.toString());
                await AsyncStorage.setItem("user", JSON.stringify(res.data.user));
                setUserRole(res.data.user.role);
            }
            if (res.data?.organization) {
                await AsyncStorage.setItem("org.id", res.data.organization.id.toString());
                await AsyncStorage.setItem("org.name", res.data.organization.name);
                await AsyncStorage.setItem("organization", JSON.stringify(res.data.organization));
            }
            await markAsRead(notifId);
            fetchNotifications();
            Toast.show({
                type: "success",
                text1: "¡Sesión actualizada!",
                text2: "Ya sos responsable de la organización.",
            });
            if (Platform.OS === "web") {
                setTimeout(() => window.location.reload(), 1500);
            }
        } catch (e) {
            Toast.show({
                type: "error",
                text1: "Error",
                text2: "No se pudo actualizar la sesión. Intentá de nuevo.",
            });
        }
    };

    const renderItem = ({ item }) => {
        const isUnread = !item.is_read;
        const isPendingInvitation =
            item.type === "EMPLOYEE_INVITATION" && item.related_request_id != null;
        const isApprovedOrgRequest = item.type === "ORG_REQUEST_APPROVED" && !item.is_read;

        return (
            <TouchableOpacity
                style={[styles.item, isUnread && styles.itemUnread]}
                onPress={() => markAsRead(item.id)}
                activeOpacity={0.8}
            >
                <View style={styles.itemHeader}>
                    <Text style={styles.typeLabel}>
                        {TYPE_LABELS[item.type] || item.type}
                    </Text>
                    {isUnread && <View style={styles.unreadDot} />}
                </View>
                <Text style={styles.itemTitle}>{item.title}</Text>
                <Text style={styles.itemDescription}>{item.description}</Text>
                <Text style={styles.itemDate}>{formatDateTimeLocaleES(item.created_at)}</Text>

                {isPendingInvitation && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleAccept(item.related_request_id, item.id)}
                        >
                            <Text style={styles.actionButtonText}>Aceptar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.rejectButton}
                            onPress={() => handleReject(item.related_request_id, item.id)}
                        >
                            <Text style={styles.actionButtonText}>Rechazar</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {isApprovedOrgRequest && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.acceptButton}
                            onPress={() => handleRefreshSession(item.id)}
                        >
                            <Text style={styles.actionButtonText}>Actualizar sesión</Text>
                        </TouchableOpacity>
                    </View>
                )}
                {item.type === "FRAUD_ALERT" && item.related_request_id != null && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity
                            style={styles.fraudButton}
                            onPress={() => {
                                markAsRead(item.id);
                                navigation.navigate("FraudAlertsStackScreen", {
                                    screen: "FraudAlertDetail",
                                    params: { alertId: item.related_request_id },
                                });
                            }}
                        >
                            <Text style={styles.actionButtonText}>Ver alerta</Text>
                        </TouchableOpacity>
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#4A9999" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Text style={styles.screenTitle}>Notificaciones</Text>
            <FlatList
                data={notifications}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            setRefreshing(true);
                            fetchNotifications();
                        }}
                    />
                }
                ListEmptyComponent={
                    <EmptyState icon="bell-slash" title="No tenés notificaciones." />
                }
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
        paddingTop: 50,
    },
    screenTitle: {
        fontSize: 22,
        fontFamily: "PlusJakartaSans-Bold",
        color: "#1A3434",
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    item: {
        backgroundColor: "#FFFFFF",
        borderRadius: 10,
        padding: 14,
        marginHorizontal: 16,
        marginBottom: 10,
        borderLeftWidth: 4,
        borderLeftColor: "#E0E0E0",
        elevation: 1,
    },
    itemUnread: {
        borderLeftColor: "#4A9999",
        backgroundColor: "#F0F8F8",
    },
    itemHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 4,
    },
    typeLabel: {
        fontSize: 11,
        color: "#4A9999",
        fontFamily: "PlusJakartaSans-Bold",
        textTransform: "uppercase",
        letterSpacing: 0.5,
    },
    unreadDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: "#4A9999",
    },
    itemTitle: {
        fontSize: 15,
        fontFamily: "PlusJakartaSans-Bold",
        color: "#1A3434",
        marginBottom: 4,
    },
    itemDescription: {
        fontSize: 13,
        color: "#555",
        marginBottom: 6,
        lineHeight: 18,
    },
    itemDate: {
        fontSize: 11,
        color: "#999",
    },
    actionRow: {
        flexDirection: "row",
        marginTop: 10,
        gap: 10,
    },
    acceptButton: {
        backgroundColor: "#4A9999",
        paddingVertical: 7,
        paddingHorizontal: 18,
        borderRadius: 6,
    },
    rejectButton: {
        backgroundColor: "#CC4444",
        paddingVertical: 7,
        paddingHorizontal: 18,
        borderRadius: 6,
    },
    fraudButton: {
        backgroundColor: "#b45309",
        paddingVertical: 7,
        paddingHorizontal: 18,
        borderRadius: 6,
    },
    actionButtonText: {
        color: "#FFFFFF",
        fontFamily: "PlusJakartaSans-Bold",
        fontSize: 13,
    },
    centered: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingTop: 60,
    },
    emptyContainer: {
        flexGrow: 1,
    },
    emptyText: {
        color: "#888",
        fontSize: 15,
        fontFamily: "PlusJakartaSans-Regular",
    },
});

export default Notifications;
