import {
    ActivityIndicator,
    FlatList,
    Image,
    Modal,
    Pressable,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    View
} from "react-native";
import React, {useEffect, useState} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import EurekappButton from "../components/Button";
import axios from "axios";
import Constants from "expo-constants";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const LostObjectReturn = ({ navigation }) => {
    const [selectedInstitute, setSelectedInstitute] = useState(null);
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [institutesObject, setInstitutesObject] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const fetchFoundObjectsFromOrganization = async (institute) => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            console.log(selectedInstitute);
            let res = await axios.get(
                `${BACK_URL}/found-objects/organizations/all/${institute.id}`,
                config );
            let jsonData = res.data;
            setInstitutesObject(jsonData.found_objects);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    }

    const onRefresh = async () => {
        setRefreshing(true);
        await fetchFoundObjectsFromOrganization(selectedInstitute);
        setRefreshing(false);
    }

    useEffect(() => {
        const getContextInstitute = async () => {
            const institute = {
                id: await AsyncStorage.getItem('org.id'),
                name: await AsyncStorage.getItem('org.name')
            };
            setSelectedInstitute( institute );
            await fetchFoundObjectsFromOrganization(institute);
        }
        getContextInstitute();
    }, []);

    const renderItem = ({item}) => {
        const isSelected = item.id === objectSelectedId;
        const date = new Date(item.found_date);
        return (
            <Pressable style={[styles.item, isSelected && styles.highlightedOrganizationObject]}
                       onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.title}
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

    const NotFoundComponent = () => {
        return (
            <View style={{height: 200, justifyContent: 'center', alignSelf: 'center'}}>
                <Text style={{
                    fontFamily: 'PlusJakartaSans-Regular',
                    fontSize: 20
                }}>Tu organización no tiene objetos!</Text>
            </View>
        );
    }
    return (
        <View style={styles.container}>
            <View style={styles.organizationObjectsContainer}>
                { loading ?
                    <View style={{flex: 1, justifyContent: 'center'}}>
                        <ActivityIndicator size="large" style={{alignSelf: 'center'}} color="#111818" />
                    </View>
                    : <FlatList
                        data={institutesObject}
                        keyExtractor={(item) => item.id}
                        renderItem={renderItem}
                        contentContainerStyle={styles.contentContainer}
                        scrollEnabled={true}
                        ListEmptyComponent={NotFoundComponent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
                        } />
                }

            </View>
            <EurekappButton text='Marcar como encontrado'
                            onPress={() => navigation.navigate('ReturnObjectForm', {
                                objectId: objectSelectedId
                            })}/>
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
    },
    organizationHeader: {
        color: '#111818',
        fontSize: 24,
        fontWeight: 'bold',
        textAlign: 'center',
        fontFamily: 'PlusJakartaSans-Bold'
    }
});


export default LostObjectReturn;