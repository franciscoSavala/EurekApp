// Geometría de los gráficos circulares del PDF (EU-335).
//
// Vive acá y no dentro de pdfExport porque ese módulo importa de react-native y no se puede cargar en
// el jest del proyecto, que corre en entorno node. Con la matemática separada del armado del HTML, el
// cálculo de los sectores sí se puede probar.

const CX = 100;
const CY = 100;
const R = 80;

/**
 * Convierte una lista de segmentos {label, value, color} en los sectores de una torta.
 *
 * Devuelve `{ total, slices }`, donde cada sector suma el atributo `d` de su path y el `percent`
 * redondeado. Con el total en cero devuelve la lista vacía: no hay nada que graficar.
 */
export function buildPieSlices(segments) {
    const total = (segments || []).reduce((sum, seg) => sum + (seg.value || 0), 0);
    if (total === 0) return { total: 0, slices: [] };

    let angle = -Math.PI / 2; // arranca arriba, como se espera de una torta
    const slices = (segments || []).map(seg => {
        const frac = (seg.value || 0) / total;
        const d = frac >= 1 ? fullCirclePath() : slicePath(angle, frac * 2 * Math.PI);
        angle += frac * 2 * Math.PI;
        return { ...seg, d, percent: Math.round(frac * 100) };
    });

    return { total, slices };
}

function slicePath(startAngle, sweep) {
    const x1 = CX + R * Math.cos(startAngle);
    const y1 = CY + R * Math.sin(startAngle);
    const x2 = CX + R * Math.cos(startAngle + sweep);
    const y2 = CY + R * Math.sin(startAngle + sweep);
    const largeArc = sweep > Math.PI ? 1 : 0;
    return `M${CX},${CY} L${x1.toFixed(2)},${y1.toFixed(2)} `
        + `A${R},${R} 0 ${largeArc},1 ${x2.toFixed(2)},${y2.toFixed(2)} Z`;
}

/*
 * EU-335: un sector de 360 grados empieza y termina en el mismo punto, y un arco de SVG entre dos
 * puntos iguales no dibuja nada. Cuando una categoría se llevaba el 100% quedaba el <svg> vacío y al
 * lado la leyenda con los números, que es el síntoma reportado: "los gráficos no aparecen y
 * únicamente se visualizan los valores en formato texto".
 *
 * El círculo entero se arma con dos medias vueltas, que sí se dibujan.
 */
function fullCirclePath() {
    return `M${CX},${CY - R} A${R},${R} 0 1,1 ${CX},${CY + R} `
        + `A${R},${R} 0 1,1 ${CX},${CY - R} Z`;
}

export const PIE_VIEWBOX = `0 0 ${CX * 2} ${CY * 2}`;
