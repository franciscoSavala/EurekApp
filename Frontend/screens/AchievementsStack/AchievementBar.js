import React, { useState, useEffect } from "react";

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
        <div style={styles.container}>
            <div
                style={{
                    ...styles.progressBar,
                    width: `${progress}%`,
                    backgroundColor: color, // color de la barra
                }}
            />
        </div>
    );
}

const styles = {
    container: {
        margin: '0px',
        width: '100%',
        backgroundColor: '#e0e0df',
        borderRadius: '15px', // borde redondeado del contenedor
        overflow: 'hidden',
    },
    progressBar: {
        height: '20px',
        transition: 'width 0.3s ease-in-out', // transición suave para el llenado
        borderRadius: '15px', // borde redondeado de la barra
    },
};

export default AchievementBar;