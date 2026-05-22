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
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import { useFocusEffect } from "@react-navigation/native";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const TYPE_LABELS = {
    EMPLOYEE_INVITATION: "Solicitud de organización",
    ROLE_CHANGED: "Cambio de rol",
    MATCH_FOUND: "Coincidencia encontrada",
    REWARD_EARNED: "Recompensa obtenida",
};

const formatDate = (isoString) => {
    if (!isoString) return "";
    const d = new Date(isoString);
    return d.toLocaleDateString("es-AR") + " " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
};

const Notifications = ({ navigation }) => {
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
            const jwt = await AsyncStorage.getItem("jwt");
            await axiosInstance.post(
                BACK_URL + "/organizations/acceptAddEmployeeRequest",
                { requestId },
                { headers: { Authorization: "Bearer " + jwt } }
            );
            await markAsRead(notifId);
            fetchNotifications();
        } catch (e) {
            console.log("Error accepting request", e);
        }
    };

    const handleReject = async (requestId, notifId) => {
        try {
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

    const renderItem = ({ item }) => {
        const isUnread = !item.is_read;
        const isPendingInvitation =
            item.type === "EMPLOYEE_INVITATION" && item.related_request_id != null && isUnread;

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
                <Text style={styles.itemDate}>{formatDate(item.created_at)}</Text>

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
                    <View style={styles.centered}>
                        <Text style={styles.emptyText}>No tenés notificaciones.</Text>
                    </View>
                }
                contentContainerStyle={notifications.length === 0 && styles.emptyContainer}
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
