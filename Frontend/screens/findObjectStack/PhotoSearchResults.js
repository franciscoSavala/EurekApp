import React from 'react';
import { FlatList, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import EurekappButton from '../components/Button';
import Icon from 'react-native-vector-icons/FontAwesome6';

const PhotoSearchResults = ({ route, navigation }) => {
    const { objectsFound } = route.params;
    const results = objectsFound.slice(0, 5);

    const renderItem = ({ item }) => {
        const date = new Date(item.found_date);
        return (
            <Pressable
                style={styles.item}
                onPress={() => navigation.navigate('FoundObjectDetail', { foundObjectUUID: item.id })}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, { fontFamily: 'PlusJakartaSans-Bold' }]}>
                        {item.title}
                    </Text>
                    <Text style={styles.itemText}>
                        {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()}
                    </Text>
                    <Text style={styles.itemText}>
                        {item.organization ? item.organization.name : ''}
                    </Text>
                </View>
                <Image
                    source={
                        item.b64Json
                            ? { uri: `data:image/jpeg;base64,${item.b64Json}` }
                            : require('../../assets/defaultImage.png')
                    }
                    style={styles.image}
                    resizeMode="cover"
                />
            </Pressable>
        );
    };

    if (results.length === 0) {
        return (
            <View style={styles.container}>
                <View style={styles.coincidencesContainer}>
                    <Text style={styles.headerText}>No se encontraron objetos similares a tu foto.</Text>
                    <View style={styles.prettyNotFoundContainer}>
                        <View style={styles.prettyCardNotFound}>
                            <View style={styles.magnifyingIcon}>
                                <Icon name={'magnifying-glass'} size={24} color={'#111818'} />
                            </View>
                            <View style={styles.labelPrettyNotFound}>
                                <Text style={styles.prettyTitleNotFound}>
                                    Puede que tu objeto no haya sido encontrado todavía.
                                </Text>
                                <Text style={styles.prettyDescriptionNotFound}>
                                    Intentá con otra foto o revisá de nuevo otro día.
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
                <EurekappButton text="Nueva búsqueda" onPress={() => navigation.goBack()} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.coincidencesContainer}>
                <Text style={styles.headerText}>Coincidencias encontradas</Text>
                <FlatList
                    data={results}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.contentContainer}
                    scrollEnabled={false}
                />
            </ScrollView>
            <EurekappButton
                text="Nueva búsqueda"
                onPress={() => navigation.goBack()}
                backgroundColor={'#f0f4f4'}
                textColor={'#111818'}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#fff',
        flex: 1,
        flexDirection: 'column',
    },
    coincidencesContainer: {
        flexDirection: 'column',
        width: '100%',
        justifyContent: 'flex-start',
        maxWidth: '1000px',
        alignSelf: 'center',
        flexGrow: 1,
        paddingHorizontal: 10,
    },
    contentContainer: {
        padding: 10,
    },
    headerText: {
        color: '#111818',
        fontSize: 22,
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
    itemText: {
        color: '#111818',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    image: {
        width: '100%',
        height: undefined,
        aspectRatio: 1,
        maxWidth: 120,
        maxHeight: 120,
        borderRadius: 16,
        overflow: 'hidden',
    },
    prettyNotFoundContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
    },
    prettyCardNotFound: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        alignItems: 'center',
    },
    magnifyingIcon: {
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f0f4f4',
        borderRadius: 16,
        margin: 10,
        padding: 20,
    },
    labelPrettyNotFound: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
    },
    prettyTitleNotFound: {
        color: '#111818',
        fontSize: 16,
        fontWeight: '500',
        lineHeight: 22,
        marginBottom: 4,
    },
    prettyDescriptionNotFound: {
        color: '#638888',
        fontSize: 14,
        fontWeight: '400',
        lineHeight: 20,
    },
});

export default PhotoSearchResults;
