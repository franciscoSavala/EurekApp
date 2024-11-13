import React, {useState} from "react";

import {FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View} from "react-native";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import UploadLostObjectModal from "./UploadLostObjectModal";


const FoundObjects = ({ route, navigation }) => {
    const { objectsFound, query, lostDate, coordinates, organizationId } = route.params;
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [organizationInformationModal, setOrganizationInformationModal] = useState(false);
    const [uploadLostObjectModal, setUploadLostObjectModal] = useState(false);
    const foundObjectsMap = new Map(objectsFound.map(obj => [obj.id, obj]))

    const renderItem = ({ item }) => {
        {/*
        const isSelected = item.id === objectSelectedId;
        return (
            <Pressable style={[styles.item, isSelected && styles.highlightedObjectFound]}
                              onPress={() => setObjectSelectedId(item.id)}>
                <Image
                    source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                    style={styles.image}
                />
                <Text style={styles.description}>{item.title}</Text>
            </Pressable>
        );*/}
        const isSelected = item.id === objectSelectedId;
        const date = new Date(item.found_date);
        return (
            <Pressable style={[styles.item, isSelected && styles.highlightedObjectFound]}
                       onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemText}>
                        Encontrado el {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                    </Text>
                    <Text style={styles.itemText}>
                        Puntaje: {(item.score * 100).toFixed(2)}%
                    </Text>
                </View>
                <Image
                    source={ item.b64Json
                        ? { uri: `data:image/jpeg;base64,${item.b64Json}` }
                        : require('../../assets/defaultImage.png') }
                    style={styles.image}
                    resizeMode="cover"
                />
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.coincidencesContainer}>
                <Text style={styles.headerText}>Coincidencias encontradas</Text>
                <FlatList
                    data={objectsFound}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.contentContainer}
                    extraData={objectSelectedId}
                />
            </ScrollView>
            <View style={styles.buttonContainer}>
                <EurekappButton onPress={() => setOrganizationInformationModal(true)}
                                backgroundColor={'#f0f4f4'}
                                textColor={'#111818'}
                                text="Este es mi objeto" />
                <EurekappButton onPress={() => setUploadLostObjectModal(true)}
                                backgroundColor={'#fff'}
                                textColor={'#111818'}
                                text="No encontré mi objeto" />
            </View>
            <UploadLostObjectModal modalVisible={uploadLostObjectModal}
                                   setModalVisible={setUploadLostObjectModal}
                                   query={query}
                                   lostDate={lostDate}
                                   organizationId={organizationId}
                                   coordinates={coordinates}/>
            <Modal
                animationType="none"
                transparent={true}
                visible={organizationInformationModal}
                onRequestClose={() => setOrganizationInformationModal(!organizationInformationModal)}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Icon style={styles.infoIcon} name={'circle-info'} size={32} color={'#111818'}/>
                        <Text style={styles.modalText}>
                            Para recuperar tu objeto, ponte en contacto con la organización que lo está custodiando:{"\n"} {"\n"}
                            {foundObjectsMap.has(objectSelectedId) ?
                                (
                                <>
                                    {foundObjectsMap.get(objectSelectedId).organization.name}{"\n"}
                                    {foundObjectsMap.get(objectSelectedId).organization.contactData}
                                </>
                                ) : null}
                            {"\n"}{"\n"}
                            Ten en cuenta que, por motivos de seguridad, antes de devolverte el objeto, personal del lugar te solicitará algunos datos personales y de contacto, y te tomarán una foto.
                        </Text>
                        <EurekappButton text='Cerrar'
                                        onPress={() => setOrganizationInformationModal(false)}/>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        flex: 1,
        flexDirection: "column",
    },
    coincidencesContainer: {
        flexDirection: 'column',
        /*flex: 1,*/
        width: '100%',
        justifyContent: 'flex-start',
        maxWidth:'1000px',
        alignSelf:"center",

        flexGrow: 1,
        paddingHorizontal: 10,
    },
    contentContainer: {
        padding: 10,
    },
    headerText: {
        color: '#111818', // equivalent to text-[#111818]
        fontSize: 22, // equivalent to text-[22px]
        fontFamily: 'PlusJakartaSans-Bold',
        paddingLeft: 10,
        marginBottom: 10,
    },
    item: {
        height: 150,
        backgroundColor: '#f0f4f4',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 16,
    },
    itemTextContainer: {
        flex: 2,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    separator: {
        width: 10,
    },
    list: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    image: {
        width: '100%',     // La imagen ocupará el 100% del ancho del contenedor
        height: undefined, // Mantiene el ratio de aspecto
        aspectRatio: 1,    // Asegura que la imagen mantenga su proporción (cuadrada)
        maxWidth: 120,     // Limita el ancho máximo de la imagen
        maxHeight: 120,    // Limita la altura máxima de la imagen
        borderRadius: 16,
        overflow: 'hidden', // Evita que cualquier contenido fuera del borde del contenedor sea visible
    },
    description: {
        color: '#111818',
        fontSize: 16,
        lineHeight: 20,
        marginVertical: 5,
        fontFamily: 'PlusJakartaSans-Regular'
    },
    flatListContainer: {
        height: 350,
        width: '100%'
    },
    buttonContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
    },
    highlightedObjectFound: {
        backgroundColor: '#19e6e6',
    },
    centeredView: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalView: {
        margin: 20,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 35,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: {
            width: 0,
            height: 2,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'left',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    modalButton: {
        width: '100%',
        backgroundColor: '#f0f4f4',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    infoIcon: {
        marginBottom: 50,
    },
})
export default FoundObjects;