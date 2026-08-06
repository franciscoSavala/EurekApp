import React, {useEffect, useState} from "react";
import Toast from 'react-native-toast-message';
import {
    ActivityIndicator,
    Image,
    ImageBackground,
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
import Constants from "expo-constants";
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from 'buffer';
import EurekappButton from "../components/Button";
import InstitutePicker from "../components/InstitutePicker";
import useAuthFetch from "../../utils/useAuthFetch";
import { fetchWithAuth, blobFetchWithAuth } from "../../utils/fetchWithAuth";
import { isWeb } from "../../utils/platform";
import { colors } from "../../styles/globalStyles";
import EurekappDateComponent from "../components/EurekappDateComponent";
import {useFocusEffect} from "@react-navigation/native";
import MapViewComponent from "../components/MapViewComponent";
import DateTimePicker from "@react-native-community/datetimepicker";
import Icon from "react-native-vector-icons/FontAwesome6";


const BACK_URL = Constants.expoConfig.extra.backUrl;
const THREE_HOURS_MS = 3 * 60 * 60 * 1000;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'];
const MAX_SIZE_MB = 5;

const FormData = global.FormData;

const toLocalISO = (date) => {
    const pad = n => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

const FindObject = ({ navigation, route }) => {
    const { authFetch } = useAuthFetch();
    const [selectedInstitute, setSelectedInstitution] = useState(null);
    const [queryObjects, setQueryObjects] = useState("");
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed] = useState(false);
    const [lostDate, setLostDate] = useState(() => {
        let curDate = new Date(Date.now() - THREE_HOURS_MS);
        curDate.setMinutes(0,0,0);
        return curDate;
    });
    const [objectMarker, setObjectMarker] = useState({
        latitude: -31.4124,
        longitude: -64.1867
    });
    const [showFilters, setShowFilters] = useState(false);
    const [filterColor, setFilterColor] = useState('');
    const [filterLostDateTo, setFilterLostDateTo] = useState(null);
    const [showDateToPicker, setShowDateToPicker] = useState(false);
    // EU-326: la foto es OPCIONAL y decide a qué búsqueda se pega (con foto: imagen+texto; sin foto: texto).
    const [image, setImage] = useState(null);

    useFocusEffect(
        React.useCallback(() => {
            setSelectedInstitution(null);
            setQueryObjects("");
            setLoading(false);
            setButtonWasPressed(false);
            setLostDate(new Date(Date.now() - THREE_HOURS_MS));
            setFilterColor('');
            setFilterLostDateTo(null);
            setShowFilters(false);
            setImage(null);
        }, [])
    );

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            base64: true,
            aspect: [1, 1],
            quality: 1,
        });
        if (result.canceled) return;
        const asset = result.assets[0];
        if (!ALLOWED_MIME_TYPES.includes(asset.mimeType)) {
            Toast.show({ type: 'error', text1: 'Formato no permitido', text2: 'Solo se permiten imágenes .jpg, .jpeg o .png' });
            return;
        }
        const bytes = Buffer.from(asset.base64, 'base64');
        if (bytes.length / 1024 / 1024 > MAX_SIZE_MB) {
            Toast.show({ type: 'error', text1: 'Imagen muy grande', text2: `La foto no debe superar los ${MAX_SIZE_MB} MB` });
            return;
        }
        setImage(asset);
    };

    const validateInputConstraints = () => {
        // EU-326: el texto es SIEMPRE obligatorio (es la señal que más aporta; la foto sola no alcanza).
        if (!queryObjects.trim()) {
            Toast.show({ type: 'error', text1: 'Falta la descripción', text2: 'Contanos qué objeto perdiste, aunque sean dos palabras ("mochila azul").' });
            return false;
        }
        if (queryObjects.length > 255) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'La descripción del objeto es muy larga' });
            return false;
        }
        return true;
    }

    /** Búsqueda CON foto: imagen + texto (POST multipart). La categoría la decide la IA desde la foto. */
    const searchWithPhoto = async (routeParams) => {
        const orgId = selectedInstitute ? selectedInstitute.id : null;
        const queryParams = new URLSearchParams({ query: routeParams.query });
        if (orgId) queryParams.append('organizationId', orgId);
        queryParams.append('lostDate', toLocalISO(lostDate));
        if (filterLostDateTo) queryParams.append('lostDateTo', toLocalISO(filterLostDateTo));
        if (!orgId) {
            queryParams.append('latitude', objectMarker.latitude);
            queryParams.append('longitude', objectMarker.longitude);
        }
        const url = `${BACK_URL}/found-objects/search-by-photo?${queryParams.toString()}`;

        if (isWeb) {
            const formData = new FormData();
            formData.append('file', new Blob([Buffer.from(image.base64, 'base64')]), 'search_photo.jpg');
            const response = await fetchWithAuth(url, { method: 'POST', body: formData });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        }
        const response = await blobFetchWithAuth(
            'POST',
            url,
            { 'Content-Type': 'multipart/form-data' },
            [{ name: 'file', filename: 'search_photo.jpg', type: image.mimeType || 'image/jpeg',
               data: 'RNFetchBlob-base64://' + String(image.base64) }]
        );
        const status = response.info().status;
        if (status < 200 || status >= 300) throw new Error(`HTTP ${status}`);
        return response.json();
    };

    /** Búsqueda SIN foto: sólo texto (GET). Sin categoría: se infiere del texto (EU-337 punto 3);
     *  el selector manual se sacó porque el filtro es duro y elegir mal esconde el objeto en silencio. */
    const searchWithText = async (routeParams) => {
        const params = new URLSearchParams({ lost_date: toLocalISO(lostDate), query: routeParams.query });
        if (filterLostDateTo) params.append('lost_date_to', toLocalISO(filterLostDateTo));
        if (!selectedInstitute) {
            params.append('latitude', objectMarker.latitude);
            params.append('longitude', objectMarker.longitude);
        }
        const endpoint = '/found-objects' + (selectedInstitute ? `/organizations/${selectedInstitute.id}` : '');
        return await authFetch('get', `${BACK_URL}${endpoint}?${params.toString()}`);
    };

    const queryLostObject = async () => {
        if(!validateInputConstraints()) return;
        setLoading(true);
        setButtonWasPressed(true);
        try {
            const withPhoto = image != null;
            const routeParams = {
                // El color del filtro se agrega al texto de la búsqueda (no es un campo aparte del backend).
                query: filterColor ? `${filterColor} ${queryObjects}`.trim() : queryObjects,
                lostDate: lostDate,
                organizationId: selectedInstitute ? selectedInstitute.id : null,
                filterColor,
                filterLostDateTo,
                searchMode: withPhoto ? 'photo' : 'text',
                // La foto viaja a los resultados para poder guardar la búsqueda con ella.
                photo: withPhoto ? { base64: image.base64, mimeType: image.mimeType, uri: image.uri } : null,
            };
            if (!selectedInstitute) {
                routeParams.longitude = objectMarker.longitude;
                routeParams.latitude = objectMarker.latitude;
            }

            const jsonData = withPhoto ? await searchWithPhoto(routeParams) : await searchWithText(routeParams);
            const foundObjects = jsonData.found_objects ?? [];
            routeParams.objectsFound = foundObjects;
            // Categoría que la IA dedujo de la foto: los resultados la muestran read-only.
            routeParams.aiCategory = jsonData.category ?? null;

            if(foundObjects.length === 0) {
                navigation.navigate('NotFoundObjects', routeParams);
            }else{
                navigation.navigate('FoundObjects', routeParams);
            }

        } catch (error) {
            if (__DEV__) console.error(error);
            Toast.show({ type: 'error', text1: 'Error', text2: 'No se pudo realizar la búsqueda. Verificá tu conexión.' });
        } finally {
            setLoading(false);
        }
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.formContainer}>
                <View style={styles.textDescriptionContainer}>
                    <Text style={styles.labelText}>Descripción del objeto:</Text>
                    <TextInput
                        style={styles.textArea}
                        placeholder="Proporciona detalles que ayuden a identificarlo"
                        multiline
                        value={queryObjects}
                        onChangeText={(text) => setQueryObjects(text)}
                    />
                </View>

                {/* EU-326: foto OPCIONAL. Es la señal que más levanta las chances, así que se pide, pero
                    no se exige: sin ella la búsqueda va por el camino de sólo texto. */}
                <View style={styles.textDescriptionContainer}>
                    <Text style={styles.labelText}>Foto del objeto (opcional):</Text>
                    <Text style={styles.helperText}>
                        Cargar una foto aumenta bastante las chances de encontrarlo. Si no tenés una del
                        objeto, sirve igual una parecida sacada de internet.
                    </Text>
                    <View style={{ width: '100%', alignItems: 'center' }}>
                        {image ? (
                            <ImageBackground
                                source={{ uri: image.uri }}
                                style={styles.viewImage}
                                imageStyle={styles.onlyImage}>
                                <Pressable style={styles.iconContainer} onPress={() => setImage(null)}>
                                    <Icon name={'trash-can'} size={24} color={'#000000'} />
                                </Pressable>
                            </ImageBackground>
                        ) : (
                            <Pressable onPress={pickImage} style={styles.imageLoadPressable}>
                                <Text style={styles.imageLoadText}>Seleccionar foto</Text>
                                <Icon name={'upload'} size={24} color={'#bdc1c1'} />
                            </Pressable>
                        )}
                    </View>
                </View>
                <InstitutePicker
                    selectedValue={selectedInstitute ? selectedInstitute.id.toString() : ""}
                    setSelected={(institution) => setSelectedInstitution(institution)}
                />
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
                            Platform.OS === 'web' ? (
                                <input
                                    type="date"
                                    style={{ padding: 8, borderRadius: 8, border: '1px solid #ccc', fontSize: 14 }}
                                    onChange={(e) => {
                                        setShowDateToPicker(false);
                                        if (e.target.value) setFilterLostDateTo(new Date(e.target.value));
                                    }}
                                />
                            ) : (
                                <DateTimePicker
                                    value={filterLostDateTo || new Date()}
                                    mode="date"
                                    display={Platform.OS === 'ios' ? 'inline' : 'default'}
                                    onChange={(_, selected) => {
                                        setShowDateToPicker(false);
                                        if (selected) setFilterLostDateTo(selected);
                                    }}
                                />
                            )
                        )}

                        <TouchableOpacity style={styles.clearFiltersButton}
                            onPress={() => { setFilterColor(''); setFilterLostDateTo(null); }}>
                            <Text style={styles.clearFiltersText}>Limpiar filtros</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {buttonWasPressed ? (
                    loading ? <ActivityIndicator size="large" color={colors.text} />: null
                ) : null
                }
            </ScrollView>
            <EurekappButton text="Buscar objeto" onPress={queryLostObject} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: colors.background,
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
        color: colors.text,
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
        color: colors.text,
        backgroundColor: colors.surface,
        padding: 16,
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: colors.textMuted,
        fontFamily: 'PlusJakartaSans-Regular',
        marginBottom: 10,
    },
    textDescriptionContainer: {
        justifyContent: 'flex-start',
        alignSelf: 'stretch',
    },
    helperText: {
        color: colors.textMuted,
        fontSize: 13,
        lineHeight: 18,
        marginTop: 4,
        marginBottom: 8,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    onlyImage: {
        borderRadius: 16,
    },
    viewImage: {
        height: 'auto',
        width: '100%',
        maxWidth: 500,
        maxHeight: 500,
        overflow: 'hidden',
        aspectRatio: 1,
        justifyContent: 'flex-end',
        alignItems: 'flex-end',
        marginBottom: 10,
    },
    iconContainer: {
        margin: 10,
        backgroundColor: colors.surface,
        padding: 8,
        borderRadius: 24,
    },
    imageLoadPressable: {
        width: '100%',
        maxWidth: 500,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#bdc1c1',
        backgroundColor: colors.background,
        paddingVertical: 16,
        paddingHorizontal: 12,
        marginBottom: 10,
    },
    imageLoadText: {
        fontSize: 16,
        color: colors.textMuted,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    filterToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 10,
        alignSelf: 'flex-start',
    },
    filterToggleText: {
        color: colors.textMuted,
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    filtersContainer: {
        alignSelf: 'stretch',
        backgroundColor: colors.surface,
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        gap: 8,
    },
    colorInput: {
        backgroundColor: colors.background,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
        fontSize: 14,
        color: colors.text,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    dateButton: {
        backgroundColor: colors.background,
        borderRadius: 10,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    dateButtonText: {
        fontSize: 14,
        color: colors.text,
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
        color: colors.textMuted,
        fontFamily: 'PlusJakartaSans-Regular',
    },
});

export default FindObject;