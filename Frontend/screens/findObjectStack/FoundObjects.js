import React, {useState} from "react";

import {FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View, Platform} from "react-native";
import Toast from 'react-native-toast-message';
import EurekappButton from "../components/Button";
import Icon from "react-native-vector-icons/FontAwesome6";
import UploadLostObjectModal from "./UploadLostObjectModal";
import StarRating from "../components/StarRating";
import submitFeedback from "../../services/FeedbackService";
import { CATEGORY_LABELS } from "../../utils/constants";
import { formatDateTimeES } from "../../utils/dateFormatter";
import AppImage from "../components/AppImage";
import BaseModal from "../components/BaseModal";


const FoundObjects = ({ route, navigation }) => {
    // EU-326: única pantalla de resultados para las dos búsquedas.
    // EU-337: el porcentaje y la categoría se muestran vengan de donde vengan. Antes eran exclusivos
    // de la búsqueda con foto porque el puntaje de texto vivía en otra escala y la búsqueda sin foto
    // no deducía ninguna categoría; ahora cada modo tiene su umbral calibrado, así que un mismo
    // porcentaje significa lo mismo en las dos, y la categoría la deduce la IA también del texto.
    // EU-345: `fromNotification` marca que no se llegó acá por una búsqueda en vivo sino desde el
    // aviso de "coincidencia encontrada". Es una sola coincidencia, ya la trae el aviso, y el
    // usuario YA tiene su búsqueda guardada: por eso cambian el pie de pantalla y la vuelta atrás.
    // Por defecto es false, así el camino de la búsqueda en vivo queda igual que antes.
    const { objectsFound, query, lostDate, latitude, longitude, organizationId,
            filterColor, filterLostDateTo, searchMode, aiCategory, photo,
            fromNotification = false } = route.params;
    const coordinates = (latitude != null && longitude != null)
        ? { latitude, longitude }
        : null;
    const [objectSelectedId, setObjectSelectedId] = useState("");
    const [organizationInformationModal, setOrganizationInformationModal] = useState(false);
    const [uploadLostObjectModal, setUploadLostObjectModal] = useState(false);
    const [feedbackModal, setFeedbackModal] = useState(false);
    const [pendingWasFound, setPendingWasFound] = useState(null);
    const [starRating, setStarRating] = useState(0);
    const [comment, setComment] = useState('');
    const foundObjectsMap = new Map(objectsFound.map(obj => [obj.id, obj]))

    const openFeedback = (wasFound) => {
        if (wasFound && !objectSelectedId) {
            Toast.show({ type: 'info', text1: 'Seleccioná tu objeto', text2: 'Tocá la coincidencia que es tuya antes de continuar.' });
            return;
        }
        setPendingWasFound(wasFound);
        setStarRating(0);
        setComment('');
        setFeedbackModal(true);
    };

    const onFeedbackDone = async (skip = false) => {
        const shouldSubmit = pendingWasFound || (!skip && starRating > 0);
        if (shouldSubmit) {
            const selected = foundObjectsMap.get(objectSelectedId);
            const orgId = selected?.organization?.id?.toString() || organizationId || null;
            try {
                await submitFeedback({
                    organizationId: orgId,
                    foundObjectUUID: pendingWasFound ? objectSelectedId : null,
                    starRating: skip ? 0 : starRating,
                    wasFound: pendingWasFound,
                    comment: skip ? null : (comment.trim() || null),
                    lostObjectText: query || null,
                });
            } catch (e) {
                console.warn('Error enviando feedback:', e);
            }
        }
        setFeedbackModal(false);
        if (pendingWasFound) setOrganizationInformationModal(true);
        // EU-345: viniendo del aviso no se ofrece guardar una búsqueda. El usuario ya tiene una
        // guardada —es justamente la que disparó el aviso—; proponerle otra igual no tiene sentido.
        else if (fromNotification) navigation.goBack();
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
        return (
            <Pressable style={[styles.item, isSelected && styles.highlightedObjectFound]}
                       onPress={() => setObjectSelectedId(item.id)}>
                <View style={styles.itemTextContainer}>
                    <Text style={[styles.itemText, {fontFamily: 'PlusJakartaSans-Bold'}]}>
                        {item.title}
                    </Text>

                    {item.score != null && (
                        <Text style={styles.itemText}>
                            Coincidencia: {(item.score * 100).toFixed(0)}%
                        </Text>
                    )}
                    {/* La descripción del hallazgo es lo que permite reconocer el objeto propio (el DNI,
                        el nombre, las marcas); el título solo es demasiado genérico. */}
                    {item.humanDescription ? (
                        <Text style={styles.itemDescription} numberOfLines={4}>
                            {item.humanDescription}
                        </Text>
                    ) : null}
                    <Text></Text>
                    {/* La distancia se mide contra el punto desde el que se buscó. Viniendo del aviso
                        no hay tal punto y `distance` llega vacía, que sin este resguardo imprimía
                        "a NaN km". */}
                    <Text style={styles.itemText}>
                        Encontrado el {formatDateTimeES(item.found_date)}
                        {item.distance != null ? `, a ${(item.distance / 1000).toFixed(2)} km` : ''}
                    </Text>
                </View>
                <AppImage
                    imageUrl={item.imageUrl}
                    style={styles.image}
                    resizeMode="cover"
                    accessibilityLabel="Imagen del objeto encontrado"
                />
            </Pressable>
        );
    };

    const handleClaimConfirmed = () => {
        setOrganizationInformationModal(false);
        // EU-345: 'FindObject' no existe en el stack de notificaciones, así que desde el aviso se
        // vuelve atrás y el usuario queda en su lista de notificaciones.
        if (fromNotification) navigation.goBack();
        else navigation.navigate('FindObject');
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.coincidencesContainer}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Text style={styles.backButtonText}>← Volver</Text>
                </TouchableOpacity>
                <Text style={styles.headerText}>Coincidencias encontradas</Text>
                {aiCategory && (
                    /* Categoría deducida por la IA (del texto, o de la foto si el texto no alcanza):
                       se muestra read-only, el usuario no la elige. Puede no venir: si ninguna de las
                       dos señales alcanza, la búsqueda no se acota por categoría y no hay nada que mostrar. */
                    <View style={styles.activeFiltersRow}>
                        <View style={styles.filterChip}>
                            <Text style={styles.filterChipText}>
                                Categoría detectada: {CATEGORY_LABELS[aiCategory] || aiCategory}
                            </Text>
                        </View>
                    </View>
                )}
                {(filterColor || filterLostDateTo) && (
                    <View style={styles.activeFiltersRow}>
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
                                text={fromNotification ? "No es mi objeto" : "No encontré mi objeto"} />
            </View>
            {!fromNotification && (
                <UploadLostObjectModal modalVisible={uploadLostObjectModal}
                                       setModalVisible={setUploadLostObjectModal}
                                       query={query}
                                       lostDate={lostDate}
                                       organizationId={organizationId}
                                       coordinates={coordinates}
                                       photo={photo}/>
            )}
            {/* Modal de feedback */}
            <BaseModal visible={feedbackModal} onClose={() => onFeedbackDone(true)}>
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
            </BaseModal>

            <BaseModal
                visible={organizationInformationModal}
                onClose={() => setOrganizationInformationModal(!organizationInformationModal)}>
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
                                        onPress={handleClaimConfirmed}/>
            </BaseModal>
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
        // minHeight y no height: la descripción hace crecer la tarjeta en vez de desbordarla.
        minHeight: 150,
        paddingVertical: 20,
        backgroundColor: '#f0f4f4',
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 20,
        gap: 16,
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
    itemDescription: {
        color: '#638888',
        fontSize: 13,
        lineHeight: 18,
        marginTop: 6,
        marginBottom: 2,
        fontFamily: 'PlusJakartaSans-Regular',
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