export const formatDateES = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const formatDateTimeES = (date) => {
    const d = new Date(date);
    return `${formatDateES(d)} a las ${d.toLocaleTimeString()}`;
};

// Formato ISO para params de API: "2026-06-20"
export const formatDateISO = (date) => date.toISOString().split('T')[0];

// Fecha+hora en español para mostrar al usuario: "20/06/2026, 14:30"
export const formatDateTimeLocaleES = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
};
