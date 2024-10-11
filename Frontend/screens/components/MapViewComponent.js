import MapView, {Marker} from "react-native-maps";
import {Text, TextInput, View, StyleSheet, Platform} from "react-native";
import React, {useEffect, useRef, useState} from "react";
import { MapContainer, TileLayer, Marker as LeafletMarker } from 'react-leaflet';
import * as Location from "expo-location";
import alert from "react-native-web/src/exports/Alert";
import "leaflet/dist/leaflet.css";
import L from 'leaflet';

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
        getUserLocation(); //TODO: HABILITAR PARA OBTENER LA UBICACION DEL USUARIO
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
            const geocodedLocation = await Location.geocodeAsync(textLocation);
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

    const customMarkerIcon = L.icon({
        iconUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [25, 41],
        iconAnchor: [12, 41],
        popupAnchor: [1, -34],
        shadowSize: [41, 41]
    });

    return(
        <View style={[styles.mapContainer, style]}>
            <Text style={{
                color: '#111818',
                fontSize: 16,
                fontWeight: '500',
                fontFamily: 'PlusJakartaSans-Regular'
            }}>{labelText}</Text>
            <View style={styles.mapRounded}>
                {Platform.OS === 'web' ? (
                    // Mapa alternativo para web
                    <MapContainer style={styles.map} center={[mapRegion.latitude, mapRegion.longitude]} zoom={13} >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"/>
                        {objectMarker.longitude === Number.MAX_VALUE ? null :(
                            <LeafletMarker
                                position={[objectMarker.latitude, objectMarker.longitude]}
                                icon={customMarkerIcon}
                                draggable={true}
                                eventHandlers={{
                                    dragend: (event) => {
                                        const { lat, lng } = event.target.getLatLng();
                                        setObjectMarker({ latitude: lat, longitude: lng }); }, }}/> ) }
                    </MapContainer>
                ) : (
                    // Mapa para mobile
                    <MapView style={styles.map} initialRegion={mapRegion} ref={mapRef}>
                        { objectMarker.longitude === Number.MAX_VALUE ? (null) : (
                            <Marker draggable
                                    onDragEnd={(direction) =>
                                        setObjectMarker(direction.nativeEvent.coordinate)}
                                    description={'Tu objeto'}
                                    coordinate={objectMarker} />
                        )
                        }
                    </MapView>
                )}
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
        height: 400,
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