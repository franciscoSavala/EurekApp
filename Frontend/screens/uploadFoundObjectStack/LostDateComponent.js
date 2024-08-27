import {Pressable, Text, View} from "react-native";
import RNDateTimePicker from "@react-native-community/datetimepicker";
import React, {useState} from "react";

const LostDateComponent = ({foundDate, setFoundDate}) => {
    const [openCalendar, setOpenCalendar] = useState(false);
    const [openTime, setOpenTime] = useState(false);

    return (
        <View style={styles.dateContainer}>
            <View>
                <Text style={{fontFamily: 'PlusJakartaSans-Regular'}}>Fecha de pérdida del objeto: </Text>
            </View>
            <View style={{flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center'}}>
                <Text>El</Text>
                <Pressable
                    onPress={() => setOpenCalendar(true)}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Text style={styles.calendarButtonText}>
                            {foundDate.getDate()}/{foundDate.getMonth() + 1}/{foundDate.getFullYear()}
                        </Text>
                    </View>
                </Pressable>
                <Text>a las</Text>
                <Pressable
                    onPress={() => setOpenTime(true)}
                >
                    <View style={styles.calendarButtonContainer}>
                        <Text style={styles.calendarButtonText}>
                            {foundDate.toLocaleTimeString()}
                        </Text>
                    </View>
                </Pressable>
            </View>

            { openCalendar ?
                <RNDateTimePicker value={foundDate}
                                  maximumDate={new Date()}
                                  onChange={(e, d) => {
                                      setOpenCalendar(false);
                                      if(d !== undefined) setFoundDate(d);
                                  }} />
                : null
            }
            { openTime ?
                <RNDateTimePicker is24Hour={true} mode='time' value={foundDate}
                                  maximumDate={new Date()}
                                  onChange={(e, d) => {
                                      setOpenTime(false);
                                      if(d !== undefined) setFoundDate(d);
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
        flex: 1,
        alignSelf: 'stretch',
        marginBottom: 10,
    }
}
export default LostDateComponent;