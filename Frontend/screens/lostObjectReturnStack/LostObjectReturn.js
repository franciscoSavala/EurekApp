import {FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View} from "react-native";
import React, {useEffect, useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappButton from "../components/Button";


const LostObjectReturn = ({ navigation }) => {
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [institutesObject, setInstitutesObject] = useState([{
        id: '123',
        description: 'Un gatitoooo',
        'found_date': new Date()
    },{
        id: '200',
        description: 'Un gatitoooo',
        'found_date': new Date()
    },{
        id: '4242',
        description: 'Un gatitoooo',
        'found_date': new Date()
    },{
        id: '23',
        description: 'Un gatitoooo',
        'found_date': new Date()
    },{
        id: '2939',
        description: 'Un gatitoooo',
        'found_date': new Date()
    },{
        id: '123123123',
        description: 'Un gatitoooo',
        'found_date': new Date()
    }]);
    useEffect(() => {
        const getContextInstitute = async () => {
            const institute = {
                id: await AsyncStorage.getItem('org.id'),
                name: await AsyncStorage.getItem('org.name')
            };
            if(institute.id == null || institute.name == null) return;

            //TODO: LLAMAR A API PARA BUSCAR OBJETOS DE LA INSTITUCION


            setSelectedInstitute( institute );
        }
        getContextInstitute();
    }, []);

    const renderItem = ({item}) => {
        const isSelected = item.id === objectSelectedId;
        const date = item.found_date;
        return (
            <Pressable style={[styles.item, isSelected && styles.highlightedOrganizationObject]}
                       onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.description}
                    </Text>
                    <Text style={styles.itemText}>
                        Encontrado: {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()} a las {date.toLocaleTimeString()}
                    </Text>
                </View>
                <Image
                    source={ item.b64Json
                            ? { uri: `data:image/jpeg;base64,${item.b64Json}` }
                            : require('../../assets/defaultImage.png') }
                    style={styles.image}
                />
            </Pressable>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.organizationObjectsContainer}>
                {selectedInstitute != null
                    ? <Text style={{alignSelf: 'center'}}>Objetos de {selectedInstitute.name}</Text>
                    : null
                }
                <FlatList
                    data={institutesObject}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.contentContainer}
                    scrollEnabled={true}
                />
            </View>
            <EurekappButton text='Marcar como encontrado'
                            onPress={() => navigation.navigate('ReturnObjectForm')}/>
        </View>
    );


}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#fff'
    },
    organizationObjectsContainer: {
        flex: 1,
    },
    contentContainer: {
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
    highlightedOrganizationObject: {
        backgroundColor: '#19e6e6',
    },
    image: {
        aspectRatio: 1,
        borderRadius: 16,
        flex: 1,
    },
    itemTextContainer: {
        flex: 2,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    itemText: {
        color: '#111818',
        fontSize: 16,
        fontFamily: 'PlusJakartaSans-Regular'
    }
});


export default LostObjectReturn;