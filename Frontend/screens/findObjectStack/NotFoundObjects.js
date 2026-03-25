import {StyleSheet, Text, TouchableOpacity, View} from "react-native";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import UploadLostObjectModal from "./UploadLostObjectModal";
import {useState} from "react";
import StarRating from "../components/StarRating";
import submitFeedback from "../../services/FeedbackService";


const NotFoundObjects = ({route, navigation}) => {
    const { query, lostDate, coordinates, organizationId } = route.params;
    const [modalVisible, setModalVisible] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackSent, setFeedbackSent] = useState(false);

    const handleSendFeedback = async () => {
        if (feedbackRating === 0) return;
        try {
            await submitFeedback({
                organizationId: organizationId || null,
                foundObjectUUID: null,
                starRating: feedbackRating,
                wasFound: false,
            });
            setFeedbackSent(true);
        } catch (e) {
            console.warn('Error enviando feedback:', e);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.coincidencesContainer}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Volver</Text>
                </TouchableOpacity>
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
            <View style={styles.feedbackSection}>
                {feedbackSent ? (
                    <Text style={styles.feedbackThanks}>¡Gracias por tu calificación!</Text>
                ) : (
                    <>
                        <Text style={styles.feedbackLabel}>¿Qué tan útil fue la búsqueda?</Text>
                        <StarRating rating={feedbackRating} onRate={setFeedbackRating} size={28} />
                        {feedbackRating > 0 && (
                            <TouchableOpacity style={styles.feedbackBtn} onPress={handleSendFeedback}>
                                <Text style={styles.feedbackBtnText}>Enviar calificación</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}
            </View>
            <EurekappButton onPress={() => setModalVisible(true)} text="Guardar búsqueda" />
            <UploadLostObjectModal modalVisible={modalVisible}
                                   setModalVisible={setModalVisible}
                                   query={query}
                                   lostDate={lostDate}
                                   organizationId={organizationId}
                                   coordinates={coordinates}/>
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
        maxWidth:'1000px',
        alignSelf:"center"
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
    },
    backButton: {
        alignSelf: 'flex-start',
        padding: 16,
        paddingBottom: 0,
    },
    backButtonText: {
        color: '#638888',
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    feedbackSection: {
        alignItems: 'center',
        paddingVertical: 16,
        gap: 10,
    },
    feedbackLabel: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#638888',
    },
    feedbackBtn: {
        marginTop: 4,
        paddingVertical: 8,
        paddingHorizontal: 20,
        backgroundColor: '#19b8b8',
        borderRadius: 8,
    },
    feedbackBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: 'white',
    },
    feedbackThanks: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
        color: '#19b8b8',
    },
})
export default NotFoundObjects;