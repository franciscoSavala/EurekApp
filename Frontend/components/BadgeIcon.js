import React from 'react';
import {Text, View} from "react-native";
import Icon from "react-native-vector-icons/FontAwesome6";

/* Los tres indicadores del menú (solicitudes de alta, notificaciones y alertas de fraude) se dibujan
 * igual: el mismo circulito rojo arriba a la derecha del ícono. Estaba escrito dos veces palabra por
 * palabra; con el tercero se vuelve uno solo. */
export const BadgeIcon = ({ name, count }) => (
    <View style={{ position: 'relative' }}>
        <Icon name={name} size={20} />
        {count > 0 && (
            <View style={{
                position: 'absolute', top: -5, right: -8,
                backgroundColor: '#CC4444', borderRadius: 8,
                minWidth: 16, height: 16,
                justifyContent: 'center', alignItems: 'center',
                paddingHorizontal: 2,
            }}>
                <Text style={{ color: '#FFF', fontSize: 9, fontWeight: 'bold' }}>
                    {count > 99 ? '99+' : count}
                </Text>
            </View>
        )}
    </View>
);
