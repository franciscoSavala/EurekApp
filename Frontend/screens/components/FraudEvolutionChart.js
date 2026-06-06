import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { TouchableOpacity } from 'react-native';

const CHART_H = 130;
const BAR_W = 14;
const BAR_GAP = 2;
const GROUP_GAP = 14;
const GROUP_W = BAR_W * 2 + BAR_GAP + GROUP_GAP;

const COLOR_CONFIRMED = '#ED4337';
const COLOR_PENDING = '#f59e0b';

const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

const GRANULARITIES = [
    { label: 'Día', value: 'day' },
    { label: 'Semana', value: 'week' },
    { label: 'Mes', value: 'month' },
];

function getISOWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getPeriodKey(date, granularity) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    if (granularity === 'day') return `${year}-${month}-${day}`;
    if (granularity === 'week') {
        const week = String(getISOWeek(date)).padStart(2, '0');
        return `${year}-S${week}`;
    }
    return `${year}-${month}`;
}

function getPeriodLabel(key, granularity) {
    if (granularity === 'day') {
        const [, month, day] = key.split('-');
        return `${day}/${month}`;
    }
    if (granularity === 'week') {
        const [year, weekPart] = key.split('-S');
        return `S${weekPart}/${String(year).slice(2)}`;
    }
    // month
    const [year, month] = key.split('-');
    return `${MONTH_SHORT[parseInt(month, 10) - 1]}/${String(year).slice(2)}`;
}

export default function FraudEvolutionChart({ entries }) {
    const [granularity, setGranularity] = useState('month');

    const groups = useMemo(() => {
        const allIncidents = (entries || []).flatMap(e => e.incidents || []);
        const map = {};
        for (const inc of allIncidents) {
            if (!inc.createdAt) continue;
            const status = inc.status;
            if (status !== 'CONFIRMED_FRAUD' && status !== 'PENDING') continue;
            const date = new Date(inc.createdAt);
            const key = getPeriodKey(date, granularity);
            if (!map[key]) map[key] = { key, label: getPeriodLabel(key, granularity), confirmed: 0, pending: 0 };
            if (status === 'CONFIRMED_FRAUD') map[key].confirmed++;
            else map[key].pending++;
        }
        return Object.values(map).sort((a, b) => a.key.localeCompare(b.key));
    }, [entries, granularity]);

    const maxVal = groups.length > 0 ? Math.max(...groups.map(g => g.confirmed + g.pending), 1) : 1;

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
                    <View style={[styles.legendDot, { backgroundColor: COLOR_CONFIRMED }]} />
                    <Text style={styles.legendText}>Confirmado</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: COLOR_PENDING }]} />
                    <Text style={styles.legendText}>En revisión</Text>
                </View>
            </View>

            {groups.length === 0 ? (
                <View style={styles.emptyBox}>
                    <Text style={styles.emptyText}>No hay datos para el período seleccionado</Text>
                </View>
            ) : (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scroll}>
                    <View style={styles.chartArea}>
                        {/* Bars */}
                        <View style={styles.barsRow}>
                            {groups.map(g => {
                                const hConfirmed = Math.round((g.confirmed / maxVal) * CHART_H);
                                const hPending = Math.round((g.pending / maxVal) * CHART_H);
                                return (
                                    <View key={g.key} style={[styles.group, { width: GROUP_W }]}>
                                        {/* Value labels */}
                                        <View style={[styles.valueLabelRow, { height: 14 }]}>
                                            <Text style={[styles.valueLabel, { width: BAR_W }]}>
                                                {g.confirmed > 0 ? g.confirmed : ''}
                                            </Text>
                                            <View style={{ width: BAR_GAP }} />
                                            <Text style={[styles.valueLabel, { width: BAR_W }]}>
                                                {g.pending > 0 ? g.pending : ''}
                                            </Text>
                                        </View>
                                        {/* Bar pair */}
                                        <View style={[styles.barPair, { height: CHART_H }]}>
                                            <View style={[styles.barConfirmed, { height: hConfirmed }]} />
                                            <View style={{ width: BAR_GAP }} />
                                            <View style={[styles.barPending, { height: hPending }]} />
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
    barConfirmed: {
        width: BAR_W,
        backgroundColor: COLOR_CONFIRMED,
        borderTopLeftRadius: 3,
        borderTopRightRadius: 3,
    },
    barPending: {
        width: BAR_W,
        backgroundColor: COLOR_PENDING,
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
