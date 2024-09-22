import {FlatList, Image, StyleSheet, Text, View} from "react-native";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import UploadLostObjectModal from "./UploadLostObjectModal";
import {useState} from "react";


const NotFoundObjects = ({route, navigation}) => {
    const { query } = route.params;
    const [modalVisible, setModalVisible] = useState(false);

    return (
        <View style={styles.container}>
            <View style={styles.coincidencesContainer}>
                <Text style={styles.headerText}>No se encontraron coincidencias para tu búsqueda.</Text>
                <View style={styles.prettyNotFoundContainer}>
                    <View style={styles.prettyCardNotFound}>
                        <View style={styles.magnifyingIcon}>
                            <Icon name={'magnifying-glass'} size={24} color={'#111818'} />
                        </View>
                        <View style={styles.labelPrettyNotFound}>
                            <Text style={styles.prettyTitleNotFound} >Puede que tu objeto no haya sido encontrado todavía.
                            </Text>
                            <Text style={styles.prettyDescriptionNotFound}>Revisa de nuevo otro día.</Text>
                        </View>
                    </View>
                </View>
            </View>
            <EurekappButton onPress={() => setModalVisible(true)} text="Guardar búsqueda" />
            <UploadLostObjectModal modalVisible={modalVisible}
                                   setModalVisible={setModalVisible}
                                   query={query} />
        </View>
    );
}

const styles = StyleSheet.create({
    prettyCardNotFound: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        width: '100%',
        alignItems: 'center',
    },
    prettyNotFoundContainer: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'flex-start',
        width: '100%',
    },
    magnifyingIcon: {
        justifyContent: "center",
        alignItems: "center",
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
        fontSize: 16, // text-base in Tailwind is typically 16px
        fontWeight: '500', // font-medium
        lineHeight: 22, // leading-normal, you may adjust this based on your needs
        marginBottom: 4,
    },
    prettyDescriptionNotFound: {
        color: '#638888',
        fontSize: 14, // text-sm in Tailwind is typically 14px
        fontWeight: '400', // font-normal
        lineHeight: 20,
    },
    container: {
        flex: 1,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
        backgroundColor: '#fff',
    },
    coincidencesContainer: {
        flexDirection: 'column',
        flex: 1,
        width: '100%',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
    },
    headerText: {
        color: '#111818', // equivalent to text-[#111818]
        fontSize: 22, // equivalent to text-[22px]
        fontFamily: 'PlusJakartaSans-Bold',
        paddingLeft: 10,
    },
    buttonContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
    }
})
export default NotFoundObjects;