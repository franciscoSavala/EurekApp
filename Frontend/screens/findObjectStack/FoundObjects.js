import React, {useState} from "react";

import {FlatList, Image, Modal, Pressable, StyleSheet, Text, View} from "react-native";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";


const FoundObjects = ({ route, navigation }) => {
    const { objectsFound } = route.params;
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [modalVisible, setModalVisible] = useState(false);
    const foundObjectsMap = new Map(objectsFound.map(obj => [obj.id, obj]))

    const renderItem = ({ item }) => {
        const isSelected = item.id === objectSelectedId;
        return (
            <Pressable style={[styles.item, isSelected && styles.highlightedObjectFound]}
                              onPress={() => setObjectSelectedId(item.id)}>
                <Image
                    source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                    style={styles.image}
                />
                <Text style={styles.description}>{item.description}</Text>
            </Pressable>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.coincidencesContainer}>
                <Text style={styles.headerText}>Coincidencias encontradas</Text>
                <FlatList
                    data={objectsFound}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.contentContainer}
                    extraData={objectSelectedId}
                />
            </View>
            <View style={styles.buttonContainer}>
                <EurekappButton onPress={() => setModalVisible(true)}
                                backgroundColor={'#f0f4f4'}
                                textColor={'#111818'}
                                text="Este es mi objeto" />
                <EurekappButton onPress={() => navigation.goBack()}
                                backgroundColor={'#fff'}
                                textColor={'#111818'}
                                text="No encontré mi objeto" />
            </View>

            <Modal
                animationType="none"
                transparent={true}
                visible={modalVisible}
                onRequestClose={() => setModalVisible(!modalVisible)}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Icon style={styles.infoIcon} name={'circle-info'} size={32} color={'#111818'}/>
                        <Text style={styles.modalText}>
                            Info de contacto: {foundObjectsMap.has(objectSelectedId) ?
                            foundObjectsMap.get(objectSelectedId).organization.contactData :
                            null}
                        </Text>
                        <EurekappButton text='Cerrar' onPress={() => setModalVisible(false)}/>
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
        flex: 1,
        width: '100%',
        justifyContent: 'flex-start',
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
        borderRadius: 16,
        padding: 10,
        marginBottom: 10,
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
        height: 300,
        aspectRatio: 1,
        borderRadius: 16,
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
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    modalButton: {
        width: '100%',
        backgroundColor: '#f0f4f4',
        fontWeight: 'bold',
        textAlign: 'center',
    },
    infoIcon: {
        marginBottom: 15,
    },
})
export default FoundObjects;