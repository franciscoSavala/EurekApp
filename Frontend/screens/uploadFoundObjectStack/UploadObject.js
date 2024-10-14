import React, {useEffect, useRef, useState} from 'react';
import {
    View,
    Text,
    TextInput,
    Image,
    StyleSheet,
    Pressable,
    ActivityIndicator,
    ImageBackground,
    ScrollView,
    Platform, KeyboardAvoidingView, Switch
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Buffer } from "buffer";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappDateComponent from "../components/EurekappDateComponent";
import Constants from "expo-constants";
import ReactNativeBlobUtil from "react-native-blob-util";
import alert from "react-native-web/src/exports/Alert";
import MapViewComponent from "../components/MapViewComponent";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const FormData = global.FormData;

const UploadObject = () => {
    //object data
    const [objectTitle, setObjectTitle] = useState('');
    const [detailedDescription, setDetailedDescription] = useState('');
    const [image, setImage] = useState({});
    const [imageByte, setImageByte] = useState(new Buffer("something"));
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [imageUploaded, setImageUploaded ] = useState(false);
    const [foundDate, setFoundDate] = useState(() => {
        let curDate = new Date(Date.now() - (3 * 60 * 60 * 1000));
        curDate.setMinutes(0,0,0);
        return curDate;
    });
    const [useCoordinates, setUseCoordinates] = useState(false);
    const toggleSwitch = () => setUseCoordinates(previousState => !previousState);

    //form loading state
    const [loading, setLoading] = useState(false);
    const [buttonWasPressed, setButtonWasPressed ] = useState(false);
    const [responseOk, setResponseOk] = useState(false);

    //map data
    const [objectMarker, setObjectMarker] = useState({
        // Si no seteamos un valor por defecto, en web nunca se cargará el marcador porque latitude siempre tendrá un
        // valor inicial igual a Number.MAX_VALUE.
        latitude: -31.4124,
        longitude: -64.1867
});

useEffect(() => {
    const getContextInstitute = async () => {
        const institute = {
            id: await AsyncStorage.getItem('org.id'),
            name: await AsyncStorage.getItem('org.name')
        };
        if(institute.id == null || institute.name == null) return;
        setSelectedInstitute( institute );
    }
    getContextInstitute();
}, []);

const imagePickerConfig = {
    mediaTypes: ImagePicker.MediaTypeOptions.Images,
    base64: true,
    aspect: [1,1],
    quality: 1,
};



const handleImagePicked = (result) => {
    if (!result.canceled) {
        setImage(result.assets[0]);
        setImageByte(Buffer.from(result.assets[0].base64, "base64"));
        setImageUploaded(true);
    }
};

const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync(imagePickerConfig);
    handleImagePicked(result);
};

const takePhoto = async () => {
    if (Platform.OS === 'web') {
        // Para web, usamos input file con capture
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment'; // Intenta abrir la cámara trasera si está disponible
        input.onchange = (event) => {
            const file = event.target.files[0];
            const reader = new FileReader();
            reader.onload = () => {
                const base64String = reader.result.split(',')[1];
                setImage({ uri: URL.createObjectURL(file), base64: base64String });
                setImageByte(Buffer.from(base64String, "base64"));
                setImageUploaded(true);
            };
            reader.readAsDataURL(file);
        };
        input.click();
    } else {
        // En móviles, seguimos usando ImagePicker
        let result = await ImagePicker.launchCameraAsync(imagePickerConfig);
        handleImagePicked(result);
    }
};

const validateConstraints = () => {
    if (!imageUploaded){
        alert('Por favor sube una imagen');
        return false;
    }
    if (!objectTitle) {
        alert('Por favor escribe una descripción');
        return false;
    }
    if(objectTitle.length > 30){
        alert('Por favor escribe una descripción de menos de 30 caracteres');
        return false;
    }
    if(imageByte.length / 1024 / 1024 > 10){
        alert('Por favor sube una imagen de menos de 10MB');
        return false;
    }
    return true;
}
const submitData = async () => {
    if(!validateConstraints()) return;
    setLoading(true);
    setButtonWasPressed(true);

    try {

        let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');

        if (Platform.OS === 'web') {
            // Enviar datos como JSON en la web
            const formData = new FormData();
            formData.append('title', objectTitle);
            formData.append('found_date', foundDate.toISOString().split('.')[0]);
            formData.append('detailed_description', detailedDescription);
            if (useCoordinates){
                formData.append('latitude', objectMarker.latitude.toString());
                formData.append('longitude', objectMarker.longitude.toString());
            }
            formData.append("file", new Blob([imageByte]));
            let response = await fetch(`${BACK_URL}/found-objects/organizations/${selectedInstitute.id}`, {
                method: 'POST',
                headers: {
                    'Authorization': authHeader,
                },
                body: formData,
            });

            if (response.ok) {
                setResponseOk(true);
            } else {
                setResponseOk(false);
            }
        } else {
            // Enviar datos usando react-native-blob-util en móviles
            let body = [{name: 'title', data: objectTitle},
                {name: 'found_date', data: foundDate.toISOString().split('.')[0]},
                {name: 'detailed_description', data: detailedDescription},
                {name: 'file', filename: 'found_object.jpg',
                    data: String(image.base64)}];

            if(useCoordinates) {
                body.push(
                    {name: 'latitude', data: objectMarker.latitude.toString()},
                    {name: 'longitude', data: objectMarker.longitude.toString()}
                );
            }
            let response =
                await ReactNativeBlobUtil.fetch('POST',
                    `${BACK_URL}/found-objects/organizations/${selectedInstitute.id}`,{
                        'Authorization': authHeader,
                        'Content-Type': 'multipart/form-data'
                    }, body);
            setLoading(false);
            if (response.respInfo.status >= 200 && response.respInfo.status < 300) {
                setResponseOk(true);
            }else{
                setResponseOk(false);
            }
        }
    } catch (error) {
        console.error(error);
        setResponseOk(false);
    } finally {
        setLoading(false);
    }
};

const deleteImage = () => {
    setImage({});
    setImageUploaded(false);
}

const StatusComponent = () => {
    return(
        <View>
            {buttonWasPressed ? (
                loading ? (
                    <ActivityIndicator style={{marginVertical: 10}} size="large" color="#111818" />
                ) : (
                    responseOk ? (
                        <Icon style={{marginVertical: 10}} name={'circle-check'} size={50} color={'#008000'}/>
                    ) : (
                        <Icon style={{marginVertical: 10}} name={'circle-xmark'} size={50} color={'#ED4337'}/>
                    )
                )
            ) : null
            }
        </View>
    );
}
return (
    <View style={{flex: 1, backgroundColor: '#fff'}}>
        <ScrollView contentContainerStyle={styles.formContainer}>
            <View style={styles.textAreaContainer}>
                <Text style={styles.label}>Titulo de la publicación: </Text>
                <TextInput
                    maxLength={30}
                    style={styles.textArea}
                    placeholder="Escribe un título"
                    multiline
                    onChangeText={(text) => setObjectTitle(text)}
                />
            </View>
            <View>
                <Text style={styles.label}>Imagen del objeto encontrado:</Text>
                { imageUploaded ? (
                    <ImageBackground
                        source={{ uri: image.uri }}
                        style={styles.viewImage}
                        imageStyle={styles.onlyImage} >
                        <Pressable style={styles.iconContainer} onPress={deleteImage}>
                            <Icon name={'trash-can'} size={24} color={'#000000'}/>
                        </Pressable>
                    </ImageBackground>
                ) : (
                    <Image
                        source={require('../../assets/defaultImage.png')}
                        style={styles.image}
                    />
                )
                }
            </View>
            <View style={styles.imageLoadContainer}>
                <Pressable onPress={pickImage}
                           style={styles.imageLoadPressable}>
                    <Text style={styles.imageLoadText}>Seleccionar foto</Text>
                    <Icon name={'upload'} size={24} color={'#bdc1c1'}/>
                </Pressable>
                <View style={{width: 10}}></View>
                <Pressable onPress={takePhoto}
                           style={styles.imageLoadPressable}>
                    <Text style={styles.imageLoadText}>Sacar Foto</Text>
                    <Icon name={'camera'} size={24} color={'#bdc1c1'}/>
                </Pressable>
            </View>
            <View style={styles.switchContainer}>
                <Switch
                    style={styles.switch}
                    value={useCoordinates}
                    onValueChange={toggleSwitch}
                />
                <Text style={{
                    color: '#111818',
                    fontSize: 16,
                    fontWeight: '500',
                    flexShrink: 1,
                    fontFamily: 'PlusJakartaSans-Regular'
                }}>El objeto fue encontrado fuera del establecimiento</Text>
            </View>
            { useCoordinates ? <MapViewComponent
                objectMarker={objectMarker}
                setObjectMarker={setObjectMarker}
                labelText={"Ubicación donde fue encontrado:"}
                style={{ display: useCoordinates ? 'flex' : 'none' }} />
                :
                null
            }
            <EurekappDateComponent labelText={"Fecha y hora en la que fue encontrado:  "}
                                   setDate={setFoundDate} date={foundDate}/>
            <View style={styles.textAreaContainer}>
                <Text style={styles.label}>
                    Información relevante (opcional):
                </Text>
                <TextInput
                    maxLength={250}
                    style={[styles.textArea, {minHeight: 200}]}
                    placeholder="Agrega una descripción"
                    multiline
                    onChangeText={(text) => setDetailedDescription(text)}
                />
            </View>
            <StatusComponent />
        </ScrollView>
        <EurekappButton text="Receptar objeto encontrado" onPress={submitData} />
    </View>
);
};

const styles = StyleSheet.create({
container: {
    flex: 1,
    alignItems: 'center',
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
formView: {
    marginHorizontal: 10
},
image: {
    height: 'auto',
    width: '100%',
    maxWidth: 500,
    maxHeight: 500,
    aspectRatio: 1,
    borderRadius: 16,
    marginBottom: 10,
},
imageAndMapsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
imageLoadContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
    maxWidth: 500,
},
imageLoadPressable: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    justifyContent: 'space-between',
    alignItems: 'center',
    overflow: 'hidden',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#bdc1c1',
    backgroundColor: '#fff',
    paddingVertical: 16,
    paddingHorizontal: 12,
},
imageLoadText: {
    fontSize: 16,
    fontWeight: 'normal',
    color: '#638888',
    fontFamily: 'PlusJakartaSans-Regular'
},
textAreaContainer: {
    alignSelf: 'stretch'
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
headerContainer: {
    height: 50,
    alignItems: 'flex-start'
},
headerText: {
    color: '#111818',
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    fontFamily: 'PlusJakartaSans-Bold'
},
iconContainer: {
    margin: 10,
    backgroundColor: '#f0f4f4',
    padding: 8,
    borderRadius: 24
},
label: {
    color: '#111818',
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'PlusJakartaSans-Regular'
},
switchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
},
switch: {
    marginRight: 10,
}

});

export default UploadObject;
