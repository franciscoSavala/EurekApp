import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome6';

export default function StarRating({ rating = 0, onRate, size = 28, disabled = false }) {
    return (
        <View style={styles.row}>
            {[1, 2, 3, 4, 5].map(star => (
                <TouchableOpacity
                    key={star}
                    onPress={() => !disabled && onRate && onRate(star)}
                    disabled={disabled}
                    style={styles.star}
                >
                    <Icon
                        name={star <= rating ? 'star' : 'star'}
                        solid={star <= rating}
                        size={size}
                        color={star <= rating ? '#f0a500' : '#ccc'}
                    />
                </TouchableOpacity>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    row: {
        flexDirection: 'row',
        gap: 6,
    },
    star: {
        padding: 2,
    },
});
