import MapView, {Marker} from "react-native-maps";
import {Text, TextInput, View, StyleSheet} from "react-native";
import React, {useEffect, useRef, useState} from "react";
import * as Location from "expo-location";
import alert from "react-native-web/src/exports/Alert";

const MapViewComponent = ({objectMarker, setObjectMarker, labelText, style}) => {
    const [mapRegion, setMapRegion] = useState({
        latitude: -31.4124,
        longitude: -64.1867,
        latitudeDelta: 0.0422,
        longitudeDelta: 0.01521
    })
    const [textLocation, setTextLocation] = useState("");
    const [typingTimeout, setTypingTimeout] = useState(null);
    const mapRef = useRef(null);

    useEffect(() => {
        const getUserLocation = async () => {
            let { status } = await Location.requestForegroundPermissionsAsync();
            if (status !== 'granted') {
                alert('Permission to access location was denied');
                return;
            }
            let location = await Location.getCurrentPositionAsync({});
            setMapRegion({...mapRegion,
                longitude: location.coords.longitude,
                latitude: location.coords.latitude
            })
            setObjectMarker({...objectMarker,
                longitude: location.coords.longitude,
                latitude: location.coords.latitude
            })
        }
        getUserLocation();
    }, []);

    useEffect(() => {
        if (typingTimeout) {
            clearTimeout(typingTimeout);
        }

        // Iniciar un nuevo temporizador de 5 segundos
        const timeout = setTimeout(getLocationFromText, 5000);

        // Guardar el temporizador en el estado
        setTypingTimeout(timeout);

        // Limpiar el temporizador cuando el componente se desmonte
        return () => clearTimeout(timeout);
    }, [textLocation]);

    const getLocationFromText = async () => {
        if (textLocation) {
            let geocodedLocation;
            try {
                geocodedLocation = await Location.geocodeAsync(textLocation);
            } catch (error) {
                console.log(error);
            }
            const location = geocodedLocation.pop();
            const newRegion = {
                latitude: location.latitude,
                longitude: location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
            }
            setObjectMarker({latitude: location.latitude, longitude: location.longitude});
            if (mapRef.current) {
                mapRef.current.animateToRegion(newRegion, 1000);
            }
        }
    }

    return(
        <View style={styles.mapContainer}>
            <Text style={{
                color: '#111818',
                fontSize: 16,
                fontWeight: '500',
                fontFamily: 'PlusJakartaSans-Regular'
            }}>{labelText}</Text>
            <View style={styles.mapRounded}>
                <MapView style={styles.map}
                         initialRegion={mapRegion}
                         ref={mapRef} >
                    { objectMarker.longitude === Number.MAX_VALUE ? (null) : (
                        <Marker draggable
                                onDragEnd={(direction) =>
                                    setObjectMarker(direction.nativeEvent.coordinate)}
                                description={'Tu objeto'}
                                coordinate={objectMarker} />
                    )
                    }
                </MapView>
            </View>
            <TextInput
                style={styles.textArea}
                placeholder="Escribe la ubicación"
                onChangeText={(e) => setTextLocation(e)}
                onSubmitEditing={async (e) => {
                    clearTimeout(typingTimeout);
                    await getLocationFromText();
                }}/>
        </View>
    );
}

const styles = StyleSheet.create({
    map: {
        flex: 1,
    },
    mapContainer: {
        height: 300,
        width: '100%',
        marginVertical: 10,
    },
    mapRounded: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        marginVertical: 5,
    },
    textArea: {
        minHeight: 30,
        resize: 'none',
        overflow: 'hidden',
        borderRadius: 12,
        color: '#111818',
        backgroundColor: '#f0f4f4',
        padding: 16,
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        textAlignVertical: 'top',
        marginBottom: 10,
    },
})

export default MapViewComponent;