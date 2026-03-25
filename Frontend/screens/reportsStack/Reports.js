import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Linking,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import StarRating from "../components/StarRating";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const formatDate = (date) => date.toISOString().split("T")[0];

const Reports = ({ navigation }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [fromDate, setFromDate] = useState(thirtyDaysAgo);
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [groupBy, setGroupBy] = useState("DAY");
    const [data, setData] = useState(null);
    const [feedbackData, setFeedbackData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchReports = async () => {
        setLoading(true);
        setError(null);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const params = { from: formatDate(fromDate), to: formatDate(toDate), groupBy };
            const headers = { Authorization: `Bearer ${jwt}` };
            const res = await axios.get(`${BACK_URL}/reports`, { headers, params });
            setData(res.data);
            try {
                const fbRes = await axios.get(`${BACK_URL}/feedback/report`, { headers, params });
                setFeedbackData(fbRes.data);
            } catch {
                setFeedbackData(null); // usuario sin permiso o sin datos
            }
        } catch (e) {
            setError("No se pudieron cargar los reportes.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCsv = async () => {
        const jwt = await AsyncStorage.getItem("jwt");
        const url = `${BACK_URL}/feedback/report/export?from=${formatDate(fromDate)}&to=${formatDate(toDate)}`;
        if (Platform.OS === "web") {
            // En web, el JWT no se puede pasar por URL fácilmente; hacer fetch y disparar descarga
            try {
                const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objectUrl;
                a.download = "feedback-report.csv";
                a.click();
                URL.revokeObjectURL(objectUrl);
            } catch (e) {
                console.warn("Error exportando CSV:", e);
            }
        } else {
            // En native: descargar con expo-file-system y compartir con expo-sharing
            try {
                const FileSystem = require("expo-file-system");
                const Sharing = require("expo-sharing");
                const fileUri = FileSystem.cacheDirectory + "feedback-report.csv";
                const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadRes.uri, { mimeType: "text/csv", dialogTitle: "Exportar reporte de feedback" });
                }
            } catch (e) {
                console.warn("Error exportando CSV en native:", e);
            }
        }
    };

    useEffect(() => {
        fetchReports();
    }, [fromDate, toDate, groupBy]);

    const maxValue = data?.time_series
        ? Math.max(
              1,
              ...data.time_series.flatMap((p) => [
                  p.found_objects,
                  p.lost_objects,
                  p.returned_objects,
              ])
          )
        : 1;

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Reporte de uso</Text>

                {/* Date range pickers */}
                <View style={styles.row}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.label}>Desde</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowFromPicker(true)}
                        >
                            <Text style={styles.dateText}>{formatDate(fromDate)}</Text>
                        </TouchableOpacity>
                        {showFromPicker && (
                            <DateTimePicker
                                value={fromDate}
                                mode="date"
                                display={Platform.OS === "ios" ? "inline" : "default"}
                                onChange={(_, selected) => {
                                    setShowFromPicker(false);
                                    if (selected) setFromDate(selected);
                                }}
                            />
                        )}
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.label}>Hasta</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowToPicker(true)}
                        >
                            <Text style={styles.dateText}>{formatDate(toDate)}</Text>
                        </TouchableOpacity>
                        {showToPicker && (
                            <DateTimePicker
                                value={toDate}
                                mode="date"
                                display={Platform.OS === "ios" ? "inline" : "default"}
                                onChange={(_, selected) => {
                                    setShowToPicker(false);
                                    if (selected) setToDate(selected);
                                }}
                            />
                        )}
                    </View>
                </View>

                {/* GroupBy selector */}
                <View style={styles.row}>
                    {["DAY", "WEEK", "MONTH"].map((g) => (
                        <Pressable
                            key={g}
                            style={[styles.groupBtn, groupBy === g && styles.groupBtnActive]}
                            onPress={() => setGroupBy(g)}
                        >
                            <Text
                                style={[
                                    styles.groupBtnText,
                                    groupBy === g && styles.groupBtnTextActive,
                                ]}
                            >
                                {g === "DAY" ? "Día" : g === "WEEK" ? "Semana" : "Mes"}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#19b8b8" />}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {data && !loading && (
                    <>
                        {/* Summary cards */}
                        <View style={styles.cardsRow}>
                            <MetricCard label="Objetos encontrados" value={data.found_objects} color="#19b8b8" />
                            <MetricCard label="Búsquedas / perdidos" value={data.lost_objects} color="#f0a500" />
                        </View>
                        <View style={styles.cardsRow}>
                            <MetricCard label="Objetos devueltos" value={data.returned_objects} color="#4caf50" />
                            <MetricCard label="Usuarios activos" value={data.active_users} color="#7c4dff" />
                        </View>

                        {/* Sección de feedback (solo para ORGANIZATION_OWNER) */}
                        {feedbackData && (
                            <>
                                <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Feedback de búsquedas</Text>
                                <View style={styles.cardsRow}>
                                    <View style={[styles.card, { borderLeftColor: '#f0a500', alignItems: 'center' }]}>
                                        <StarRating rating={Math.round(feedbackData.average_rating || 0)} size={18} disabled />
                                        <Text style={[styles.cardValue, { color: '#f0a500', fontSize: 20 }]}>
                                            {feedbackData.average_rating?.toFixed(1) ?? '—'}
                                        </Text>
                                        <Text style={styles.cardLabel}>Calificación promedio</Text>
                                    </View>
                                    <MetricCard label="Total de feedbacks" value={feedbackData.total_feedback} color="#638888" />
                                </View>
                                <View style={styles.cardsRow}>
                                    <MetricCard label="Búsquedas exitosas" value={feedbackData.successful_searches} color="#4caf50" />
                                    <MetricCard label="Búsquedas fallidas" value={feedbackData.unsuccessful_searches} color="#e53935" />
                                </View>

                                {/* Distribución de estrellas */}
                                {feedbackData.star_distribution && (
                                    <View style={styles.tableContainer}>
                                        <Text style={styles.sectionTitle}>Distribución de calificaciones</Text>
                                        {[5, 4, 3, 2, 1].map(star => {
                                            const count = feedbackData.star_distribution[star] || 0;
                                            const total = feedbackData.total_feedback || 1;
                                            const pct = Math.round((count / total) * 100);
                                            return (
                                                <View key={star} style={[styles.tableRow, { alignItems: 'center' }]}>
                                                    <Text style={[styles.tableCell, { width: 30, color: '#f0a500' }]}>{'★'.repeat(star)}</Text>
                                                    <View style={[styles.tableCell, { flex: 1 }]}>
                                                        <View style={[styles.bar, { width: `${pct}%`, backgroundColor: '#f0a500', minWidth: 2 }]} />
                                                    </View>
                                                    <Text style={[styles.tableCell, { width: 50, textAlign: 'right' }]}>{count}</Text>
                                                </View>
                                            );
                                        })}
                                    </View>
                                )}

                                {/* Tendencias de feedback */}
                                {feedbackData.time_series && feedbackData.time_series.length > 0 && (
                                    <View style={styles.tableContainer}>
                                        <Text style={styles.sectionTitle}>Tendencias de feedback</Text>
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                            <View>
                                                <View style={styles.tableRow}>
                                                    <Text style={[styles.tableCell, styles.tableHeader, { width: 110 }]}>Período</Text>
                                                    <Text style={[styles.tableCell, styles.tableHeader, { width: 90 }]}>Calif. prom.</Text>
                                                    <Text style={[styles.tableCell, styles.tableHeader, { width: 80 }]}>Exitosas</Text>
                                                    <Text style={[styles.tableCell, styles.tableHeader, { width: 80 }]}>Fallidas</Text>
                                                </View>
                                                {feedbackData.time_series.map(point => (
                                                    <View key={point.label} style={styles.tableRow}>
                                                        <Text style={[styles.tableCell, { width: 110 }]}>{point.label}</Text>
                                                        <Text style={[styles.tableCell, { width: 90 }]}>{point.avg_rating?.toFixed(1) ?? '—'} ★</Text>
                                                        <View style={[styles.tableCell, { width: 80 }]}>
                                                            <Text style={styles.barValue}>{point.successful}</Text>
                                                            <View style={[styles.bar, { width: `${(point.successful / (point.total || 1)) * 100}%`, backgroundColor: '#4caf50' }]} />
                                                        </View>
                                                        <View style={[styles.tableCell, { width: 80 }]}>
                                                            <Text style={styles.barValue}>{point.unsuccessful}</Text>
                                                            <View style={[styles.bar, { width: `${(point.unsuccessful / (point.total || 1)) * 100}%`, backgroundColor: '#e53935' }]} />
                                                        </View>
                                                    </View>
                                                ))}
                                            </View>
                                        </ScrollView>
                                    </View>
                                )}

                                {/* Botón de exportar CSV */}
                                <TouchableOpacity style={styles.exportBtn} onPress={handleExportCsv}>
                                    <Text style={styles.exportBtnText}>Exportar CSV</Text>
                                </TouchableOpacity>
                            </>
                        )}


                        {/* Time series table */}
                        {data.time_series && data.time_series.length > 0 && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Tendencias</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View>
                                        {/* Header */}
                                        <View style={styles.tableRow}>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 110 }]}>Período</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 90 }]}>Encontrados</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 90 }]}>Perdidos</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 90 }]}>Devueltos</Text>
                                        </View>
                                        {data.time_series.map((point) => (
                                            <View key={point.label} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { width: 110 }]}>{point.label}</Text>
                                                <View style={[styles.tableCell, { width: 90 }]}>
                                                    <Text style={styles.barValue}>{point.found_objects}</Text>
                                                    <View style={[styles.bar, { width: `${(point.found_objects / maxValue) * 100}%`, backgroundColor: "#19b8b8" }]} />
                                                </View>
                                                <View style={[styles.tableCell, { width: 90 }]}>
                                                    <Text style={styles.barValue}>{point.lost_objects}</Text>
                                                    <View style={[styles.bar, { width: `${(point.lost_objects / maxValue) * 100}%`, backgroundColor: "#f0a500" }]} />
                                                </View>
                                                <View style={[styles.tableCell, { width: 90 }]}>
                                                    <Text style={styles.barValue}>{point.returned_objects}</Text>
                                                    <View style={[styles.bar, { width: `${(point.returned_objects / maxValue) * 100}%`, backgroundColor: "#4caf50" }]} />
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}
                        {data.time_series && data.time_series.length === 0 && (
                            <Text style={styles.emptyText}>Sin datos para el período seleccionado.</Text>
                        )}
                    </>
                )}
            </View>
        </ScrollView>
    );
};

const MetricCard = ({ label, value, color }) => (
    <View style={[styles.card, { borderLeftColor: color }]}>
        <Text style={[styles.cardValue, { color }]}>{value}</Text>
        <Text style={styles.cardLabel}>{label}</Text>
    </View>
);

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#fff",
    },
    content: {
        padding: 16,
        maxWidth: 800,
        alignSelf: "center",
        width: "100%",
    },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        fontFamily: "PlusJakartaSans-Bold",
        marginBottom: 16,
        color: "#111818",
    },
    row: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 12,
    },
    dateBlock: {
        flex: 1,
    },
    label: {
        fontSize: 13,
        color: "#638888",
        fontFamily: "PlusJakartaSans-Regular",
        marginBottom: 4,
    },
    dateButton: {
        backgroundColor: "#f0f4f4",
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    dateText: {
        fontSize: 14,
        color: "#111818",
        fontFamily: "PlusJakartaSans-Regular",
    },
    groupBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#f0f4f4",
        alignItems: "center",
    },
    groupBtnActive: {
        backgroundColor: "#19b8b8",
    },
    groupBtnText: {
        fontSize: 14,
        color: "#638888",
        fontFamily: "PlusJakartaSans-Regular",
    },
    groupBtnTextActive: {
        color: "#fff",
        fontFamily: "PlusJakartaSans-Bold",
    },
    cardsRow: {
        flexDirection: "row",
        gap: 10,
        marginBottom: 10,
    },
    card: {
        flex: 1,
        backgroundColor: "#f0f4f4",
        borderRadius: 12,
        padding: 14,
        borderLeftWidth: 4,
    },
    cardValue: {
        fontSize: 28,
        fontWeight: "bold",
        fontFamily: "PlusJakartaSans-Bold",
    },
    cardLabel: {
        fontSize: 12,
        color: "#638888",
        fontFamily: "PlusJakartaSans-Regular",
        marginTop: 2,
    },
    tableContainer: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "PlusJakartaSans-Bold",
        color: "#111818",
        marginBottom: 8,
    },
    tableRow: {
        flexDirection: "row",
        borderBottomWidth: 1,
        borderBottomColor: "#e0e8e8",
        paddingVertical: 6,
    },
    tableCell: {
        paddingHorizontal: 6,
        justifyContent: "center",
    },
    tableHeader: {
        fontFamily: "PlusJakartaSans-Bold",
        fontSize: 13,
        color: "#111818",
    },
    bar: {
        height: 6,
        borderRadius: 3,
        marginTop: 3,
        minWidth: 2,
    },
    barValue: {
        fontSize: 13,
        color: "#111818",
        fontFamily: "PlusJakartaSans-Regular",
    },
    emptyText: {
        color: "#638888",
        textAlign: "center",
        marginTop: 20,
        fontFamily: "PlusJakartaSans-Regular",
    },
    errorText: {
        color: "red",
        textAlign: "center",
        marginTop: 20,
    },
    exportBtn: {
        marginTop: 12,
        marginBottom: 20,
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#19b8b8',
        borderRadius: 10,
        alignSelf: 'flex-start',
    },
    exportBtnText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
    },
});

export default Reports;
