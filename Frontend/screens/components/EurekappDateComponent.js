import {Pressable, Text, View} from "react-native";
import RNDateTimePicker from "@react-native-community/datetimepicker";
import React, {useState} from "react";

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
            <View style={{flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                <Text>El</Text>
                <Pressable
                    onPress={() => setOpenCalendar(true)}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Text style={styles.calendarButtonText}>
                            {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                        </Text>
                    </View>
                </Pressable>
                <Text>a las</Text>
                <Pressable
                    onPress={() => setOpenTime(true)}
                >
                    <View style={styles.calendarButtonContainer}>
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
        marginHorizontal: 5,
        padding: 10,
        backgroundColor: '#f0f4f4',
        borderRadius: 12,
    },
    calendarButtonText: {
        fontFamily: 'PlusJakartaSans-Regular',
    },
    dateContainer: {
        alignSelf: 'stretch',
        marginVertical: 10,
    }
}
export default EurekappDateComponent;