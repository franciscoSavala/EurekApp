import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { buildUsabilityFeedbackReportHtml, exportPdf } from "../../utils/pdfExport";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { isWeb, isIOS } from "../../utils/platform";
import StarRating from "../components/StarRating";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const formatDate = (date) => date.toISOString().split("T")[0];

const ASPECT_LABELS = {
    FACILIDAD_USO: "Facilidad de uso",
    CLARIDAD: "Claridad de interfaz",
    TIEMPO_RESPUESTA: "Tiempo de respuesta",
    NAVEGACION: "Navegación",
};

const ASPECT_ORDER = ["FACILIDAD_USO", "CLARIDAD", "TIEMPO_RESPUESTA", "NAVEGACION"];
const ASPECT_COLOR = "#19b8b8";

const UsabilityFeedbackReport = ({ navigation }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [fromDate, setFromDate] = useState(thirtyDaysAgo);
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [groupBy, setGroupBy] = useState("DAY");
    const [reportData, setReportData] = useState(null);
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const params = { from: formatDate(fromDate), to: formatDate(toDate), groupBy };
            const headers = { Authorization: `Bearer ${jwt}` };

            const [repRes, recRes] = await Promise.all([
                axiosInstance.get(`${BACK_URL}/usability-feedback/report`, { headers, params }),
                axiosInstance.get(`${BACK_URL}/usability-feedback/records`, { headers, params: { from: formatDate(fromDate), to: formatDate(toDate) } }),
            ]);
            setReportData(repRes.data);
            setRecords(recRes.data || []);
        } catch (e) {
            setError("No se pudieron cargar los reportes.");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const handleExportCsv = async () => {
        const jwt = await AsyncStorage.getItem("jwt");
        const url = `${BACK_URL}/usability-feedback/report/export?from=${formatDate(fromDate)}&to=${formatDate(toDate)}`;
        if (isWeb) {
            try {
                const res = await fetch(url, { headers: { Authorization: `Bearer ${jwt}` } });
                const blob = await res.blob();
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = objectUrl;
                a.download = "usability-feedback-report.csv";
                a.click();
                URL.revokeObjectURL(objectUrl);
            } catch (e) {
                console.warn("Error exportando CSV:", e);
            }
        } else {
            try {
                const FileSystem = require("expo-file-system");
                const Sharing = require("expo-sharing");
                const fileUri = FileSystem.cacheDirectory + "usability-feedback-report.csv";
                const downloadRes = await FileSystem.downloadAsync(url, fileUri, {
                    headers: { Authorization: `Bearer ${jwt}` },
                });
                if (await Sharing.isAvailableAsync()) {
                    await Sharing.shareAsync(downloadRes.uri, { mimeType: "text/csv", dialogTitle: "Exportar reporte de usabilidad" });
                }
            } catch (e) {
                console.warn("Error exportando CSV en native:", e);
            }
        }
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const html = buildUsabilityFeedbackReportHtml(reportData, records, {
                fromDate: formatDate(fromDate),
                toDate: formatDate(toDate),
                groupBy,
            });
            await exportPdf(html, `Reporte_Usabilidad_${formatDate(new Date())}.pdf`);
        } catch (e) {
            console.warn("Error exportando PDF:", e);
            Alert.alert("Error", "No se pudo exportar el PDF. Intentá nuevamente.");
        } finally {
            setExportingPdf(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [fromDate, toDate, groupBy]);

    const aspectMax = reportData?.aspect_distribution
        ? Math.max(1, ...ASPECT_ORDER.map(k => reportData.aspect_distribution[k] || 0))
        : 1;

    const commentsWithText = records.filter(r => r.comment && r.comment.trim().length > 0);

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Volver al reporte</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Reporte de usabilidad</Text>

                {/* Date range */}
                <View style={styles.row}>
                    <View style={styles.dateBlock}>
                        <Text style={styles.label}>Desde</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowFromPicker(true)}>
                            <Text style={styles.dateText}>{formatDate(fromDate)}</Text>
                        </TouchableOpacity>
                        {showFromPicker && (
                            isWeb ? (
                                <input
                                    type="date"
                                    defaultValue={formatDate(fromDate)}
                                    style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, marginTop: 4 }}
                                    onChange={(e) => { setShowFromPicker(false); if (e.target.value) setFromDate(new Date(e.target.value)); }}
                                    onBlur={() => setShowFromPicker(false)}
                                    autoFocus
                                />
                            ) : (
                                <DateTimePicker
                                    value={fromDate}
                                    mode="date"
                                    display={isIOS ? "inline" : "default"}
                                    onChange={(_, selected) => { setShowFromPicker(false); if (selected) setFromDate(selected); }}
                                />
                            )
                        )}
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.label}>Hasta</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowToPicker(true)}>
                            <Text style={styles.dateText}>{formatDate(toDate)}</Text>
                        </TouchableOpacity>
                        {showToPicker && (
                            isWeb ? (
                                <input
                                    type="date"
                                    defaultValue={formatDate(toDate)}
                                    style={{ padding: 8, borderRadius: 8, border: "1px solid #ccc", fontSize: 14, marginTop: 4 }}
                                    onChange={(e) => { setShowToPicker(false); if (e.target.value) setToDate(new Date(e.target.value)); }}
                                    onBlur={() => setShowToPicker(false)}
                                    autoFocus
                                />
                            ) : (
                                <DateTimePicker
                                    value={toDate}
                                    mode="date"
                                    display={isIOS ? "inline" : "default"}
                                    onChange={(_, selected) => { setShowToPicker(false); if (selected) setToDate(selected); }}
                                />
                            )
                        )}
                    </View>
                </View>

                {/* GroupBy */}
                <View style={styles.row}>
                    {["DAY", "WEEK", "MONTH"].map((g) => (
                        <Pressable
                            key={g}
                            style={[styles.groupBtn, groupBy === g && styles.groupBtnActive]}
                            onPress={() => setGroupBy(g)}
                        >
                            <Text style={[styles.groupBtnText, groupBy === g && styles.groupBtnTextActive]}>
                                {g === "DAY" ? "Día" : g === "WEEK" ? "Semana" : "Mes"}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#19b8b8" />}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {reportData && !loading && (
                    <>
                        {/* KPI cards */}
                        <View style={styles.cardsRow}>
                            <View style={[styles.card, { borderLeftColor: "#f0a500", alignItems: "center" }]}>
                                <StarRating rating={Math.round(reportData.average_rating || 0)} size={18} disabled />
                                <Text style={[styles.cardValue, { color: "#f0a500", fontSize: 20 }]}>
                                    {reportData.average_rating?.toFixed(1) ?? "—"}
                                </Text>
                                <Text style={styles.cardLabel}>Calificación promedio</Text>
                            </View>
                            <View style={[styles.card, { borderLeftColor: "#638888" }]}>
                                <Text style={[styles.cardValue, { color: "#638888" }]}>{reportData.total_feedback}</Text>
                                <Text style={styles.cardLabel}>Total de feedbacks</Text>
                            </View>
                        </View>

                        {/* Distribución de calificaciones (horizontal bars) */}
                        {reportData.star_distribution && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Distribución de calificaciones</Text>
                                {[5, 4, 3, 2, 1].map(star => {
                                    const count = reportData.star_distribution[star] || 0;
                                    const total = reportData.total_feedback || 1;
                                    const pct = Math.round((count / total) * 100);
                                    return (
                                        <View key={star} style={[styles.tableRow, { alignItems: "center" }]}>
                                            <Text style={[styles.tableCell, { width: 50, color: "#f0a500", fontSize: 13 }]}>{"★".repeat(star)}</Text>
                                            <View style={[styles.tableCell, { flex: 1 }]}>
                                                <View style={[styles.hBar, { width: `${pct}%`, backgroundColor: "#f0a500" }]} />
                                            </View>
                                            <Text style={[styles.tableCell, { width: 50, textAlign: "right", fontSize: 13 }]}>{count}</Text>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Aspectos más seleccionados (vertical bars) */}
                        {reportData.aspect_distribution && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Aspectos más seleccionados</Text>
                                <View style={styles.vChartContainer}>
                                    {ASPECT_ORDER.map(key => {
                                        const count = reportData.aspect_distribution[key] || 0;
                                        const heightPct = Math.round((count / aspectMax) * 100);
                                        return (
                                            <View key={key} style={styles.vBarColumn}>
                                                <Text style={styles.vBarCount}>{count}</Text>
                                                <View style={styles.vBarTrack}>
                                                    <View style={[styles.vBar, { height: `${heightPct}%`, backgroundColor: ASPECT_COLOR }]} />
                                                </View>
                                                <Text style={styles.vBarLabel}>{ASPECT_LABELS[key] || key}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            </View>
                        )}

                        {/* Evolución temporal */}
                        {reportData.time_series && reportData.time_series.length > 0 && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Evolución temporal</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View>
                                        <View style={styles.tableRow}>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 110 }]}>Período</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 110 }]}>Calif. promedio</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 80 }]}>Total</Text>
                                        </View>
                                        {reportData.time_series.map(point => (
                                            <View key={point.label} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { width: 110 }]}>{point.label}</Text>
                                                <Text style={[styles.tableCell, { width: 110 }]}>{point.avg_rating?.toFixed(1) ?? "—"} ★</Text>
                                                <View style={[styles.tableCell, { width: 80 }]}>
                                                    <Text style={styles.barValue}>{point.total}</Text>
                                                    <View style={[styles.hBar, { width: `${Math.round((point.total / Math.max(1, ...reportData.time_series.map(p => p.total))) * 100)}%`, backgroundColor: ASPECT_COLOR }]} />
                                                </View>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        {/* Comentarios */}
                        {commentsWithText.length > 0 && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Comentarios de usuarios</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View>
                                        <View style={styles.tableRow}>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 60 }]}>Calif.</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 150 }]}>Aspectos</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 100 }]}>Contexto</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 220 }]}>Comentario</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 100 }]}>Fecha</Text>
                                        </View>
                                        {commentsWithText.map(r => (
                                            <View key={r.id} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { width: 60, color: "#f0a500" }]}>{"★".repeat(r.star_rating || 0)}</Text>
                                                <Text style={[styles.tableCell, { width: 150, fontSize: 11 }]}>
                                                    {(r.aspects || []).map(a => ASPECT_LABELS[a] || a).join(", ") || "—"}
                                                </Text>
                                                <Text style={[styles.tableCell, { width: 100, fontSize: 11 }]}>{r.context || "—"}</Text>
                                                <Text style={[styles.tableCell, { width: 220, fontSize: 11 }]}>{r.comment}</Text>
                                                <Text style={[styles.tableCell, { width: 100, fontSize: 11 }]}>
                                                    {r.created_at ? new Date(r.created_at).toLocaleDateString("es-AR") : "—"}
                                                </Text>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            </View>
                        )}

                        {/* Exportar */}
                        <View style={styles.exportRow}>
                            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCsv}>
                                <Text style={styles.exportBtnText}>Exportar CSV</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.exportBtn, styles.exportBtnPdf]}
                                onPress={handleExportPdf}
                                disabled={exportingPdf}
                            >
                                {exportingPdf
                                    ? <ActivityIndicator color="white" size="small" />
                                    : <Text style={styles.exportBtnText}>Exportar PDF</Text>}
                            </TouchableOpacity>
                        </View>
                    </>
                )}

                {reportData && !loading && reportData.total_feedback === 0 && (
                    <Text style={styles.emptyText}>Sin feedback de usabilidad para el período seleccionado.</Text>
                )}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    content: { padding: 16, maxWidth: 800, alignSelf: "center", width: "100%" },
    backButton: { marginBottom: 8, alignSelf: 'flex-start' },
    backButtonText: { color: '#19b8b8', fontSize: 14, fontFamily: 'PlusJakartaSans-SemiBold' },
    title: {
        fontSize: 22,
        fontWeight: "bold",
        fontFamily: "PlusJakartaSans-Bold",
        marginBottom: 16,
        color: "#111818",
    },
    row: { flexDirection: "row", gap: 10, marginBottom: 12 },
    dateBlock: { flex: 1 },
    label: { fontSize: 13, color: "#638888", fontFamily: "PlusJakartaSans-Regular", marginBottom: 4 },
    dateButton: { backgroundColor: "#f0f4f4", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14 },
    dateText: { fontSize: 14, color: "#111818", fontFamily: "PlusJakartaSans-Regular" },
    groupBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, backgroundColor: "#f0f4f4", alignItems: "center" },
    groupBtnActive: { backgroundColor: "#19b8b8" },
    groupBtnText: { fontSize: 14, color: "#638888", fontFamily: "PlusJakartaSans-Regular" },
    groupBtnTextActive: { color: "#fff", fontFamily: "PlusJakartaSans-Bold" },
    cardsRow: { flexDirection: "row", gap: 10, marginBottom: 10 },
    card: {
        flex: 1,
        backgroundColor: "#f0f4f4",
        borderRadius: 12,
        padding: 14,
        borderLeftWidth: 4,
    },
    cardValue: { fontSize: 28, fontWeight: "bold", fontFamily: "PlusJakartaSans-Bold" },
    cardLabel: { fontSize: 12, color: "#638888", fontFamily: "PlusJakartaSans-Regular", marginTop: 2 },
    tableContainer: { marginTop: 16 },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        fontFamily: "PlusJakartaSans-Bold",
        color: "#111818",
        marginBottom: 8,
    },
    tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#e0e8e8", paddingVertical: 6 },
    tableCell: { paddingHorizontal: 6, justifyContent: "center" },
    tableHeader: { fontFamily: "PlusJakartaSans-Bold", fontSize: 13, color: "#111818" },
    hBar: { height: 6, borderRadius: 3, marginTop: 3, minWidth: 2 },
    barValue: { fontSize: 13, color: "#111818", fontFamily: "PlusJakartaSans-Regular" },
    // Vertical bar chart
    vChartContainer: {
        flexDirection: "row",
        alignItems: "flex-end",
        height: 160,
        gap: 8,
        paddingBottom: 4,
        marginTop: 4,
    },
    vBarColumn: {
        flex: 1,
        alignItems: "center",
        height: "100%",
        justifyContent: "flex-end",
    },
    vBarCount: {
        fontSize: 12,
        color: "#111818",
        fontFamily: "PlusJakartaSans-Regular",
        marginBottom: 2,
    },
    vBarTrack: {
        flex: 1,
        width: "60%",
        justifyContent: "flex-end",
    },
    vBar: {
        width: "100%",
        borderRadius: 4,
        minHeight: 2,
    },
    vBarLabel: {
        fontSize: 10,
        color: "#638888",
        fontFamily: "PlusJakartaSans-Regular",
        textAlign: "center",
        marginTop: 4,
        flexWrap: "wrap",
    },
    exportRow: { flexDirection: "row", gap: 10, marginTop: 12, marginBottom: 20 },
    exportBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: "#19b8b8",
        borderRadius: 10,
        alignSelf: "flex-start",
        minWidth: 130,
        alignItems: "center",
    },
    exportBtnPdf: { backgroundColor: "#b45309" },
    exportBtnText: { color: "white", fontFamily: "PlusJakartaSans-Regular", fontSize: 14 },
    emptyText: { color: "#638888", textAlign: "center", marginTop: 20, fontFamily: "PlusJakartaSans-Regular" },
    errorText: { color: "red", textAlign: "center", marginTop: 20 },
});

export default UsabilityFeedbackReport;
