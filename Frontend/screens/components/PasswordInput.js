import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/FontAwesome6';

const EYE_COLOR = 'rgba(255,255,255,0.6)';

/**
 * EU-406: el ojo para mostrar y ocultar la contraseña.
 *
 * <p>Se exporta aparte del campo porque no todos los campos de contraseña del proyecto son el mismo
 * componente: el de registro es un `Input` de react-native-elements, que ubica su propio ícono a la
 * derecha, y el resto son `TextInput` pelados. Compartir el ojo —el mismo dibujo, el mismo tamaño y
 * el mismo texto para el lector de pantalla— es lo que hace que se comporten igual en todas
 * partes.</p>
 *
 * <p>El área sensible se agranda con `hitSlop`: el ícono es chico y queda pegado al borde del
 * campo, así que sin eso hay que apuntarle con precisión.</p>
 */
export const PasswordEye = ({ visible, onPress, style, color = EYE_COLOR }) => (
    <TouchableOpacity
        onPress={onPress}
        style={style}
        accessibilityRole="button"
        accessibilityLabel={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
        <Icon name={visible ? 'eye-slash' : 'eye'} size={18} color={color} />
    </TouchableOpacity>
);

/**
 * Campo de contraseña: un `TextInput` con el ojo encima de su borde derecho.
 *
 * <p>Arranca oculta y se alterna con el ojo. Lo escrito no lo toca nadie: el valor sigue viviendo
 * en la pantalla que usa el campo, y mostrar u ocultar sólo cambia cómo se dibuja.</p>
 *
 * <p>El estilo va partido en dos a propósito. `containerStyle` dice DÓNDE se ubica el campo (ancho y
 * márgenes) y `style` cómo se ve el texto. El ojo se para contra el borde derecho del contenedor,
 * así que si el ancho viajara en `style` el contenedor ocuparía toda la pantalla y el ojo terminaría
 * lejos del campo.</p>
 */
const PasswordInput = ({ containerStyle, style, eyeColor, ...props }) => {
    const [visible, setVisible] = useState(false);

    return (
        <View style={[styles.field, containerStyle]}>
            <TextInput
                {...props}
                secureTextEntry={!visible}
                style={[style, styles.input]}
            />
            <PasswordEye
                visible={visible}
                color={eyeColor}
                style={styles.eye}
                onPress={() => setVisible(!visible)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    field: { justifyContent: 'center' },
    // El hueco de la derecha es para que la contraseña no pase por debajo del ojo.
    input: { width: '100%', marginHorizontal: 0, paddingRight: 34 },
    eye: { position: 'absolute', right: 6, padding: 4 },
});

export default PasswordInput;
