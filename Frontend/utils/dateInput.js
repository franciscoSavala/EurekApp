/**
 * EU-397: lectura y escritura del campo de fecha de la web (`input type="date"`).
 *
 * El navegador avisa de cada cambio tecla por tecla, y mientras la fecha está incompleta manda el
 * valor vacío. Por eso hace falta distinguir "todavía está escribiendo" de "la fecha está lista":
 * sólo en el segundo caso se toma el valor.
 *
 * Las fechas de los filtros se manejan en UTC de punta a punta —se muestran y se envían al servidor
 * con `toISOString()`—, así que también se interpretan como UTC al leerlas. Interpretarlas en la zona
 * horaria local correría un día la fecha que se ve respecto de la que se eligió.
 */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Fecha -> el texto `aaaa-mm-dd` que espera el campo. */
export const toDateInputValue = (date) => date.toISOString().split('T')[0];

/**
 * Texto del campo -> Fecha, o `null` si todavía no hay una fecha completa y válida (campo vacío,
 * fecha a medio escribir, o un día que no existe como el 31 de febrero).
 */
export const parseDateInputValue = (value) => {
    if (!value || !ISO_DATE.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime())) return null;
    // El 31/02 no es inválido para el constructor: lo corre al 3/03. Se descarta comparando.
    return toDateInputValue(date) === value ? date : null;
};

/**
 * La fecha que hay que confirmar al terminar de editar el campo, o `null` si no hay nada que
 * confirmar: quedó a medio escribir, no existe, o es la misma que ya tenía el filtro.
 *
 * Devolver `null` cuando no cambió nada es lo que evita recargar un reporte por una edición que
 * terminó en la fecha de siempre (EU-397).
 */
export const dateToCommit = (typedValue, initialValue) => {
    if (typedValue === initialValue) return null;
    return parseDateInputValue(typedValue);
};

/**
 * EU-400: ¿el aviso del calendario es un día elegido, o sólo el paso de un mes a otro con las
 * flechas?
 *
 * El navegador avisa igual en los dos casos, pero el valor los distingue: las flechas conservan el
 * día y corren el mes (25/09 -> 25/10, y también el año al cruzar diciembre), mientras que elegir un
 * día cambia el día dentro del mes que se está mirando. Por eso se toma por elección únicamente el
 * cambio que deja el mes y el año donde estaban.
 *
 * Mirar el mes en lugar del día es además lo que cubre el recorte de fin de mes: yendo del 31/01 a
 * febrero el navegador manda 28/02, que con un criterio basado en el día parecería una elección.
 *
 * Un campo que arrancó vacío no tiene mes del que salir: ahí el primer valor completo es siempre una
 * elección.
 */
export const isDaySelection = (previousValue, newValue) => {
    const chosen = parseDateInputValue(newValue);
    if (!chosen) return false;
    const previous = parseDateInputValue(previousValue);
    if (!previous) return true;
    return previous.getUTCFullYear() === chosen.getUTCFullYear()
        && previous.getUTCMonth() === chosen.getUTCMonth();
};
