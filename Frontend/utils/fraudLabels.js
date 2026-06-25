// Rótulos de fraude en lenguaje llano (EU-288). Nunca se muestra "Caso 1/2/3": es jerga interna.
// El backend mantiene su propia copia de estos textos (FraudCaseType) para el mensaje de bloqueo y
// los exports CSV/PDF que genera él. Centralizado para que las pantallas no se desincronicen.

export const CASE_LABELS = {
    CASE_1: 'Retiros repetidos del mismo DNI',
    CASE_2: 'Posible acuerdo entre quien registra y quien retira',
    CASE_3: 'Posible complicidad de un empleado',
};

// Modelo de 2 estados: la alerta nace activa (bloquea) y solo puede pasar a falsa alarma (destraba).
export const STATUS_LABELS = {
    ACTIVE: 'Activa',
    FALSE_POSITIVE: 'Falsa alarma',
};

export const STATUS_COLORS = {
    ACTIVE: '#ED4337',
    FALSE_POSITIVE: '#008000',
};

// El motivo viene como tokens separados por coma ("CASE_1,CASE_3"); se muestra en lenguaje llano.
export function humanizeReason(reason) {
    if (!reason) return '';
    return reason.split(',')
        .map(s => s.trim())
        .filter(Boolean)
        .map(s => CASE_LABELS[s] || s)
        .join(' · ');
}
