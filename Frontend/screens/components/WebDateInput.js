import React, { useRef } from 'react';
import { dateToCommit, toDateInputValue } from '../../utils/dateInput';

/**
 * EU-397: campo de fecha de la versión web, compartido por las pantallas que acotan por rango de
 * fechas (reporte de fraude, reporte de uso, opiniones sobre la app y la búsqueda de objetos).
 *
 * Antes cada pantalla cerraba el campo en cuanto el navegador avisaba de un cambio, y como ese aviso
 * llega tramo por tramo (día, mes, año), escribir la fecha a mano era imposible: al primer dígito el
 * campo desaparecía con el valor a medio escribir y el cambio se descartaba.
 *
 * Escribiéndola, el valor se guarda mientras se tipea y se confirma UNA sola vez al terminar: cuando
 * el foco se va o se aprieta Enter. No se confirma en cada aviso del navegador aunque la fecha ya
 * esté completa, porque un campo que arranca con una fecha cargada queda completo después de cada
 * tramo, y cada confirmación intermedia es una fecha que nadie pidió —en las pantallas que recargan
 * solas, una consulta al servidor por tramo—. Escape cierra sin confirmar.
 *
 * Eligiéndola del calendario del navegador, en cambio, se confirma en el momento: ahí la fecha que
 * llega ya es la definitiva —se eligió de una sola vez, no por tramos— y esperar a que el foco se
 * vaya haría que la pantalla siguiera mostrando la fecha anterior después de haber elegido otra. Los
 * dos casos se distinguen por si hubo teclas en el campo.
 *
 * @param value    fecha actual del filtro (puede ser null: el campo arranca vacío)
 * @param onChange se llama una vez por edición, sólo con una fecha completa y válida
 * @param onClose  cierra el campo
 */
const WebDateInput = ({ value, onChange, onClose }) => {
    const initialValue = value ? toDateInputValue(value) : '';
    const typedValue = useRef(initialValue);
    // Si hubo teclas, la fecha se está escribiendo por tramos y hay que esperar el final. Sin teclas,
    // el cambio vino del calendario y ya está completo.
    const usedKeyboard = useRef(false);

    const commit = () => {
        const date = dateToCommit(typedValue.current, initialValue);
        if (date) onChange(date);
    };

    return (
        <input
            type="date"
            defaultValue={initialValue}
            style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 14, marginTop: 4 }}
            onChange={(e) => {
                typedValue.current = e.target.value;
                if (!usedKeyboard.current) { commit(); onClose(); }
            }}
            onKeyDown={(e) => {
                usedKeyboard.current = true;
                if (e.key === 'Enter') { commit(); onClose(); }
                if (e.key === 'Escape') onClose();
            }}
            onBlur={() => { commit(); onClose(); }}
            autoFocus
        />
    );
};

export default WebDateInput;
