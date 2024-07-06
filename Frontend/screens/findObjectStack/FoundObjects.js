import {FlatList, Image, StyleSheet, Text, View} from "react-native";
import EurekappButton from "../components/Button";


const FoundObjects = ({ route, navigation }) => {
    const { objectsFound, institution } = route.params;

    const renderItem = ({ item }) => (
        <View style={styles.item}>
            <Image
                source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                style={styles.image}
            />
            <Text style={styles.description}>{item.description}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <View style={styles.coincidencesContainer}>
                <Text style={styles.headerText}>Coincidencias en {institution.name}</Text>
                <FlatList
                    data={objectsFound}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.contentContainer}
                />
            </View>
            <View style={styles.buttonContainer}>
                <EurekappButton backgroundColor={'#f0f4f4'} textColor={'#111818'} text="Este es mi objeto" />
                <EurekappButton backgroundColor={'#fff'} textColor={'#111818'} text="No encontré mi objeto" />
            </View>
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
        padding: 10,
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
    }
})
export default FoundObjects;