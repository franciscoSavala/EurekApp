import React, { useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const formatHours = (h) => {
    if (h == null) return '—';
    if (h >= 24) return `${(h / 24).toFixed(1)} días`;
    return `${h.toFixed(1)} hs`;
};

const CHART_H = 130;
const DOT_R = 4;
const COLOR = '#7c4dff';

export default function RecoveryTimeChart({ data }) {
    const [containerWidth, setContainerWidth] = useState(0);

    const points = (data || []).filter(p => p.avg_recovery_hours > 0);
    if (points.length < 2) return null;

    const vals = points.map(p => p.avg_recovery_hours);
    const maxVal = Math.max(...vals);

    const xs = containerWidth > 0
        ? points.map((_, i) => (i / (points.length - 1)) * containerWidth)
        : [];
    const ys = vals.map(v => CHART_H - (v / maxVal) * CHART_H);

    const lines = containerWidth > 0
        ? points.slice(0, -1).map((_, i) => {
            const x1 = xs[i], y1 = ys[i], x2 = xs[i + 1], y2 = ys[i + 1];
            const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
            const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
            return { x1, y1, dist, angle };
        })
        : [];

    // Show at most 6 labels to avoid crowding
    const step = Math.ceil(points.length / 6);
    const labelIndices = points.map((_, i) => i).filter(i => i % step === 0 || i === points.length - 1);

    return (
        <View onLayout={e => setContainerWidth(e.nativeEvent.layout.width)}>
            <View style={{ height: CHART_H + 20, position: 'relative' }}>
                {/* Connecting lines */}
                {lines.map((l, i) => (
                    <View
                        key={i}
                        style={{
                            position: 'absolute',
                            left: l.x1,
                            top: l.y1,
                            width: l.dist,
                            height: 2,
                            backgroundColor: COLOR,
                            opacity: 0.7,
                            transform: [{ rotate: `${l.angle}deg` }],
                            transformOrigin: '0 50%',
                        }}
                    />
                ))}
                {/* Dots */}
                {xs.map((x, i) => (
                    <View
                        key={i}
                        style={{
                            position: 'absolute',
                            left: x - DOT_R,
                            top: ys[i] - DOT_R,
                            width: DOT_R * 2,
                            height: DOT_R * 2,
                            borderRadius: DOT_R,
                            backgroundColor: COLOR,
                        }}
                    />
                ))}
                {/* X-axis labels */}
                {labelIndices.map(i => (
                    <Text
                        key={i}
                        style={[styles.label, { position: 'absolute', left: xs[i] - 28, top: CHART_H + 4 }]}
                        numberOfLines={1}
                    >
                        {points[i].label}
                    </Text>
                ))}
            </View>
            {/* Y-axis reference: max value */}
            <Text style={[styles.label, { alignSelf: 'flex-end', marginTop: 4 }]}>
                máx: {formatHours(maxVal)}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    label: {
        fontSize: 10,
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        width: 56,
        textAlign: 'center',
    },
});
