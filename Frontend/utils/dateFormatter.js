/**
 * EU-277: todas las horas se muestran en reloj de 0 a 23. Con 'es-AR' el navegador elige el reloj de
 * 12 horas y, en el formato por defecto, ni siquiera agrega "a. m." o "p. m.": las 15:10 salían como
 * "03:10:00", indistinguibles de las 3 de la madrugada.
 */
const H23 = { hourCycle: 'h23' };

export const formatDateES = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
};

export const formatDateTimeES = (date) => {
    const d = new Date(date);
    return `${formatDateES(d)} a las ${d.toLocaleTimeString('es-AR', H23)}`;
};

// Formato ISO para params de API: "2026-06-20"
export const formatDateISO = (date) => date.toISOString().split('T')[0];

// Fecha+hora en español para mostrar al usuario: "20/06/2026, 14:30"
export const formatDateTimeLocaleES = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit', ...H23,
    });
};

/**
 * EU-302: fecha sola, en español y con día y mes de dos dígitos: "20/06/2026".
 *
 * Ni `formatDateES`, que no rellena con ceros ("20/6/2026"), ni `formatDateTimeLocaleES`, que
 * además muestra la hora. Es el formato que venía usando por su cuenta el historial de búsquedas, y
 * al traerlo acá no cambia lo que se ve en esa pantalla.
 */
export const formatDateLocaleES = (isoString) => {
    if (!isoString) return '—';
    const d = new Date(isoString);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

/**
 * EU-277: fecha y hora con segundos, con la forma que venían mostrando las pantallas por su cuenta
 * ("25/7/2026, 15:10:00"), pero con la hora de 0 a 23. Reemplaza a los toLocaleString('es-AR')
 * sueltos, que mostraban la tarde como si fuera la madrugada.
 */
export const formatDateTimeAR = (date = new Date()) => new Date(date).toLocaleString('es-AR', H23);

/** EU-277: sólo la hora, de 0 a 23: "15:10:00". */
export const formatTimeAR = (date) => new Date(date).toLocaleTimeString('es-AR', H23);
