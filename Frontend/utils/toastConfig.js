import React from 'react';
import { BaseToast } from 'react-native-toast-message';

// Los toasts que trae la librería recortan el texto a una sola línea
// (text1NumberOfLines = 1 + ellipsizeMode 'tail') y tienen alto fijo de 60px, así que
// los mensajes largos —como los de validación de Configuración de fraude— se ven
// cortados. Acá dejamos que el texto ocupe las líneas que necesite y que la caja
// crezca con él. Los colores del borde son los que usa cada toast por defecto.
const expandableToastStyle = { height: 'auto', minHeight: 60, paddingVertical: 10 };

const renderExpandableToast = (borderLeftColor) => (props) => (
    <BaseToast
        {...props}
        style={[expandableToastStyle, { borderLeftColor }]}
        text1NumberOfLines={0}
        text2NumberOfLines={0}
    />
);

export const toastConfig = {
    success: renderExpandableToast('#69C779'),
    error: renderExpandableToast('#FE6301'),
    info: renderExpandableToast('#87CEFA'),
};
