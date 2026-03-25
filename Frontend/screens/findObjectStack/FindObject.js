import React, {useEffect, useState} from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    SafeAreaView,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import axios from "axios";
import Constants from "expo-constants";
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappDateComponent from "../components/EurekappDateComponent";
import {useFocusEffect} from "@react-navigation/native";
import MapViewComponent from "../components/MapViewComponent";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/FontAwesome6";

const CATEGORIES = [
    { value: 'ELECTRONICA', label: 'Electrónica' },
    { value: 'ROPA', label: 'Ropa' },
    { value: 'DOCUMENTOS', label: 'Documentos' },
    { value: 'LLAVES', label: 'Llaves' },
    { value: 'ACCESORIOS', label: 'Accesorios' },
    { value: 'OTROS', label: 'Otros' },
];


const BACK_URL = Constants.expoConfig.extra.backUrl;

const FindObject = ({ navigation, route }) => {
    const [selectedInstitute, setSelectedInstitution] = useState(null);
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [lostDate, setLostDate] = useState(() => {
        let curDate = new Date(Date.now() - (3 * 60 * 60 * 1000));
        curDate.setMinutes(0,0,0);
        return curDate;
    });
    const [objectMarker, setObjectMarker] = useState({
        latitude: -31.4124,
        longitude: -64.1867
    });
    const [showFilters, setShowFilters] = useState(false);
    const [filterCategory, setFilterCategory] = useState(null);
    const [filterColor, setFilterColor] = useState('');
    const [filterLostDateTo, setFilterLostDateTo] = useState(null);
    const [showDateToPicker, setShowDateToPicker] = useState(false);

    // Efecto que se ejecuta cuando la pantalla recibe el parámetro 'reset'
    useFocusEffect(
        React.useCallback(() => {
            if (route.params?.reset) {
                // Reseteamos todos los estados al recibir el parámetro 'reset'
                setSelectedInstitution(null);
                setQueryObjects("");
                setLoading(false);
                setButtonWasPressed(false);
                setLostDate(new Date());
                setFilterCategory(null);
                setFilterColor('');
                setFilterLostDateTo(null);
                setShowFilters(false);
            }
        }, [route.params?.reset]) // Dependencia en el parámetro 'reset'
    );

    const validateInputConstraints = () => {
        if (queryObjects.length > 255) {
            alert("La descripción del objeto es muy larga");
            console.log("La descripción del objeto es muy larga");
            return false;
        }
        return true;
    }

    const queryLostObject = async () => {
        if(!validateInputConstraints()) return;
        setLoading(true);
        setButtonWasPressed(true);
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            const effectiveQuery = filterColor
                ? `${filterColor} ${queryObjects}`.trim()
                : queryObjects;
            let config = {
                params: {
                    ...(effectiveQuery ? { query: effectiveQuery } : {}),
                    'lost_date': lostDate.toISOString().split('.')[0],
                },
                headers: {
                    'Authorization': authHeader
                }
            }
            if (filterCategory) config.params.category = filterCategory;
            if (filterLostDateTo) config.params.lost_date_to = filterLostDateTo.toISOString().split('.')[0];
            const routeParams = {
                query: queryObjects,
                lostDate: lostDate,
                organizationId: selectedInstitute ? selectedInstitute.id : null,
                filterCategory,
                filterColor,
                filterLostDateTo,
            }
            // Incluimos las coordenadas solo si se seleccionó una organización.
            if (!selectedInstitute) {
                config.params.latitude = objectMarker.latitude;  // Incluye latitud
                config.params.longitude = objectMarker.longitude; // Incluye longitud
                routeParams.longitude = objectMarker.longitude;
                routeParams.latitude = objectMarker.latitude;
            }
            let endpoint = '/found-objects' + (selectedInstitute ? `/organizations/${selectedInstitute.id}` : '');
            let res = await axios.get(BACK_URL + endpoint, //esto es inseguro pero ok...
                config );
            let jsonData = res.data;
            const foundObjects = jsonData.found_objects ?? [];
            routeParams.objectsFound = foundObjects;

            if(foundObjects.length === 0) {
                navigation.navigate('NotFoundObjects', routeParams);
            }else{
                navigation.navigate('FoundObjects', routeParams);
            }

        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.textDescriptionContainer}>
                    <Text style={styles.labelText}>Descripción del objeto (opcional):</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Proporciona detalles que ayuden a identificarlo"
                        multiline
                        onChangeText={(text) => setQueryObjects(text)}
                    />
                </View>
                <InstitutePicker setSelected={(institution) => setSelectedInstitution(institution)} />
                { selectedInstitute == null ? <MapViewComponent
                    objectMarker={objectMarker}
                    setObjectMarker={setObjectMarker}
                    markerIsDraggable={true}
                    labelText={"Ingresa la ubicación donde crees haberlo perdido: "}/>
                    :
                    null
                }
                <EurekappDateComponent labelText={'Fecha y hora en la que crees haberlo perdido: '}
                                       date={lostDate} setDate={setLostDate}/>

                {/* Filtros avanzados */}
                <TouchableOpacity style={styles.filterToggle} onPress={() => setShowFilters(!showFilters)}>
                    <Text style={styles.filterToggleText}>Filtros avanzados</Text>
                    <Icon name={showFilters ? 'chevron-up' : 'chevron-down'} size={14} color="#638888" />
                </TouchableOpacity>

                {showFilters && (
                    <View style={styles.filtersContainer}>
                        <Text style={styles.labelText}>Categoría:</Text>
                        <View style={styles.categoryRow}>
                            {CATEGORIES.map((cat) => (
                                <Pressable
                                    key={cat.value}
                                    style={[styles.categoryChip, filterCategory === cat.value && styles.categoryChipActive]}
                                    onPress={() => setFilterCategory(filterCategory === cat.value ? null : cat.value)}>
                                    <Text style={[styles.categoryChipText, filterCategory === cat.value && styles.categoryChipTextActive]}>
                                        {cat.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>

                        <Text style={styles.labelText}>Color (opcional):</Text>
                        <TextInput
                            style={styles.colorInput}
                            placeholder="Ej: rojo, azul oscuro..."
                            placeholderTextColor="#638888"
                            value={filterColor}
                            onChangeText={setFilterColor}
                        />

                        <Text style={styles.labelText}>Fecha límite de búsqueda (hasta):</Text>
                        <TouchableOpacity style={styles.dateButton} onPress={() => setShowDateToPicker(true)}>
                            <Text style={styles.dateButtonText}>
                                {filterLostDateTo ? filterLostDateTo.toISOString().split('T')[0] : 'Sin límite'}
                            </Text>
                        </TouchableOpacity>
                        {showDateToPicker && (
                            <DateTimePicker
                                value={filterLostDateTo || new Date()}
                                mode="date"
                                display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                onChange={(_, selected) => {
                                    setShowDateToPicker(false);
                                    if (selected) setFilterLostDateTo(selected);
                                }}
                            />
                        )}

                        <TouchableOpacity style={styles.clearFiltersButton}
                            onPress={() => { setFilterCategory(null); setFilterColor(''); setFilterLostDateTo(null); }}>
                            <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {buttonWasPressed ? (
                    loading ? <ActivityIndicator size="large" color="#111818" />: null
                ) : null
                }
            </ScrollView>
            <EurekappButton text="Buscar objeto" onPress={queryLostObject} />
            <EurekappButton
                text="Buscar por foto"
                onPress={() => navigation.navigate('SearchByPhoto')}
                backgroundColor={'#f0f4f4'}
                textColor={'#111818'}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff',
    },
    formContainer: {
        flexGrow: 1,
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingHorizontal: 10,
        maxWidth:'1000px',
        width: '100%',
        alignSelf:"center"
    },
    input: {
        width: '100%',
        height: 40,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 5,
        paddingLeft: 10,
        marginVertical: 10,
    },
    labelText: {
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    labelContainer: {
        width: '100%',
    },
    textAreaContainer: {
        flex: 1,
        alignSelf: 'stretch'
    },
    textArea: {
        minHeight: 144,
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
        marginBottom: 10,
    },
    textDescriptionContainer: {
        justifyContent: 'flex-start',
        alignSelf: 'stretch',
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        alignSelf: 'flex-start',
    },
    filterToggleText: {
        color: '#638888',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    filtersContainer: {
        alignSelf: 'stretch',
        backgroundColor: '#f0f4f4',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        gap: 8,
    },
    categoryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    categoryChip: {
        paddingVertical: 8,
        paddingHorizontal: 14,
        borderRadius: 20,
        backgroundColor: '#fff',
    },
    categoryChipActive: {
        backgroundColor: '#19b8b8',
    },
    categoryChipText: {
        fontSize: 13,
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    categoryChipTextActive: {
        color: '#fff',
        fontFamily: 'PlusJakartaSans-Bold',
    },
    colorInput: {
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontSize: 14,
        color: '#111818',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    dateButton: {
        backgroundColor: '#fff',
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    dateButtonText: {
        fontSize: 14,
        color: '#111818',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    clearFiltersButton: {
        alignSelf: 'flex-end',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: '#e0e8e8',
    },
    clearFiltersText: {
        fontSize: 13,
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
    },
});

export default FindObject;