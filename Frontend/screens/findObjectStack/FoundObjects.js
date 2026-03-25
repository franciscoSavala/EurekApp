import React, {useState} from "react";

import {FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform} from "react-native";
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import UploadLostObjectModal from "./UploadLostObjectModal";
import StarRating from "../components/StarRating";
import submitFeedback from "../../services/FeedbackService";

const CATEGORY_LABELS = {
    ELECTRONICA: 'Electrónica', ROPA: 'Ropa', DOCUMENTOS: 'Documentos',
    LLAVES: 'Llaves', ACCESORIOS: 'Accesorios', OTROS: 'Otros',
};


const FoundObjects = ({ route, navigation }) => {
    const { objectsFound, query, lostDate, coordinates, organizationId, filterCategory, filterColor, filterLostDateTo } = route.params;
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [organizationInformationModal, setOrganizationInformationModal] = useState(false);
    const [uploadLostObjectModal, setUploadLostObjectModal] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState(false);
    const [pendingWasFound, setPendingWasFound] = useState(null);
    const [starRating, setStarRating] = useState(0);
    const [comment, setComment] = useState('');
    const foundObjectsMap = new Map(objectsFound.map(obj => [obj.id, obj]))

    const openFeedback = (wasFound) => {
        setPendingWasFound(wasFound);
        setStarRating(0);
        setComment('');
        setFeedbackModal(true);
    };

    const onFeedbackDone = async (skip = false) => {
        if (!skip && starRating > 0) {
            const selected = foundObjectsMap.get(objectSelectedId);
            const orgId = selected?.organization?.id?.toString() || organizationId || null;
            try {
                await submitFeedback({
                    organizationId: orgId,
                    foundObjectUUID: pendingWasFound ? objectSelectedId : null,
                    starRating,
                    wasFound: pendingWasFound,
                    comment: comment.trim() || null,
                });
            } catch (e) {
                console.warn('Error enviando feedback:', e);
            }
        }
        setFeedbackModal(false);
        if (pendingWasFound) setOrganizationInformationModal(true);
        else setUploadLostObjectModal(true);
    };

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
                        Puntaje: {(item.score * 100).toFixed(2)}%
                    </Text>
                    <Text></Text>
                    <Text style={styles.itemText}>
                        Encontrado el {date.getDate()}/{date.getMonth() + 1}/{date.getFullYear()} a las {date.toLocaleTimeString()}, a {(item.distance / 1000).toFixed(2)} km
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
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={styles.headerText}>Coincidencias encontradas</Text>
                {(filterCategory || filterColor || filterLostDateTo) && (
                    <View style={styles.activeFiltersRow}>
                        {filterCategory && (
                            <View style={styles.filterChip}>
                                <Text style={styles.filterChipText}>{CATEGORY_LABELS[filterCategory] || filterCategory}</Text>
                            </View>
                        )}
                        {filterColor ? (
                            <View style={styles.filterChip}>
                                <Text style={styles.filterChipText}>{filterColor}</Text>
                            </View>
                        ) : null}
                        {filterLostDateTo && (
                            <View style={styles.filterChip}>
                                <Text style={styles.filterChipText}>hasta {new Date(filterLostDateTo).toISOString().split('T')[0]}</Text>
                            </View>
                        )}
                        <TouchableOpacity style={styles.clearFilterBtn}
                            onPress={() => navigation.navigate('FindObject', { reset: true })}>
                            <Text style={styles.clearFilterBtnText}>Limpiar filtros</Text>
                        </TouchableOpacity>
                    </View>
                )}
                <FlatList
                    data={objectsFound}
                    keyExtractor={(item) => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={styles.contentContainer}
                    extraData={objectSelectedId}
                />
            </ScrollView>
            <View style={styles.buttonContainer}>
                <EurekappButton onPress={() => openFeedback(true)}
                                backgroundColor={'#f0f4f4'}
                                textColor={'#111818'}
                                text="Este es mi objeto" />
                <EurekappButton onPress={() => openFeedback(false)}
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
            {/* Modal de feedback */}
            <Modal
                animationType="fade"
                transparent={true}
                visible={feedbackModal}
                onRequestClose={() => onFeedbackDone(true)}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Text style={[styles.modalText, { fontFamily: 'PlusJakartaSans-Bold', fontSize: 16, marginBottom: 6 }]}>
                            ¿Qué tan útiles fueron las coincidencias?
                        </Text>
                        <Text style={[styles.modalText, { color: '#638888', fontSize: 13 }]}>
                            Tu calificación nos ayuda a mejorar los resultados.
                        </Text>
                        <StarRating rating={starRating} onRate={setStarRating} size={32} />
                        <TextInput
                            placeholder="Comentario opcional..."
                            placeholderTextColor="#aaa"
                            value={comment}
                            onChangeText={setComment}
                            multiline
                            maxLength={500}
                            style={styles.commentInput}
                        />
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                            <TouchableOpacity
                                style={[styles.feedbackBtn, { backgroundColor: '#f0f4f4' }]}
                                onPress={() => onFeedbackDone(true)}>
                                <Text style={[styles.feedbackBtnText, { color: '#638888' }]}>Omitir</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.feedbackBtn, { backgroundColor: starRating > 0 ? '#19b8b8' : '#ccc' }]}
                                onPress={() => onFeedbackDone(false)}
                                disabled={starRating === 0}>
                                <Text style={[styles.feedbackBtnText, { color: 'white' }]}>Enviar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

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
    activeFiltersRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        paddingHorizontal: 10,
        marginBottom: 8,
        alignItems: 'center',
    },
    filterChip: {
        backgroundColor: '#e0f7f7',
        borderRadius: 16,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    filterChipText: {
        fontSize: 12,
        color: '#19b8b8',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    clearFilterBtn: {
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 16,
        backgroundColor: '#f0f4f4',
    },
    clearFilterBtnText: {
        fontSize: 12,
        color: '#638888',
        fontFamily: 'PlusJakartaSans-Regular',
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
    feedbackBtn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    feedbackBtnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
    },
    commentInput: {
        marginTop: 12,
        width: '100%',
        borderWidth: 1,
        borderColor: '#e0e8e8',
        borderRadius: 8,
        padding: 10,
        fontSize: 14,
        fontFamily: 'PlusJakartaSans-Regular',
        color: '#111818',
        minHeight: 60,
        textAlignVertical: 'top',
    },
})
export default FoundObjects;