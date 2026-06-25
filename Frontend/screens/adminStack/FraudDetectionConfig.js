import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axiosInstance from "../../utils/axiosInstance";
import Constants from "expo-constants";
import Icon from "react-native-vector-icons/FontAwesome6";
import Toast from "react-native-toast-message";

const BACK_URL = Constants.expoConfig.extra.backUrl;

// Los 3 parámetros configurables de la detección de fraude (back: /admin/fraud/config).
const FIELDS = [
    {
        key: "fraudThreshold",
        label: "Umbral de detección (N)",
        help: "Cantidad de devoluciones sospechosas que disparan una alerta.",
        icon: "triangle-exclamation",
    },
    {
        key: "fraudWindowDays",
        label: "Ventana de detección (días)",
        help: "Hacia atrás cuántos días se cuentan las devoluciones.",
        icon: "calendar-days",
    },
    {
        key: "blockDurationDays",
        label: "Duración del bloqueo (días)",
        help: "Cuánto dura la sanción automática una vez aplicada.",
        icon: "lock",
    },
];

const FraudDetectionConfig = () => {
    const [values, setValues] = useState({ fraudThreshold: "", fraudWindowDays: "", blockDurationDays: "" });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    const fetchConfig = async () => {
        setLoading(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.get(BACK_URL + "/admin/fraud/config", {
                headers: { Authorization: "Bearer " + jwt },
            });
            setValues({
                fraudThreshold: String(res.data.fraudThreshold),
                fraudWindowDays: String(res.data.fraudWindowDays),
                blockDurationDays: String(res.data.blockDurationDays),
            });
        } catch (e) {
            Toast.show({ type: "error", text1: "No se pudo cargar la configuración." });
        } finally {
            setLoading(false);
        }
    };

    useFocusEffect(useCallback(() => {
        fetchConfig();
    }, []));

    // Solo permite dígitos en los inputs.
    const onChange = (key, text) => {
        const onlyDigits = text.replace(/[^0-9]/g, "");
        setValues((prev) => ({ ...prev, [key]: onlyDigits }));
    };

    const save = async () => {
        // Validación cliente: enteros >= 1 (espejo de la del back).
        for (const f of FIELDS) {
            const n = parseInt(values[f.key], 10);
            if (!Number.isInteger(n) || n < 1) {
                Toast.show({ type: "error", text1: `${f.label} debe ser un número entero mayor o igual a 1.` });
                return;
            }
        }
        setSaving(true);
        try {
            const jwt = await AsyncStorage.getItem("jwt");
            const res = await axiosInstance.put(
                BACK_URL + "/admin/fraud/config",
                {
                    fraudThreshold: parseInt(values.fraudThreshold, 10),
                    fraudWindowDays: parseInt(values.fraudWindowDays, 10),
                    blockDurationDays: parseInt(values.blockDurationDays, 10),
                },
                { headers: { Authorization: "Bearer " + jwt } }
            );
            setValues({
                fraudThreshold: String(res.data.fraudThreshold),
                fraudWindowDays: String(res.data.fraudWindowDays),
                blockDurationDays: String(res.data.blockDurationDays),
            });
            Toast.show({ type: "success", text1: "Configuración guardada correctamente." });
        } catch (e) {
            const msg = e?.response?.data?.message || "No se pudo guardar la configuración.";
            Toast.show({ type: "error", text1: msg });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <View style={[styles.container, styles.centered]}>
                <ActivityIndicator size="large" color="#4A9999" />
            </View>
        );
    }

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <ScrollView contentContainerStyle={styles.content}>
                <Text style={styles.intro}>
                    Parámetros globales de la detección automática de fraude en devoluciones.
                    Aplican a todas las organizaciones.
                </Text>

                {FIELDS.map((f) => (
                    <View key={f.key} style={styles.card}>
                        <View style={styles.labelRow}>
                            <Icon name={f.icon} size={13} color="#4A9999" />
                            <Text style={styles.label}>{f.label}</Text>
                        </View>
                        <Text style={styles.help}>{f.help}</Text>
                        <TextInput
                            style={styles.input}
                            value={values[f.key]}
                            onChangeText={(t) => onChange(f.key, t)}
                            keyboardType="number-pad"
                            placeholder="1"
                            placeholderTextColor="#A8C0C0"
                            maxLength={5}
                        />
                    </View>
                ))}

                <TouchableOpacity
                    style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
                    onPress={save}
                    disabled={saving}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#fff" />
                    ) : (
                        <Text style={styles.saveBtnText}>Guardar cambios</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#f4f7f7" },
    centered: { justifyContent: "center", alignItems: "center" },
    content: { padding: 16, paddingBottom: 48 },
    intro: {
        fontSize: 13, fontFamily: "PlusJakartaSans-Regular",
        color: "#638888", marginBottom: 16, lineHeight: 19,
    },
    card: {
        backgroundColor: "#fff", borderRadius: 14,
        padding: 16, marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06,
        shadowRadius: 4, elevation: 2,
    },
    labelRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
    label: { fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434" },
    help: { fontSize: 12, fontFamily: "PlusJakartaSans-Regular", color: "#638888", marginBottom: 10 },
    input: {
        borderWidth: 1, borderColor: "#dde8e8", borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10,
        fontSize: 15, fontFamily: "PlusJakartaSans-Regular", color: "#1A3434",
        backgroundColor: "#fafcfc",
    },
    saveBtn: {
        backgroundColor: "#4A9999", borderRadius: 12,
        paddingVertical: 14, alignItems: "center", marginTop: 8,
    },
    saveBtnDisabled: { opacity: 0.6 },
    saveBtnText: { color: "#fff", fontSize: 15, fontFamily: "PlusJakartaSans-Bold" },
});

export default FraudDetectionConfig;
