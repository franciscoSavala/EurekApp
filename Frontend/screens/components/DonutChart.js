import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { EMPTY_COLOR } from '../../utils/pieChart';

/**
 * Donut chart built with react-native-svg — strokeDasharray technique.
 * Mathematically exact for any percentage, including 50/50.
 *
 * Props:
 *   recovered      {number}  Value of the primary segment
 *   total          {number}  Total (must be > 0)
 *   size           {number}  Diameter of the donut (default 160)
 *   primaryColor   {string}  Arc color (default green)
 *   secondaryColor {string}  Background ring color (default red)
 *   primaryLabel   {string}  Legend label for the primary segment
 *   secondaryLabel {string}  Legend label for the secondary segment
 *   centerLabel    {string}  Small text below the % in the center hole
 */
const DonutChart = ({
    recovered,
    total,
    size = 160,
    primaryColor = '#4caf50',
    secondaryColor = '#e53935',
    primaryLabel = 'Recuperados',
    secondaryLabel = 'No recuperados',
    centerLabel = 'recuperados',
}) => {
    const stroke = size * 0.18;
    const r = (size - stroke) / 2;
    const cx = size / 2;
    const cy = size / 2;
    const circumference = 2 * Math.PI * r;

    // EU-336: un período sin movimiento se dibuja igual, con el anillo en gris y la leyenda en cero.
    // Antes el anillo de fondo salía del color secundario, o sea un círculo rojo entero que se leía
    // como "todo mal" cuando en realidad no había nada que repartir. Y `notPct` daba 100, así que la
    // leyenda decía "No recuperados: 0 (100%)".
    const hasData = total > 0;
    const pct = hasData ? Math.min(100, Math.max(0, Math.round((recovered / total) * 100))) : 0;
    const notPct = hasData ? 100 - pct : 0;
    const ringColor = hasData ? secondaryColor : EMPTY_COLOR;
    const dashoffset = circumference * (1 - pct / 100);

    return (
        <View style={styles.wrapper}>
            <View style={{ width: size, height: size }}>
                {/* SVG rotated so arc starts from 12 o'clock */}
                <Svg
                    width={size}
                    height={size}
                    style={{ transform: [{ rotate: '-90deg' }] }}
                >
                    {/* Background ring (secondary color, full circle; gris si no hay datos) */}
                    <Circle
                        cx={cx}
                        cy={cy}
                        r={r}
                        stroke={ringColor}
                        strokeWidth={stroke}
                        fill="none"
                    />
                    {/* Primary arc */}
                    {pct > 0 && (
                        <Circle
                            cx={cx}
                            cy={cy}
                            r={r}
                            stroke={primaryColor}
                            strokeWidth={stroke}
                            fill="none"
                            strokeDasharray={circumference}
                            strokeDashoffset={dashoffset}
                            strokeLinecap="butt"
                        />
                    )}
                </Svg>

                {/* Center text overlay — NOT rotated */}
                <View style={[StyleSheet.absoluteFillObject, styles.centerOverlay]}>
                    <Text style={styles.centerPct}>{pct}%</Text>
                    <Text style={styles.centerLabel}>{centerLabel}</Text>
                </View>
            </View>

            {/* Legend */}
            <View style={styles.legend}>
                <LegendItem color={primaryColor} label={primaryLabel} count={recovered} pct={pct} />
                <LegendItem color={secondaryColor} label={secondaryLabel} count={total - recovered} pct={notPct} />
            </View>
        </View>
    );
};

const LegendItem = ({ color, label, count, pct }) => (
    <View style={styles.legendItem}>
        <View style={[styles.legendDot, { backgroundColor: color }]} />
        <Text style={styles.legendText}>
            {label}: <Text style={{ fontWeight: 'bold' }}>{count}</Text> ({pct}%)
        </Text>
    </View>
);

const styles = StyleSheet.create({
    wrapper: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    centerOverlay: {
        justifyContent: 'center',
        alignItems: 'center',
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
