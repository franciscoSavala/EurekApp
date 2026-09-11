import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';
import { buildEvolutionGroups } from '../../utils/fraudEvolution';

const CHART_H = 130;
const BAR_W = 14;
const BAR_GAP = 2;
const GROUP_GAP = 14;
const GROUP_W = BAR_W * 2 + BAR_GAP + GROUP_GAP;

// Modelo de 2 estados (EU-288): activa (bloquea) vs falsa alarma (destraba).
const COLOR_ACTIVE = '#ED4337';
const COLOR_FALSE = '#008000';

const GRANULARITIES = [
    { label: 'Día', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
];

/* EU-395: la agrupación elegida acá también decide con qué barras sale el PDF, así que la puede
   manejar la pantalla. Sin esos props el componente sigue funcionando solo, como antes. */
export default function FraudEvolutionChart({ entries, fromDate, toDate, granularity: granularityProp, onGranularityChange }) {
    const [ownGranularity, setOwnGranularity] = useState('month');
    const granularity = granularityProp ?? ownGranularity;
    const setGranularity = onGranularityChange ?? setOwnGranularity;

    // El gráfico muestra sólo las alertas del rango consultado y cubre todos sus períodos, incluso
    // los que no tuvieron casos. El historial completo sigue disponible en el resto del reporte.
    const groups = useMemo(
        () => buildEvolutionGroups(entries, granularity, fromDate, toDate),
        [entries, granularity, fromDate, toDate]);

    // Con el eje completo siempre hay períodos dibujables: lo que decide si hay algo que mostrar es
    // que alguno tenga casos.
    const hasData = groups.some(g => g.active + g.falseAlarm > 0);

    const maxVal = groups.length > 0 ? Math.max(...groups.map(g => g.active + g.falseAlarm), 1) : 1;

    return (
        <View style={styles.wrapper}>
            {/* Granularity toggle */}
            <View style={styles.toggleRow}>
                {GRANULARITIES.map(g => (
                    <TouchableOpacity
                        key={g.value}
                        style={[styles.toggleBtn, granularity === g.value && styles.toggleBtnActive]}
                        onPress={() => setGranularity(g.value)}>
                        <Text style={[styles.toggleBtnText, granularity === g.value && styles.toggleBtnTextActive]}>
                            {g.label}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Legend */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLOR_ACTIVE }]} />
                    <Text style={styles.legendText}>Activa</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLOR_FALSE }]} />
                    <Text style={styles.legendText}>Falsa alarma</Text>
                </View>
            </View>

            {!hasData ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No hay datos para el período seleccionado</Text>
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
                    <View style={styles.chartArea}>
                        {/* Bars */}
                        <View style={styles.barsRow}>
                            {groups.map(g => {
                                const hActive = Math.round((g.active / maxVal) * CHART_H);
                                const hFalse = Math.round((g.falseAlarm / maxVal) * CHART_H);
                                return (
                                    <View key={g.key} style={[styles.group, { width: GROUP_W }]}>
                                        {/* Value labels */}
                                        <View style={[styles.valueLabelRow, { height: 14 }]}>
                                            <Text style={[styles.valueLabel, { width: BAR_W }]}>
                                                {g.active > 0 ? g.active : ''}
                                            </Text>
                                            <View style={{ width: BAR_GAP }} />
                                            <Text style={[styles.valueLabel, { width: BAR_W }]}>
                                                {g.falseAlarm > 0 ? g.falseAlarm : ''}
                                            </Text>
                                        </View>
                                        {/* Bar pair */}
                                        <View style={[styles.barPair, { height: CHART_H }]}>
                                            <View style={[styles.barActive, { height: hActive }]} />
                                            <View style={{ width: BAR_GAP }} />
                                            <View style={[styles.barFalse, { height: hFalse }]} />
                                        </View>
                                        {/* X label */}
                                        <Text style={styles.xLabel} numberOfLines={1}>{g.label}</Text>
                                    </View>
                                );
                            })}
                        </View>
                        {/* Baseline */}
                        <View style={styles.baseline} />
                    </View>
                </ScrollView>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrapper: {
        backgroundColor: '#f9fafb',
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
    },
    toggleRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    toggleBtn: {
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 20,
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    toggleBtnActive: {
        backgroundColor: '#1a3333',
        borderColor: '#1a3333',
    },
    toggleBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#1a3333',
    },
    toggleBtnTextActive: {
        color: '#fff',
    },
    legendRow: {
        flexDirection: 'row',
        gap: 14,
        marginBottom: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 2,
    },
    legendText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 11,
        color: '#555',
    },
    emptyBox: {
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
    },
    emptyText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#9ca3af',
        textAlign: 'center',
    },
    scroll: {
        flexGrow: 0,
    },
    chartArea: {
        paddingBottom: 4,
        paddingHorizontal: 2,
    },
    barsRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    group: {
        alignItems: 'center',
        marginRight: 0,
    },
    valueLabelRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-end',
    },
    valueLabel: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 9,
        color: '#555',
        textAlign: 'center',
    },
    barPair: {
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    barActive: {
        width: BAR_W,
        backgroundColor: COLOR_ACTIVE,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    barFalse: {
        width: BAR_W,
        backgroundColor: COLOR_FALSE,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    xLabel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 9,
        color: '#638888',
        width: GROUP_W - GROUP_GAP,
        textAlign: 'center',
        marginTop: 3,
    },
    baseline: {
        height: 1,
        backgroundColor: '#d1d5db',
        marginTop: 0,
    },
});
