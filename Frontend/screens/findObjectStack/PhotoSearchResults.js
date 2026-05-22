import React, { useState } from 'react';
import { FlatList, Image, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import EurekappButton from '../components/Button';
import Icon from 'react-native-vector-icons/FontAwesome6';
import UploadLostObjectModal from './UploadLostObjectModal';
import StarRating from '../components/StarRating';
import submitFeedback from '../../services/FeedbackService';

const PhotoSearchResults = ({ route, navigation }) => {
    const { objectsFound } = route.params;
    const results = objectsFound.slice(0, 5);
    const foundObjectsMap = new Map(results.map(obj => [obj.id, obj]));

    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [feedbackModal, setFeedbackModal] = useState(false);
    const [organizationInformationModal, setOrganizationInformationModal] = useState(false);
    const [uploadLostObjectModal, setUploadLostObjectModal] = useState(false);
    const [pendingWasFound, setPendingWasFound] = useState(null);
    const [starRating, setStarRating] = useState(0);
    const [comment, setComment] = useState('');

    const openFeedback = (wasFound) => {
        setPendingWasFound(wasFound);
        setStarRating(0);
        setComment('');
        setFeedbackModal(true);
    };

    const onFeedbackDone = async (skip = false) => {
        const shouldSubmit = pendingWasFound || (!skip && starRating > 0);
        if (shouldSubmit) {
            const selected = foundObjectsMap.get(objectSelectedId);
            const orgId = selected?.organization?.id?.toString() || null;
            try {
                await submitFeedback({
                    organizationId: orgId,
                    foundObjectUUID: pendingWasFound ? objectSelectedId : null,
                    starRating: skip ? 0 : starRating,
                    wasFound: pendingWasFound,
                    comment: skip ? null : (comment.trim() || null),
                });
            } catch (e) {
                console.warn('Error enviando feedback:', e);
            }
        }
        setFeedbackModal(false);
        if (pendingWasFound) setOrganizationInformationModal(true);
        else setUploadLostObjectModal(true);
    };

    const handleClaimConfirmed = () => {
        setOrganizationInformationModal(false);
        navigation.navigate('SearchByPhoto');
    };

    const renderItem = ({ item }) => {
        const isSelected = item.id === objectSelectedId;
        const date = new Date(item.found_date);
        return (
            <Pressable
                style={[styles.item, isSelected && styles.highlightedObjectFound]}
                onPress={() => setObjectSelectedId(item.id)}>
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
                    extraData={objectSelectedId}
                    scrollEnabled={false}
                />
            </ScrollView>
            <View style={styles.buttonContainer}>
                <EurekappButton
                    onPress={() => openFeedback(true)}
                    backgroundColor={'#f0f4f4'}
                    textColor={'#111818'}
                    text="Este es mi objeto" />
                <EurekappButton
                    onPress={() => openFeedback(false)}
                    backgroundColor={'#fff'}
                    textColor={'#111818'}
                    text="No encontré mi objeto" />
                <EurekappButton
                    text="Nueva búsqueda"
                    onPress={() => navigation.goBack()}
                    backgroundColor={'#fff'}
                    textColor={'#638888'} />
            </View>

            <UploadLostObjectModal
                modalVisible={uploadLostObjectModal}
                setModalVisible={setUploadLostObjectModal}
                query={null}
                lostDate={null}
                organizationId={null}
                coordinates={null} />

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
                onRequestClose={() => setOrganizationInformationModal(false)}>
                <View style={styles.centeredView}>
                    <View style={styles.modalView}>
                        <Icon style={styles.infoIcon} name={'circle-info'} size={32} color={'#111818'} />
                        <Text style={styles.modalText}>
                            Para recuperar tu objeto, ponte en contacto con la organización que lo está custodiando:{"\n"} {"\n"}
                            {foundObjectsMap.has(objectSelectedId) ? (
                                <>
                                    {foundObjectsMap.get(objectSelectedId).organization.name}{"\n"}
                                    {foundObjectsMap.get(objectSelectedId).organization.contactData}
                                </>
                            ) : null}
                            {"\n"}{"\n"}
                            Ten en cuenta que, por motivos de seguridad, antes de devolverte el objeto, personal del lugar te solicitará algunos datos personales y de contacto, y te tomarán una foto.
                        </Text>
                        <EurekappButton text='Cerrar' onPress={handleClaimConfirmed} />
                    </View>
                </View>
            </Modal>
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
    highlightedObjectFound: {
        backgroundColor: '#19e6e6',
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
    buttonContainer: {
        flexDirection: 'column',
        alignItems: 'center',
        width: '100%',
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
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    modalText: {
        marginBottom: 15,
        textAlign: 'left',
        fontFamily: 'PlusJakartaSans-Regular',
    },
    infoIcon: {
        marginBottom: 50,
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
