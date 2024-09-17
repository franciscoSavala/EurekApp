import {Pressable, Text, View} from "react-native";
import RNDateTimePicker from "@react-native-community/datetimepicker";
import React, {useState} from "react";
import Icon from "react-native-vector-icons/FontAwesome6";

const EurekappDateComponent = ({labelText, date, setDate}) => {
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openTime, setOpenTime] = useState(false);

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
                <Pressable
                    onPress={() => setOpenCalendar(true)}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Icon style={{marginRight: 10}} name={'calendar'} size={20} color={'#000000'}/>
                        <Text style={styles.calendarButtonText}>
                            {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                        </Text>
                    </View>
                </Pressable>
                <Pressable
                    onPress={() => setOpenTime(true)}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Icon style={{marginRight: 10}} name={'clock'} size={20} color={'#000000'}/>
                        <Text style={styles.calendarButtonText}>
                            {date.toLocaleTimeString()}
                        </Text>
                    </View>
                </Pressable>
            </View>

            { openCalendar ?
                <RNDateTimePicker value={date}
                                  maximumDate={new Date()}
                                  onChange={(e, d) => {
                                      setOpenCalendar(false);
                                      if(d !== undefined) setDate(d);
                                  }} />
                : null
            }
            { openTime ?
                <RNDateTimePicker is24Hour={true} mode='time' value={date}
                                  maximumDate={new Date()}
                                  onChange={(e, d) => {
                                      setOpenTime(false);
                                      if(d !== undefined) setDate(d);
                                  }} />
                : null
            }
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
}
export default EurekappDateComponent;