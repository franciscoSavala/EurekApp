import React, { useState, useEffect } from "react";
import { View, StyleSheet } from "react-native";

function AchievementBar({ xp, currentLevelPoints, nextLevelPoints, color = "#76c7c0" }) {
    const [progress, setProgress] = useState(0);

    // Calcula el porcentaje de llenado
    const targetProgress = ((xp-currentLevelPoints) / (nextLevelPoints-currentLevelPoints)) * 100;

    useEffect(() => {
        let timeout;
        // Animación de llenado progresivo
        if (progress < targetProgress) {
            timeout = setTimeout(() => {
                setProgress((prev) => Math.min(prev + 1, targetProgress)); // Incrementa hasta targetProgress
            }, 3); // velocidad de la animación ajustable
        }
        return () => clearTimeout(timeout);
    }, [progress, targetProgress]);

    return (
        <View style={styles.container}>
            <View
                style={[
                    styles.progressBar,
                    { width: `${progress}%`, backgroundColor: color },
                ]}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        backgroundColor: '#e0e0df',
        borderRadius: 15,
        overflow: 'hidden',
        marginVertical: 4,
    },
    progressBar: {
        height: 20,
        borderRadius: 15,
    },
});

export default AchievementBar;