import React, { useState } from "react";
import { formatDateISO } from '../../utils/dateFormatter';
import { useFocusEffect } from "@react-navigation/native";
import Toast from 'react-native-toast-message';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { buildPrecisionReportHtml, exportPdf } from "../../utils/pdfExport";
import axiosInstance from "../../utils/axiosInstance";
import { exportCsv } from "../../utils/exportCsv";
import Constants from "expo-constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { isWeb, isIOS } from "../../utils/platform";
import DonutChart from "../components/DonutChart";
import WebDateInput from "../components/WebDateInput";
import ErrorRetry from "../components/ErrorRetry";

const BACK_URL = Constants.expoConfig.extra.backUrl;

/* EU-436: la precisión de las coincidencias (feedback de las búsquedas) la lee el administrador, de
   todas las organizaciones o de una. El responsable de organización ya no la ve en sus reportes. */
const SearchPrecisionReport = () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [fromDate, setFromDate] = useState(thirtyDaysAgo);
    const [toDate, setToDate] = useState(new Date());
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [groupBy, setGroupBy] = useState("DAY");
    const [wasFoundFilter, setWasFoundFilter] = useState(null); // null=todos, true=encontró, false=no encontró
    const [organizations, setOrganizations] = useState([]);
    const [organizationId, setOrganizationId] = useState(null); // null=todas
    const [feedbackData, setFeedbackData] = useState(null);
    const [feedbackRecords, setFeedbackRecords] = useState([]);
    const [loading, setLoading] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [error, setError] = useState(null);
    const [orgsError, setOrgsError] = useState(false);

    const fetchOrganizations = async () => {
        setOrgsError(false);
        try {
            const res = await axiosInstance.get(`${BACK_URL}/admin/organizations`);
            setOrganizations(res.data || []);
        } catch {
            setOrganizations([]);
            setOrgsError(true);
        }
    };

    const fetchFeedback = async () => {
        setLoading(true);
        setError(null);
        try {
            const base = {
                from: formatDateISO(fromDate),
                to: formatDateISO(toDate),
                ...(wasFoundFilter !== null && { wasFound: wasFoundFilter }),
                ...(organizationId !== null && { organizationId }),
            };
            const [fbRes, recRes] = await Promise.all([
                axiosInstance.get(`${BACK_URL}/feedback/report`, { params: { ...base, groupBy } }),
                axiosInstance.get(`${BACK_URL}/feedback/records`, { params: base }),
            ]);
            setFeedbackData(fbRes.data);
            setFeedbackRecords(recRes.data || []);
        } catch (e) {
            setFeedbackData(null);
            setFeedbackRecords([]);
            setError(e?.response?.status === 400 && e.response.data?.message
                ? e.response.data.message
                : "No se pudo cargar el reporte.");
        } finally {
            setLoading(false);
        }
    };

    const organizationName = organizationId === null
        ? 'Todas'
        : (organizations.find((o) => String(o.id) === String(organizationId))?.name || organizationId);

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const html = buildPrecisionReportHtml(feedbackData, feedbackRecords, {
                fromDate: formatDateISO(fromDate),
                toDate: formatDateISO(toDate),
                groupBy,
                wasFoundFilter,
                organizationName,
            });
            await exportPdf(html, `Reporte_Precision_${formatDateISO(new Date())}.pdf`);
        } catch (e) {
            console.warn('Error exportando PDF:', e);
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo exportar el PDF. Intentá nuevamente.' });
        } finally {
            setExportingPdf(false);
        }
    };

    const handleExportCsv = async () => {
        const wasFoundParam = wasFoundFilter !== null ? `&wasFound=${wasFoundFilter}` : '';
        const orgParam = organizationId !== null ? `&organizationId=${encodeURIComponent(organizationId)}` : '';
        const url = `${BACK_URL}/feedback/report/export?from=${formatDateISO(fromDate)}&to=${formatDateISO(toDate)}${wasFoundParam}${orgParam}`;
        await exportCsv({ url, fileName: "feedback-report.csv", dialogTitle: "Exportar reporte de feedback" });
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchOrganizations();
        }, [])
    );

    useFocusEffect(
        React.useCallback(() => {
            fetchFeedback();
        }, [fromDate, toDate, groupBy, wasFoundFilter, organizationId])
    );

    const dateBlock = (label, value, setValue, show, setShow) => (
        <View style={styles.dateBlock}>
            <Text style={styles.label}>{label}</Text>
            <TouchableOpacity style={styles.dateButton} onPress={() => setShow(true)}>
                <Text style={styles.dateText}>{formatDateISO(value)}</Text>
            </TouchableOpacity>
            {show && (
                isWeb ? (
                    <WebDateInput value={value} onChange={setValue} onClose={() => setShow(false)} />
                ) : (
                    <DateTimePicker
                        value={value}
                        mode="date"
                        display={isIOS ? "inline" : "default"}
                        onChange={(_, selected) => {
                            setShow(false);
                            if (selected) setValue(selected);
                        }}
                    />
                )
            )}
        </View>
    );

    const orgOptions = [{ id: null, name: 'Todas' }, ...organizations];

    return (
        <ScrollView style={styles.container}>
            <View style={styles.content}>
                <Text style={styles.title}>Feedback de búsquedas</Text>

                <View style={styles.row}>
                    {dateBlock('Desde', fromDate, setFromDate, showFromPicker, setShowFromPicker)}
                    {dateBlock('Hasta', toDate, setToDate, showToPicker, setShowToPicker)}
                </View>

                <View style={styles.groupingBlock}>
                    <Text style={styles.label}>Agrupar por:</Text>
                    <View style={[styles.row, { marginBottom: 8 }]}>
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
                </View>

                <View style={styles.groupingBlock}>
                    <Text style={styles.label}>Organización</Text>
                    {orgsError && <ErrorRetry message="No pudimos cargar las organizaciones. Intentá de nuevo." onRetry={fetchOrganizations} />}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                        {orgOptions.map((o) => {
                            const value = o.id === null ? null : String(o.id);
                            const activo = organizationId === value;
                            return (
                                <Pressable
                                    key={String(o.id)}
                                    style={[styles.groupBtn, styles.orgChip, activo && styles.groupBtnActive]}
                                    onPress={() => setOrganizationId(value)}
                                >
                                    <Text numberOfLines={1} style={[styles.groupBtnText, activo && styles.groupBtnTextActive]}>{o.name}</Text>
                                </Pressable>
                            );
                        })}
                    </ScrollView>
                </View>

                <View style={[styles.row, { marginBottom: 8 }]}>
                    {[
                        { label: 'Todos', value: null },
                        { label: 'Encontró objeto', value: true },
                        { label: 'No encontró', value: false },
                    ].map(({ label, value }) => (
                        <Pressable
                            key={String(value)}
                            style={[styles.groupBtn, wasFoundFilter === value && styles.groupBtnActive]}
                            onPress={() => setWasFoundFilter(value)}
                        >
                            <Text style={[styles.groupBtnText, wasFoundFilter === value && styles.groupBtnTextActive]}>
                                {label}
                            </Text>
                        </Pressable>
                    ))}
                </View>

                {loading && <ActivityIndicator style={{ marginTop: 20 }} color="#19b8b8" />}
                {error && (error === "No se pudo cargar el reporte."
                    ? <ErrorRetry message="No pudimos cargar el reporte. Intentá de nuevo." onRetry={fetchFeedback} />
                    : <Text style={styles.errorText}>{error}</Text>)}

                {!loading && feedbackData && (
                    <>
                        <View style={styles.cardsRow}>
                            <MetricCard label="Búsquedas registradas" value={feedbackData.total_feedback} color="#638888" />
                        </View>
                        <View style={styles.cardsRow}>
                            <MetricCard label="Búsquedas exitosas" value={feedbackData.successful_searches} color="#4caf50" />
                            <MetricCard label="Búsquedas fallidas" value={feedbackData.unsuccessful_searches} color="#e53935" />
                        </View>

                        <View style={styles.tableContainer}>
                            <Text style={styles.sectionTitle}>Precisión de coincidencias</Text>
                            <DonutChart
                                recovered={feedbackData.successful_searches || 0}
                                total={feedbackData.total_feedback || 0}
                                primaryColor="#4caf50"
                                secondaryColor="#e53935"
                                primaryLabel="Exitosas"
                                secondaryLabel="Fallidas"
                                centerLabel="exitosas"
                            />
                        </View>

                        {feedbackData.time_series && feedbackData.time_series.length > 0 && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Tendencias de búsquedas</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View>
                                        <View style={styles.tableRow}>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 110 }]}>Período</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 80 }]}>Exitosas</Text>
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 80 }]}>Fallidas</Text>
                                        </View>
                                        {feedbackData.time_series.map(point => (
                                            <View key={point.label} style={styles.tableRow}>
                                                <Text style={[styles.tableCell, { width: 110 }]}>{point.label}</Text>
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

                        <View style={styles.exportRow}>
                            <TouchableOpacity style={styles.exportBtn} onPress={handleExportCsv}>
                                <Text style={styles.exportBtnText}>Exportar CSV</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={[styles.exportBtn, styles.exportBtnPdf]} onPress={handleExportPdf} disabled={exportingPdf}>
                                {exportingPdf
                                    ? <ActivityIndicator color="white" size="small" />
                                    : <Text style={styles.exportBtnText}>Exportar PDF</Text>}
                            </TouchableOpacity>
                        </View>
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

export default SearchPrecisionReport;

const styles = StyleSheet.create({
    refreshBtn: {
        backgroundColor: "#19b8b8",
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 16,
        alignSelf: "flex-start",
        marginBottom: 12,
    },
    refreshBtnText: { color: "#fff", fontWeight: "600" },
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
    groupingBlock: {
        backgroundColor: "#f7fafa",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    groupingHint: {
        fontSize: 12,
        color: "#638888",
        fontFamily: "PlusJakartaSans-Regular",
    },
    groupBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: "#f0f4f4",
        alignItems: "center",
    },
    orgChip: {
        flexGrow: 0,
        flexShrink: 0,
        flexBasis: 'auto',
        paddingHorizontal: 14,
        marginRight: 8,
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
    commentRow: {
        paddingVertical: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#f0f4f4',
    },
    commentDate: {
        fontSize: 12,
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        marginBottom: 2,
    },
    commentText: {
        fontSize: 14,
        color: '#111818',
        fontFamily: 'PlusJakartaSans-Regular',
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
    exportRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 12,
        marginBottom: 20,
    },
    exportBtn: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        backgroundColor: '#19b8b8',
        borderRadius: 10,
        alignSelf: 'flex-start',
        minWidth: 130,
        alignItems: 'center',
    },
    exportBtnPdf: {
        backgroundColor: '#b45309',
    },
    exportBtnText: {
        color: 'white',
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
    },
    ratingAvgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
    },
    ratingAvgNumber: {
        fontSize: 22,
        fontFamily: 'PlusJakartaSans-Bold',
        color: '#f0a500',
    },
    ratingAvgLabel: {
        fontSize: 13,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#638888',
    },
    divider: {
        height: 1,
        backgroundColor: '#e0e8e8',
        marginBottom: 8,
    },
});

