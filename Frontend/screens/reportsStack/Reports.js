import React, { useState } from "react";
import { formatDateISO } from '../../utils/dateFormatter';
import { useFocusEffect } from "@react-navigation/native";
import Toast from 'react-native-toast-message';
import {
    ActivityIndicator,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { buildUsageReportHtml, exportPdf } from "../../utils/pdfExport";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import DateTimePicker from "@react-native-community/datetimepicker";
import { isWeb, isIOS } from "../../utils/platform";
import DonutChart from "../components/DonutChart";
import RecoveryTimeChart, { formatHours } from "../components/RecoveryTimeChart";
import WebDateInput from "../components/WebDateInput";

const BACK_URL = Constants.expoConfig.extra.backUrl;


/* EU-375: los cinco aspectos con los que se califica la atencion, en el orden en que se muestran.
   Las claves son las que manda el backend. */
const ASPECT_LABELS = [
    { key: 'staff_treatment',      label: 'Trato del personal' },
    { key: 'waiting_time',         label: 'Tiempo de espera' },
    { key: 'instructions_clarity', label: 'Claridad de las indicaciones' },
    { key: 'object_condition',     label: 'Estado del objeto' },
    { key: 'pickup_security',      label: 'Seguridad del retiro' },
];

const Reports = ({ navigation }) => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [fromDate, setFromDate] = useState(thirtyDaysAgo);
    const [toDate, setToDate] = useState(new Date());
    // EU-449: las fechas elegidas no recalculan el reporte hasta tocar "Actualizar reporte".
    const [appliedRange, setAppliedRange] = useState({ from: thirtyDaysAgo, to: new Date() });
    const [showFromPicker, setShowFromPicker] = useState(false);
    const [showToPicker, setShowToPicker] = useState(false);
    const [groupBy, setGroupBy] = useState("DAY");
    const [data, setData] = useState(null);
    const [feedbackData, setFeedbackData] = useState(null);
    const [loadingMain, setLoadingMain] = useState(false);
    const [loadingFeedback, setLoadingFeedback] = useState(false);
    const [exportingPdf, setExportingPdf] = useState(false);
    const [error, setError] = useState(null);

    const fetchMainReport = async () => {
        setLoadingMain(true);
        setError(null);
        try {
            const params = { from: formatDateISO(appliedRange.from), to: formatDateISO(appliedRange.to), groupBy };
            const res = await axiosInstance.get(`${BACK_URL}/reports`, { params });
            setData(res.data);
        } catch (e) {
            // EU-431: con el rango invertido el servidor responde 400 con el motivo; no se muestran datos viejos.
            setData(null);
            setError(e?.response?.status === 400 && e.response.data?.message
                ? e.response.data.message
                : "No se pudieron cargar los reportes.");
            if (e?.response?.status !== 400) console.error(e);
        } finally {
            setLoadingMain(false);
        }
    };

    // EU-436: la precisión de las coincidencias pasó al administrador; el dueño conserva la calificación
    // de la atención y los comentarios.
    const fetchFeedback = async () => {
        setLoadingFeedback(true);
        try {
            const params = { from: formatDateISO(appliedRange.from), to: formatDateISO(appliedRange.to), groupBy };
            const fbRes = await axiosInstance.get(`${BACK_URL}/feedback/report`, { params });
            setFeedbackData(fbRes.data);
        } catch {
            setFeedbackData(null);
        } finally {
            setLoadingFeedback(false);
        }
    };

    const handleExportPdf = async () => {
        setExportingPdf(true);
        try {
            const html = buildUsageReportHtml(data, feedbackData, {
                fromDate: formatDateISO(appliedRange.from),
                toDate: formatDateISO(appliedRange.to),
                groupBy,
            });
            await exportPdf(html, `Reporte_Uso_${formatDateISO(new Date())}.pdf`);
        } catch (e) {
            console.warn('Error exportando PDF:', e);
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo exportar el PDF. Intentá nuevamente.' });
        } finally {
            setExportingPdf(false);
        }
    };

    useFocusEffect(
        React.useCallback(() => {
            fetchMainReport();
            fetchFeedback();
        }, [appliedRange, groupBy])
    );

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
                            <Text style={styles.dateText}>{formatDateISO(fromDate)}</Text>
                        </TouchableOpacity>
                        {showFromPicker && (
                            isWeb ? (
                                <WebDateInput
                                    value={fromDate}
                                    onChange={setFromDate}
                                    onClose={() => setShowFromPicker(false)} />
                            ) : (
                                <DateTimePicker
                                    value={fromDate}
                                    mode="date"
                                    display={isIOS ? "inline" : "default"}
                                    onChange={(_, selected) => {
                                        setShowFromPicker(false);
                                        if (selected) setFromDate(selected);
                                    }}
                                />
                            )
                        )}
                    </View>
                    <View style={styles.dateBlock}>
                        <Text style={styles.label}>Hasta</Text>
                        <TouchableOpacity
                            style={styles.dateButton}
                            onPress={() => setShowToPicker(true)}
                        >
                            <Text style={styles.dateText}>{formatDateISO(toDate)}</Text>
                        </TouchableOpacity>
                        {showToPicker && (
                            isWeb ? (
                                <WebDateInput
                                    value={toDate}
                                    onChange={setToDate}
                                    onClose={() => setShowToPicker(false)} />
                            ) : (
                                <DateTimePicker
                                    value={toDate}
                                    mode="date"
                                    display={isIOS ? "inline" : "default"}
                                    onChange={(_, selected) => {
                                        setShowToPicker(false);
                                        if (selected) setToDate(selected);
                                    }}
                                />
                            )
                        )}
                    </View>
                </View>

                <TouchableOpacity
                    style={styles.refreshBtn}
                    onPress={() => setAppliedRange({ from: fromDate, to: toDate })}
                    testID="reports-refresh"
                    accessibilityLabel="Actualizar reporte"
                >
                    <Text style={styles.refreshBtnText}>Actualizar reporte</Text>
                </TouchableOpacity>

                {/* EU-407: estos botones estaban pegados a las fechas y se leían como atajos de
                    período. No cambian el período consultado: sólo cómo se agrupan los cuadros de
                    evolución. Acá quedan aparte, rotulados y con la aclaración. Son uno solo para
                    los tres cuadros que agrupan, así que no se repiten dentro de cada uno. */}
                <View style={styles.groupingBlock}>
                    <Text style={styles.label}>Agrupar por:</Text>
                    <View style={[styles.row, { marginBottom: 8 }]}>
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
                    <Text style={styles.groupingHint}>
                        Sólo cambia cómo se agrupan los cuadros de evolución. El período lo eligen las fechas.
                    </Text>
                </View>

                {loadingMain && <ActivityIndicator style={{ marginTop: 20 }} color="#19b8b8" />}
                {error && <Text style={styles.errorText}>{error}</Text>}

                {data && (
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

                        {/* Gráfico de recuperación de objetos.
                            EU-336: se muestra aunque el período no tenga objetos. Antes la sección
                            desaparecía y no se distinguía "no hubo movimiento" de "esta pantalla no
                            tiene este gráfico". */}
                        <View style={styles.tableContainer}>
                            <Text style={styles.sectionTitle}>Tasa de recuperación</Text>
                            <DonutChart
                                recovered={data.returned_objects || 0}
                                total={data.found_objects || 0}
                            />
                        </View>

                        {/* Objetos más reportados por categoría */}
                        {data.top_categories && data.top_categories.length > 0 && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Objetos más reportados</Text>
                                {data.top_categories.map((item) => {
                                    const maxCount = data.top_categories[0].count;
                                    const pct = Math.round((item.count / maxCount) * 100);
                                    return (
                                        <View key={item.category} style={[styles.tableRow, { alignItems: 'center' }]}>
                                            <Text style={[styles.tableCell, { width: 110 }]} numberOfLines={1}>{item.category}</Text>
                                            <View style={[styles.tableCell, { flex: 1 }]}>
                                                <Text style={styles.barValue}>{item.count}</Text>
                                                <View style={[styles.bar, { width: `${pct}%`, backgroundColor: '#19b8b8', minWidth: 2 }]} />
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        )}

                        {/* Tiempo promedio de recuperación — KPI */}
                        {data.avg_recovery_hours != null && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Tiempo promedio de recuperación</Text>
                                <View style={[styles.card, { borderLeftColor: '#7c4dff' }]}>
                                    <Text style={styles.cardLabel}>Promedio</Text>
                                    <Text style={[styles.cardValue, { color: '#7c4dff' }]}>{formatHours(data.avg_recovery_hours)}</Text>
                                    <View style={{ flexDirection: 'row', marginTop: 8, gap: 16 }}>
                                        <Text style={styles.cardLabel}>mínimo: {formatHours(data.min_recovery_hours)}</Text>
                                        <Text style={styles.cardLabel}>máximo: {formatHours(data.max_recovery_hours)}</Text>
                                    </View>
                                </View>
                            </View>
                        )}

                        {/* Tiempo promedio de recuperación — Gráfico de líneas */}
                        {data.time_series && data.time_series.some(p => p.avg_recovery_hours > 0) && (
                            <View style={styles.tableContainer}>
                                <Text style={styles.sectionTitle}>Evolución del tiempo de recuperación</Text>
                                <RecoveryTimeChart data={data.time_series} />
                            </View>
                        )}

                        {/* Sección de feedback (solo para ORGANIZATION_OWNER) */}
                        {loadingFeedback && <ActivityIndicator style={{ marginTop: 20 }} color="#19b8b8" />}
                        {!loadingFeedback && feedbackData && (
                            <>
                                <View style={styles.cardsRow}>
                                    <MetricCard label="Atenciones calificadas" value={feedbackData.total_ratings} color="#f0a500" />
                                </View>

                                {/* EU-375: promedio POR ASPECTO de las calificaciones que la gente
                                    deja despues de retirar su objeto. Antes aca vivia la distribucion
                                    de estrellas de la pantalla de resultados, que se respondia antes
                                    de pisar la organizacion. Un promedio unico avisa que algo anda
                                    mal; estos cinco dicen que corregir. */}
                                <View style={styles.tableContainer}>
                                    <Text style={styles.sectionTitle}>Calificación de la atención</Text>
                                    {feedbackData.total_ratings > 0 ? (
                                        ASPECT_LABELS.map(({ key, label }) => {
                                            const value = feedbackData.aspect_averages?.[key] || 0;
                                            return (
                                                <View key={key} style={[styles.tableRow, { alignItems: 'center' }]}>
                                                    <Text style={[styles.tableCell, { width: 190 }]}>{label}</Text>
                                                    <View style={[styles.tableCell, { flex: 1 }]}>
                                                        <View style={[styles.bar, { width: `${(value / 5) * 100}%`, backgroundColor: '#f0a500', minWidth: 2 }]} />
                                                    </View>
                                                    <Text style={[styles.tableCell, { width: 50, textAlign: 'right' }]}>
                                                        {value ? value.toFixed(1) : '—'}
                                                    </Text>
                                                </View>
                                            );
                                        })
                                    ) : (
                                        <Text style={styles.emptyText}>
                                            Todavía nadie calificó la atención en el período seleccionado.
                                        </Text>
                                    )}
                                </View>

                                {/* Comentarios libres de quienes retiraron su objeto. */}
                                {feedbackData.comments && feedbackData.comments.length > 0 && (
                                    <View style={styles.tableContainer}>
                                        <Text style={styles.sectionTitle}>Comentarios</Text>
                                        {feedbackData.comments.map((c, idx) => (
                                            <View key={idx} style={styles.commentRow}>
                                                <Text style={styles.commentDate}>
                                                    {c.created_at ? formatDateISO(new Date(c.created_at)) : ''}
                                                </Text>
                                                <Text style={styles.commentText}>{c.comment}</Text>
                                            </View>
                                        ))}
                                    </View>
                                )}

                                {/* Botones de exportación */}
                                <View style={styles.exportRow}>
                                    <TouchableOpacity style={[styles.exportBtn, styles.exportBtnPdf]} onPress={handleExportPdf} disabled={exportingPdf}>
                                        {exportingPdf
                                            ? <ActivityIndicator color="white" size="small" />
                                            : <Text style={styles.exportBtnText}>Exportar PDF</Text>}
                                    </TouchableOpacity>
                                </View>
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
                                            <Text style={[styles.tableCell, styles.tableHeader, { width: 90 }]}>T. Recup.</Text>
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
                                                <View style={[styles.tableCell, { width: 90 }]}>
                                                    <Text style={styles.barValue}>{point.avg_recovery_hours > 0 ? formatHours(point.avg_recovery_hours) : '—'}</Text>
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

export default Reports;
