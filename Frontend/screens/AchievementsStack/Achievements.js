import React, {useEffect, useState} from "react";

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
    TextInput, TouchableOpacity,
    View
} from "react-native";
import {Controller, useForm} from "react-hook-form";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import Constants from "expo-constants";
import AchievementBar from "./AchievementBar";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const Achievements = ({ route, navigation }) => {

    const { control,
        handleSubmit,
        formState: {errors},
        setValue,
        getValues ,
        setError} = useForm();
    const [currentLevel, setCurrentLevel] = useState('');
    const [nextLevel, setNextLevel] = useState('');
    const [returnedObjects, setReturnedObjects ] = useState(0);
    const [returnedObjectsAchievements, setReturnedObjectsAchievements] = useState('');
    const [nextReturnedObjectsAchievement, setNextReturnedObjectsAchievement] = useState('');
    const [xp, setXp] = useState(0)

    const [loading, setLoading ] = useState(true);
    //const [, ] = useState('');


    useEffect(() => {
        fetchUserAchievementsData();
        setLoading(false);
    }, []);

    useEffect(() => {
        //console.log('Returned Objects:', returnedObjects);
        //console.log('Returned Objects Achievements:', returnedObjectsAchievements);
        //console.log('Next Returned Objects Achievement:', nextReturnedObjectsAchievement);
    }, [returnedObjects, returnedObjectsAchievements, nextReturnedObjectsAchievement]);

    const fetchUserAchievementsData = async () => {
        try {
            let authHeader = 'Bearer ' + await AsyncStorage.getItem('jwt');
            let config = {
                headers: {
                    'Authorization': authHeader
                }
            }
            let endpoint = '/user/achievements';
            let res = await axios.get(BACK_URL + endpoint, //esto es inseguro pero ok...
                config );
            let jsonData = res.data;

            setCurrentLevel(jsonData.currentLevel);
            setNextLevel(jsonData.nextLevel);
            setReturnedObjects(jsonData.returnedObjects);
            setReturnedObjectsAchievements(jsonData.returnedObjectsAchievements);
            setNextReturnedObjectsAchievement(jsonData.nextReturnedObjectsAchievement);
            setXp(jsonData.xp);
        } catch (error) {
            console.error(error);
        }
    }


    const renderItem = ({ item }) => {
        return (
            <View  style={[styles.item]} >
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>{item.achievementName}</Text>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>{item.requiredReturnedObjects}/{item.requiredReturnedObjects}</Text>
                    <AchievementBar xp={1} currentLevelPoints={0} nextLevelPoints={1} color='#19e6e6' />
                    { item.requiredReturnedObjects === 1?
                        <Text style={styles.itemText}>Devolviste {item.requiredReturnedObjects} objeto. </Text>
                        :
                        <Text style={styles.itemText}>Devolviste {item.requiredReturnedObjects} objetos. </Text>
                    }

                </View>
            </View>
        );
    }



    return (
        <View style={styles.container}>
            <ScrollView>
            <View style={styles.formContainer}>


                <View style={styles.sectionContainer}>
                    <Text style={styles.label}>Nivel {currentLevel.levelName} - <Text style={styles.labelXP}>{xp} XP</Text></Text>
                    { nextLevel ?
                        <>
                    <AchievementBar xp={xp} currentLevelPoints={currentLevel.requiredXP} nextLevelPoints={nextLevel.requiredXP} color='#19e6e6' />
                            {nextLevel.requiredXP - xp === 1 ?
                                <Text style={styles.labelXP}>Te falta 1 punto para alcanzar el nivel {nextLevel.levelName}</Text>
                                : <Text style={styles.labelXP}>Te faltan {nextLevel.requiredXP - xp} puntos para alcanzar el nivel {nextLevel.levelName}</Text>
                            }
                        </>
                        :
                        <>
                        <AchievementBar xp={2} currentLevelPoints={0} nextLevelPoints={2} color='#19e6e6' />
                        <Text style={styles.labelXP}>¡Alcanzaste la cima!</Text>
                        </>
                    }
                </View>


                <View style={styles.sectionContainer}>
                    <Text style={styles.label}>Logros:</Text>

                    <View>
                        {nextReturnedObjectsAchievement?
                        <>
                            <View  style={[styles.item]} >
                                <View style={styles.itemTextContainer}>
                                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}> {nextReturnedObjectsAchievement.achievementName} </Text>
                                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>{returnedObjects}/{nextReturnedObjectsAchievement.requiredReturnedObjects}</Text>
                                    <AchievementBar xp={returnedObjects} currentLevelPoints={0} nextLevelPoints={nextReturnedObjectsAchievement.requiredReturnedObjects} color='#19e6e6' />
                                    {nextReturnedObjectsAchievement.requiredReturnedObjects - returnedObjects === 1?
                                        <Text style={styles.itemText}>Devuelve {nextReturnedObjectsAchievement.requiredReturnedObjects - returnedObjects} objeto más para obtener el logro "{nextReturnedObjectsAchievement.achievementName}". </Text>
                                    :
                                        <Text style={styles.itemText}>Devuelve {nextReturnedObjectsAchievement.requiredReturnedObjects - returnedObjects} objetos más para obtener el logro "{nextReturnedObjectsAchievement.achievementName}". </Text>
                                    }

                                </View>
                            </View>
                        </>
                            : null}


                        <FlatList
                            data={returnedObjectsAchievements}
                            keyExtractor={(item, index) => item.achievementName || index.toString()}
                            renderItem={renderItem}

                        />
                    </View>

                </View>


            </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    sectionContainer: {
        width:'100%',
        margin: 20,
    },
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    formContainer: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        maxWidth:'800px',
        width: '100%',
        alignSelf:"center",
        paddingHorizontal: 10
    },
    item: {
        width:'100%',
        backgroundColor: '#f0f4f4',
        flexDirection: 'row',
        alignItems: 'center',
        padding: 20,
        marginVertical: 5,
        borderRadius: 16,
    },
    itemTextContainer: {
        flex: 2,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    label: {
        alignSelf: 'flex-start',
        marginLeft: 10,
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular'
    },
    labelXP: {
        alignSelf: 'flex-start',
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        fontFamily: 'PlusJakartaSans-Regular',
        fontStyle: 'italic'
    },
    requestButtonText: {
        color: 'white',
        fontWeight: 'bold',
    },
    textArea: {
        resize: 'none',
        overflow: 'hidden',
        alignSelf: 'stretch',
        borderRadius: 12,
        color: '#111818',
        backgroundColor: '#f0f4f4',
        fontSize: 16,
        fontWeight: 'normal',
        placeholderTextColor: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderBottomWidth: 0,
        marginHorizontal: 10,
    },
});

export default Achievements;