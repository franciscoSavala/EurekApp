import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import StarRating from './StarRating';
import submitUsabilityFeedback from '../../services/UsabilityFeedbackService';

const ASPECTS = [
    { key: 'FACILIDAD_USO', label: 'Facilidad de uso' },
    { key: 'CLARIDAD', label: 'Claridad de interfaz' },
    { key: 'TIEMPO_RESPUESTA', label: 'Tiempo de respuesta' },
    { key: 'NAVEGACION', label: 'Navegación' },
];

export default function UsabilityFeedbackModal({ visible, onClose, context }) {
    const [starRating, setStarRating] = useState(0);
    const [selectedAspects, setSelectedAspects] = useState([]);
    const [comment, setComment] = useState('');
    const [submitted, setSubmitted] = useState(false);

    useEffect(() => {
        if (visible) {
            setStarRating(0);
            setSelectedAspects([]);
            setComment('');
            setSubmitted(false);
        }
    }, [visible]);

    const toggleAspect = (key) => {
        setSelectedAspects(prev =>
            prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
        );
    };

    const handleSend = async () => {
        try {
            await submitUsabilityFeedback({
                starRating,
                aspects: selectedAspects,
                comment: comment.trim() || null,
                context: context || null,
            });
        } catch (e) {
            console.warn('Error enviando feedback de usabilidad:', e);
        }
        setSubmitted(true);
        setTimeout(() => onClose(true), 1500);
    };

    return (
        <Modal
            animationType="fade"
            transparent={true}
            visible={visible}
            onRequestClose={() => onClose(false)}>
            <View style={styles.centeredView}>
                <View style={styles.modalView}>
                    {submitted ? (
                        <Text style={styles.thanksText}>¡Gracias por tu retroalimentación!</Text>
                    ) : (
                        <>
                            <Text style={styles.title}>¿Cómo fue tu experiencia?</Text>
                            <Text style={styles.subtitle}>
                                Tu opinión nos ayuda a mejorar la aplicación.
                            </Text>
                            <StarRating rating={starRating} onRate={setStarRating} size={32} />
                            <View style={styles.aspectsRow}>
                                {ASPECTS.map(({ key, label }) => {
                                    const active = selectedAspects.includes(key);
                                    return (
                                        <TouchableOpacity
                                            key={key}
                                            style={[styles.chip, active && styles.chipActive]}
                                            onPress={() => toggleAspect(key)}>
                                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                                                {label}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                            <TextInput
                                placeholder="Comentario opcional..."
                                placeholderTextColor="#aaa"
                                value={comment}
                                onChangeText={setComment}
                                multiline
                                maxLength={500}
                                style={styles.commentInput}
                            />
                            <View style={styles.buttonsRow}>
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: '#f0f4f4' }]}
                                    onPress={() => onClose(false)}>
                                    <Text style={[styles.btnText, { color: '#638888' }]}>Omitir</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.btn, { backgroundColor: starRating > 0 ? '#19b8b8' : '#ccc' }]}
                                    onPress={handleSend}
                                    disabled={starRating === 0}>
                                    <Text style={[styles.btnText, { color: 'white' }]}>Enviar</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
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
        padding: 28,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
        width: '85%',
    },
    title: {
        fontFamily: 'PlusJakartaSans-Bold',
        fontSize: 16,
        color: '#111818',
        marginBottom: 6,
        textAlign: 'center',
    },
    subtitle: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 13,
        color: '#638888',
        marginBottom: 14,
        textAlign: 'center',
    },
    aspectsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        justifyContent: 'center',
        marginTop: 14,
        marginBottom: 4,
    },
    chip: {
        borderRadius: 16,
        paddingVertical: 5,
        paddingHorizontal: 12,
        backgroundColor: '#f0f4f4',
    },
    chipActive: {
        backgroundColor: '#e0f7f7',
    },
    chipText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 12,
        color: '#638888',
    },
    chipTextActive: {
        color: '#19b8b8',
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
    buttonsRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 20,
        width: '100%',
    },
    btn: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 8,
        alignItems: 'center',
    },
    btnText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 14,
    },
    thanksText: {
        fontFamily: 'PlusJakartaSans-Regular',
        fontSize: 15,
        color: '#19b8b8',
        textAlign: 'center',
        paddingVertical: 10,
    },
});
