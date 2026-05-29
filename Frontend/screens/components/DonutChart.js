import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Donut chart built with React Native Views — no external library.
 * Uses the two-half-circle rotation technique to render an arc for each segment.
 *
 * Props:
 *   recovered  {number}  Count of recovered objects
 *   total      {number}  Total found objects (must be > 0)
 *   size       {number}  Diameter of the donut (default 160)
 */
const DonutChart = ({ recovered, total, size = 160 }) => {
    const stroke = size * 0.18;
    const recoveredPct = Math.min(100, Math.max(0, Math.round((recovered / total) * 100)));
    const notRecoveredPct = 100 - recoveredPct;

    // Degrees for the recovered segment
    const deg = (recoveredPct / 100) * 360;

    return (
        <View style={styles.wrapper}>
            <View style={[styles.donutOuter, { width: size, height: size, borderRadius: size / 2 }]}>
                {/* Background ring (not recovered — red) */}
                <View style={[
                    styles.fill,
                    { width: size, height: size, borderRadius: size / 2, backgroundColor: '#e53935' },
                ]} />

                {/* Recovered segment using two half-circle clip technique */}
                <HalfArc deg={deg} size={size} color="#4caf50" />

                {/* Center hole */}
                <View style={[
                    styles.hole,
                    {
                        width: size - stroke * 2,
                        height: size - stroke * 2,
                        borderRadius: (size - stroke * 2) / 2,
                        top: stroke,
                        left: stroke,
                    },
                ]}>
                    <Text style={styles.centerPct}>{recoveredPct}%</Text>
                    <Text style={styles.centerLabel}>recuperados</Text>
                </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <LegendItem color="#4caf50" label="Recuperados" count={recovered} pct={recoveredPct} />
                <LegendItem color="#e53935" label="No recuperados" count={total - recovered} pct={notRecoveredPct} />
            </View>
        </View>
    );
};

/**
 * Renders the "recovered" arc over the background ring.
 * Uses two half-circles (left and right clip) to show 0-360° arcs.
 */
const HalfArc = ({ deg, size, color }) => {
    const half = size / 2;

    if (deg <= 0) return null;

    // When <= 180°: only show right half-circle rotated by deg
    if (deg <= 180) {
        return (
            <View style={[styles.halfClip, { width: half, height: size, left: half }]}>
                <View style={[
                    styles.halfCircle,
                    {
                        width: size,
                        height: size,
                        borderRadius: half,
                        backgroundColor: color,
                        transform: [{ rotate: `${deg - 180}deg` }],
                    },
                ]} />
            </View>
        );
    }

    // When > 180°: show full right half + partial left half rotated by (deg-180)
    return (
        <>
            {/* Right half fully filled */}
            <View style={[styles.halfClip, { width: half, height: size, left: half }]}>
                <View style={[
                    styles.halfCircle,
                    { width: size, height: size, borderRadius: half, backgroundColor: color },
                ]} />
            </View>
            {/* Left half rotated */}
            <View style={[styles.halfClip, { width: half, height: size, left: 0 }]}>
                <View style={[
                    styles.halfCircle,
                    {
                        width: size,
                        height: size,
                        borderRadius: half,
                        backgroundColor: color,
                        left: half,
                        transform: [{ rotate: `${deg - 180}deg` }],
                    },
                ]} />
            </View>
        </>
    );
};

const LegendItem = ({ color, label, count, pct }) => (
    <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={styles.legendText}>{label}: <Text style={{ fontWeight: 'bold' }}>{count}</Text> ({pct}%)</Text>
    </View>
);

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    donutOuter: {
        position: 'relative',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    fill: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    halfClip: {
        position: 'absolute',
        top: 0,
        overflow: 'hidden',
    },
    halfCircle: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    hole: {
        position: 'absolute',
        backgroundColor: '#ffffff',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    centerPct: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#111818',
        fontFamily: 'PlusJakartaSans-Bold',
    },
    centerLabel: {
        fontSize: 11,
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    legend: {
        marginTop: 16,
        gap: 8,
        alignItems: 'flex-start',
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    legendDot: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    legendText: {
        fontSize: 13,
        color: '#111818',
        fontFamily: 'PlusJakartaSans-Regular',
    },
});

export default DonutChart;
