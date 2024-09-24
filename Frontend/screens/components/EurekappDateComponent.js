import {Pressable, Text, View, Platform} from "react-native";
import RNDateTimePicker from "@react-native-community/datetimepicker"; // Para móviles
import DatePicker from "react-datepicker"; // Para la web
import "react-datepicker/dist/react-datepicker.css"; // Estilos para el selector de la web
import React, {useState, useRef} from "react";
import Icon from "react-native-vector-icons/FontAwesome6";

const EurekappDateComponent = ({labelText, date, setDate}) => {
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openTime, setOpenTime] = useState(false);

    // Para la web: referencias para abrir los selectores manualmente
    const datePickerRef = useRef();
    const timePickerRef = useRef();

    const handleDateChange = (newDate) => {
        setDate(newDate);
    };

    return (
        <View style={styles.dateContainer}>
            <View>
                <Text style={{
                    color: '#111818',
                    fontSize: 16,
                    fontFamily: 'PlusJakartaSans-Regular'
                }}>{labelText}</Text>
            </View>
            <View style={{
                alignSelf: 'stretch',
                flexDirection: 'row',
                justifyContent: 'center'}}>

                {/* Botón para abrir el calendario */}
                <Pressable
                    onPress={() => {
                        if (Platform.OS === 'web') {
                            datePickerRef.current.setOpen(true); // Abrir calendario en web
                        } else {
                            setOpenCalendar(true); // Abrir calendario en móviles
                        }
                    }}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Icon style={{marginRight: 10}} name={'calendar'} size={20} color={'#000000'}/>
                        <Text style={styles.calendarButtonText}>
                            {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                        </Text>
                    </View>
                </Pressable>

                {/* Botón para abrir el selector de hora */}
                <Pressable
                    onPress={() => {
                        if (Platform.OS === 'web') {
                            timePickerRef.current.setOpen(true); // Abrir selector de hora en web
                        } else {
                            setOpenTime(true); // Abrir selector de hora en móviles
                        }
                    }}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Icon style={{marginRight: 10}} name={'clock'} size={20} color={'#000000'}/>
                        <Text style={styles.calendarButtonText}>
                            {date.toLocaleTimeString()}
                        </Text>
                    </View>
                </Pressable>
            </View>

            {Platform.OS === 'web' ? (
                <>
                    {/* Selector de fecha y hora para la web (escondido pero controlado por los botones) */}
                    <DatePicker
                        selected={date}
                        onChange={(date) => handleDateChange(date)}
                        dateFormat="dd/MM/yyyy"
                        showTimeSelect={false} // Solo calendario
                        ref={datePickerRef}
                        customInput={<div />} // Esconde el input propio de DatePicker
                    />

                    <DatePicker
                        selected={date}
                        onChange={(date) => handleDateChange(date)}
                        showTimeSelect
                        showTimeSelectOnly
                        timeIntervals={15} // Intervalos de 15 minutos
                        timeCaption="Hora"
                        dateFormat="h:mm aa"
                        ref={timePickerRef}
                        customInput={<div />} // Esconde el input propio de DatePicker
                    />
                </>
            ) : (
                // Selector de fecha y hora para móviles
                <>
                    {openCalendar ? (
                        <RNDateTimePicker
                            value={date}
                            maximumDate={new Date()}
                            onChange={(e, d) => {
                                setOpenCalendar(false);
                                if (d !== undefined) setDate(d);
                            }}
                        />
                    ) : null}

                    {openTime ? (
                        <RNDateTimePicker
                            is24Hour={true}
                            mode='time'
                            value={date}
                            maximumDate={new Date()}
                            onChange={(e, d) => {
                                setOpenTime(false);
                                if (d !== undefined) setDate(d);
                            }}
                        />
                    ) : null}
                </>
            )}
        </View>
    );
}

const styles = {
    calendarButtonContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 5,
        padding: 10,
        backgroundColor: '#f0f4f4',
        borderRadius: 12,
    },
    calendarButtonText: {
        fontFamily: 'PlusJakartaSans-Regular',
        justifySelf: 'center',
        fontSize: 16,
        paddingBottom: 2,
    },
    dateContainer: {
        alignSelf: 'stretch',
        marginVertical: 10,
    }
};

export default EurekappDateComponent;
