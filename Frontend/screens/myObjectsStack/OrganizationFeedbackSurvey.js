import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import Toast from 'react-native-toast-message';
import Constants from 'expo-constants';
import Icon from 'react-native-vector-icons/FontAwesome6';
import useAuthFetch from '../../utils/useAuthFetch';
import StarRating from '../components/StarRating';

const BACK_URL = Constants.expoConfig.extra.backUrl;

/* EU-366: la organización se califica DESPUÉS de retirar el objeto, no en la pantalla de
 * resultados. Los cinco aspectos son separados a propósito: un promedio único le dice al
 * responsable que algo anda mal, pero no qué corregir. */
const ASPECTS = [
    { key: 'staffTreatment',      label: 'Trato del personal' },
    { key: 'waitingTime',         label: 'Tiempo de espera' },
    { key: 'instructionsClarity', label: 'Claridad de las indicaciones' },
    { key: 'objectCondition',     label: 'Estado en que recibiste el objeto' },
    { key: 'pickupSecurity',      label: 'Seguridad del retiro' },
];

const EMPTY_RATINGS = ASPECTS.reduce((acc, a) => ({ ...acc, [a.key]: 0 }), {});

/**
 * EU-374: sólo se llega acá por el enlace del correo que recibe quien retiró su objeto. La pantalla
 * no figura en ningún menú: la ruta existe, pero está oculta del drawer.
 */
const OrganizationFeedbackSurvey = ({ route, navigation }) => {
    /* EU-374: el enlace del correo trae un token opaco, no el id de la devolución. El id es
     * secuencial: quedaría a la vista en la barra de direcciones y se podría tantear cambiando
     * un número. */
    const token = route?.params?.token;
    const { authFetch } = useAuthFetch();

    const [survey, setSurvey] = useState(null);
    const [ratings, setRatings] = useState(EMPTY_RATINGS);
    const [comment, setComment] = useState('');
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [sent, setSent] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        const load = async () => {
            if (!token) {
                setError('No sabemos qué retiro querés calificar. Abrí el enlace desde el correo.');
                setLoading(false);
                return;
            }
            try {
                const data = await authFetch('get', `${BACK_URL}/organization-feedback/${token}`);
                setSurvey(data);
            } catch (e) {
                setError(e?.response?.data?.message
                    || 'No pudimos abrir la encuesta. Probá de nuevo desde el enlace del correo.');
            } finally {
                setLoading(false);
            }
        };
        load();
    }, [token, authFetch]);

    const rate = (key, value) => setRatings(prev => ({ ...prev, [key]: value }));

    const allRated = ASPECTS.every(a => ratings[a.key] > 0);

    const submit = async () => {
        setSubmitting(true);
        try {
            await authFetch('post', `${BACK_URL}/organization-feedback/${token}`, {
                ...ratings,
                comment: comment.trim() || null,
            });
            setSent(true);
        } catch (e) {
            const msg = e?.response?.data?.message || 'No se pudo enviar tu calificación. Intentá de nuevo.';
            Toast.show({ type: 'error', text1: 'Error', text2: msg });
        } finally {
            setSubmitting(false);
        }
    };

    /* Se puede abandonar sin responder: la encuesta es opcional y no bloquea nada.
     *
     * "Buscar un objeto" es el inicio de quien usa la app para recuperar cosas, que es quien llega
     * acá. Pero esa pantalla no existe en el menú del personal de las organizaciones, y a esta ruta
     * se puede entrar con cualquier sesión (el rechazo lo da el backend): si no está, se cae al
     * perfil, que existe siempre. */
    const leave = () => {
        try {
            navigation.navigate('FindObjectStackScreen');
        } catch (e) {
            navigation.navigate('ProfileStackScreen');
        }
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#0d9e9e" />
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Icon name="circle-exclamation" size={40} color="#638888" />
                <Text style={styles.messageText}>{error}</Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={leave}>
                    <Text style={styles.secondaryBtnText}>Ir al inicio</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // Una devolución admite una sola calificación: si ya respondió, se le avisa.
    if (survey?.already_rated) {
        return (
            <View style={styles.centered}>
                <Icon name="circle-check" size={40} color="#0d9e9e" />
                <Text style={styles.messageTitle}>Ya calificaste esta atención</Text>
                <Text style={styles.messageText}>
                    Gracias por tu respuesta. Cada retiro se puede calificar una sola vez.
                </Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={leave}>
                    <Text style={styles.secondaryBtnText}>Ir al inicio</Text>
                </TouchableOpacity>
            </View>
        );
    }

    if (sent) {
        return (
            <View style={styles.centered}>
                <Icon name="heart" size={40} color="#0d9e9e" solid />
                <Text style={styles.messageTitle}>¡Gracias!</Text>
                <Text style={styles.messageText}>
                    Tu opinión llega al responsable de {survey?.organization_name || 'la organización'}.
                </Text>
                <TouchableOpacity style={styles.secondaryBtn} onPress={leave}>
                    <Text style={styles.secondaryBtnText}>Ir al inicio</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={styles.title}>¿Cómo te atendieron?</Text>
            <Text style={styles.subtitle}>
                Contanos cómo fue la atención en {survey?.organization_name || 'la organización'}
                {survey?.object_title ? ` al retirar ${survey.object_title}` : ''}.
            </Text>

            {ASPECTS.map(({ key, label }) => (
                <View key={key} style={styles.aspectBlock}>
                    <Text style={styles.aspectLabel}>{label}</Text>
                    <StarRating rating={ratings[key]} onRate={(v) => rate(key, v)} size={30} />
                </View>
            ))}

            <Text style={styles.aspectLabel}>Comentario (opcional)</Text>
            <TextInput
                placeholder="Contanos algo más si querés..."
                placeholderTextColor="#aaa"
                value={comment}
                onChangeText={setComment}
                multiline
                maxLength={500}
                style={styles.commentInput}
            />

            {submitting ? (
                <ActivityIndicator size="large" color="#0d9e9e" style={{ marginVertical: 16 }} />
            ) : (
                <>
                    <TouchableOpacity
                        style={[styles.primaryBtn, !allRated && styles.primaryBtnDisabled]}
                        onPress={submit}
                        disabled={!allRated}
                    >
                        <Text style={styles.primaryBtnText}>Enviar calificación</Text>
                    </TouchableOpacity>
                    {!allRated && (
                        <Text style={styles.hint}>Puntuá los cinco aspectos para poder enviar.</Text>
                    )}
                    <TouchableOpacity onPress={leave}>
                        <Text style={styles.skipText}>Ahora no</Text>
                    </TouchableOpacity>
                </>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#fff' },
    content: { padding: 20, maxWidth: 600, alignSelf: 'center', width: '100%' },
    centered: {
        flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: '#fff',
    },
    title: {
        fontSize: 22, fontWeight: 'bold', color: '#111818',
        fontFamily: 'PlusJakartaSans-Bold', marginBottom: 6,
    },
    subtitle: {
        fontSize: 14, color: '#638888', fontFamily: 'PlusJakartaSans-Regular', marginBottom: 20,
    },
    aspectBlock: { marginBottom: 18 },
    aspectLabel: {
        fontSize: 15, color: '#111818', fontFamily: 'PlusJakartaSans-Regular', marginBottom: 6,
    },
    commentInput: {
        borderWidth: 1, borderColor: '#dde8e8', borderRadius: 8, padding: 12, minHeight: 90,
        textAlignVertical: 'top', color: '#111818', marginBottom: 20,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    primaryBtn: {
        backgroundColor: '#19b8b8', borderRadius: 10, paddingVertical: 14, alignItems: 'center',
    },
    primaryBtnDisabled: { backgroundColor: '#ccc' },
    primaryBtnText: {
        color: '#fff', fontSize: 15, fontFamily: 'PlusJakartaSans-Bold', fontWeight: 'bold',
    },
    hint: {
        textAlign: 'center', color: '#638888', fontSize: 12, marginTop: 8,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    skipText: {
        textAlign: 'center', color: '#638888', fontSize: 14, marginTop: 16, marginBottom: 8,
        fontFamily: 'PlusJakartaSans-Regular',
    },
    messageTitle: {
        fontSize: 20, color: '#111818', fontFamily: 'PlusJakartaSans-Bold',
        marginTop: 12, textAlign: 'center',
    },
    messageText: {
        fontSize: 14, color: '#638888', fontFamily: 'PlusJakartaSans-Regular',
        marginTop: 8, textAlign: 'center',
    },
    secondaryBtn: {
        marginTop: 20, paddingVertical: 12, paddingHorizontal: 24,
        borderRadius: 10, backgroundColor: '#f0f4f4',
    },
    secondaryBtnText: {
        color: '#111818', fontSize: 14, fontFamily: 'PlusJakartaSans-Regular',
    },
});

export default OrganizationFeedbackSurvey;
