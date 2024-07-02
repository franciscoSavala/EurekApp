import {FlatList, Image, StyleSheet, Text, View} from "react-native";
import EurekappButton from "./components/Button";


const FoundObjects = ({ route }) => {
    const renderItem = ({ item }) => (
        <View style={styles.item}>
            <Text style={styles.description}>{item.description}</Text>
            <Text>Probabilidad: {item.score}</Text>
            {item.b64Json && (
                <Image
                    source={{ uri: `data:image/jpeg;base64,${item.b64Json}` }}
                    style={styles.image}
                />
            )}
        </View>
    );
    const ItemSeparator = () => (
        <View style={styles.separator} />
    );

    return (
        <View style={styles.container}>
            <View>Coincidencias en {establecimiento}</View>
            <FlatList
                data={objectsFound}
                keyExtractor={(item) => item.id.toString()}
                renderItem={renderItem}
                ItemSeparatorComponent={ItemSeparator}
                contentContainerStyle={styles.list}
            />
            <EurekappButton text="Este es mi objeto" />
            <EurekappButton text="No encontré mi objeto" />
        </View>
    );
}

const styles = StyleSheet.create({
    item: {
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#ccc',
    },
    separator: {
        height: 10,
    },
    list: {
        flexGrow: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    description: {
        fontSize: 16,
        fontWeight: 'bold',
    }
})
export default FoundObjects;