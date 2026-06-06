import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import Icon from "react-native-vector-icons/FontAwesome6";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import useAuthFetch from "../../utils/useAuthFetch";
import EurekappButton from "../components/Button";
import MapViewComponent from "../components/MapViewComponent";

const BACK_URL = Constants.expoConfig.extra.backUrl;

const ORG_TYPES = [
    { label: "Seleccioná un tipo...", value: "" },
    { label: "Universidad", value: "UNIVERSITY" },
    { label: "Colegio", value: "SCHOOL" },
    { label: "Hospital", value: "HOSPITAL" },
    { label: "Empresa", value: "CORPORATE_OFFICE" },
    { label: "Municipalidad", value: "CITY_HALL" },
    { label: "Club", value: "CLUB" },
    { label: "Gimnasio", value: "GYM" },
    { label: "Estadio", value: "STADIUM" },
    { label: "Aeropuerto", value: "AIRPORT" },
    { label: "Terminal de ómnibus", value: "BUS_TERMINAL" },
    { label: "Hotel", value: "HOTEL" },
    { label: "Shopping", value: "SHOPPING" },
    { label: "Restaurante", value: "RESTAURANT" },
    { label: "Evento/Festival", value: "EVENT" },
    { label: "Otro", value: "OTHER" },
];

const ERROR_MESSAGES = {
    request_already_pending: "Ya tenés una solicitud pendiente de aprobación.",
    custom_type_required: 'Debés especificar el tipo cuando seleccionás "Otro".',
    owner_email_already_in_use: "El correo del responsable ya está asociado a otra organización.",
    forbidden: "Solo usuarios regulares pueden realizar esta solicitud.",
    province_not_supported: "Solo se aceptan organizaciones de Córdoba, Argentina por el momento.",
    country_not_supported: "Solo se aceptan organizaciones de Argentina por el momento.",
};

const DEFAULT_COORDS = { latitude: -31.4201, longitude: -64.1888 };
const TOTAL_STEPS = 5;

const STEP_TITLES = [
    "Organización",
    "Dirección",
    "Ubicación en el mapa",
    "Responsable",
    "Motivo y confirmación",
];

const OrganizationSignupForm = () => {
    const { authFetch } = useAuthFetch();
    const [step, setStep] = useState(1);
    const [requesterEmail, setRequesterEmail] = useState("");

    // Step 1
    const [organizationName, setOrganizationName] = useState("");
    const [organizationType, setOrganizationType] = useState("");
    const [customOrganizationType, setCustomOrganizationType] = useState("");
    // Step 2
    const [street, setStreet] = useState("");
    const [streetNumber, setStreetNumber] = useState("");
    const [city, setCity] = useState("");
    // Step 3
    const [objectMarker, setObjectMarker] = useState(DEFAULT_COORDS);
    const [locationSelected, setLocationSelected] = useState(false);
    // Step 4
    const [ownerFirstName, setOwnerFirstName] = useState("");
    const [ownerLastName, setOwnerLastName] = useState("");
    const [ownerEmail, setOwnerEmail] = useState("");
    const [ownerPhone, setOwnerPhone] = useState("");
    // Step 5
    const [reason, setReason] = useState("");

    const [fieldErrors, setFieldErrors] = useState({});
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [responseOk, setResponseOk] = useState(false);
    const [errorMessage, setErrorMessage] = useState("");

    useEffect(() => {
        AsyncStorage.getItem("username").then((val) => { if (val) setRequesterEmail(val); });
    }, []);

    const handleMarkerChange = (coords) => {
        setObjectMarker(coords);
        setLocationSelected(true);
    };

    const validateStep = (s) => {
        const errors = {};
        if (s === 1) {
            if (!organizationName.trim()) errors.organizationName = "El nombre es obligatorio.";
            if (!organizationType) errors.organizationType = "El tipo de organización es obligatorio.";
            if (organizationType === "OTHER" && !customOrganizationType.trim())
                errors.customOrganizationType = 'Debés especificar el tipo cuando seleccionás "Otro".';
        }
        if (s === 2) {
            if (!street.trim()) errors.street = "La calle es obligatoria.";
            if (!streetNumber.trim()) errors.streetNumber = "La altura es obligatoria.";
            if (!city.trim()) errors.city = "La ciudad es obligatoria.";
        }
        if (s === 3) {
            if (!locationSelected) errors.location = "Debés seleccionar la ubicación en el mapa.";
        }
        if (s === 4) {
            if (!ownerFirstName.trim()) errors.ownerFirstName = "El nombre es obligatorio.";
            if (!ownerLastName.trim()) errors.ownerLastName = "El apellido es obligatorio.";
            if (!ownerEmail.trim()) errors.ownerEmail = "El correo es obligatorio.";
            else if (!/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(ownerEmail))
                errors.ownerEmail = "El correo no es válido.";
            if (!ownerPhone.trim()) errors.ownerPhone = "El teléfono es obligatorio.";
        }
        if (s === 5) {
            if (!reason.trim()) errors.reason = "El motivo es obligatorio.";
        }
        return errors;
    };

    const goNext = () => {
        const errors = validateStep(step);
        if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
        setFieldErrors({});
        setStep(s => s + 1);
    };

    const goBack = () => { setFieldErrors({}); setStep(s => s - 1); };

    const onSubmit = async () => {
        const errors = validateStep(5);
        if (Object.keys(errors).length > 0) { setFieldErrors(errors); return; }
        setFieldErrors({});
        setErrorMessage("");
        setLoading(true);
        setSubmitted(true);
        try {
            await authFetch("post", `${BACK_URL}/organizations`, {
                organizationName,
                organizationType,
                customOrganizationType: organizationType === "OTHER" ? customOrganizationType : undefined,
                street,
                streetNumber,
                city,
                province: "Córdoba",
                country: "Argentina",
                latitude: objectMarker.latitude,
                longitude: objectMarker.longitude,
                ownerFirstName,
                ownerLastName,
                ownerEmail,
                ownerPhone,
                reason,
            });
            setResponseOk(true);
        } catch (error) {
            setResponseOk(false);
            const code = error?.response?.data?.error;
            setErrorMessage(ERROR_MESSAGES[code] || "Ocurrió un error. Intentá nuevamente.");
        } finally {
            setLoading(false);
        }
    };

    const FieldError = ({ field }) =>
        fieldErrors[field] ? <Text style={styles.textError}>{fieldErrors[field]}</Text> : null;
    const Label = ({ text }) => <Text style={styles.label}>{text}</Text>;

    // ── Progreso ───────────────────────────────────────────────────────────────
    const StepIndicator = () => (
        <View style={styles.stepIndicator}>
            {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <React.Fragment key={i}>
                    <View style={[styles.stepDot, i + 1 <= step && styles.stepDotActive]}>
                        {i + 1 < step
                            ? <Icon name="check" size={10} color="#fff" />
                            : <Text style={[styles.stepDotText, i + 1 <= step && styles.stepDotTextActive]}>{i + 1}</Text>
                        }
                    </View>
                    {i < TOTAL_STEPS - 1 && (
                        <View style={[styles.stepLine, i + 1 < step && styles.stepLineActive]} />
                    )}
                </React.Fragment>
            ))}
        </View>
    );

    // ── Contenido por paso ────────────────────────────────────────────────────
    const renderStep = () => {
        switch (step) {
            case 1:
                return (
                    <>
                        <Label text="Nombre de la organización *" />
                        <TextInput
                            style={styles.input}
                            placeholder="Nombre"
                            placeholderTextColor="#638888"
                            value={organizationName}
                            onChangeText={setOrganizationName}
                        />
                        <FieldError field="organizationName" />

                        <Label text="Tipo de organización *" />
                        <View style={styles.pickerContainer}>
                            <Picker
                                selectedValue={organizationType}
                                onValueChange={setOrganizationType}
                                style={styles.picker}
                            >
                                {ORG_TYPES.map(t => (
                                    <Picker.Item key={t.value} label={t.label} value={t.value} />
                                ))}
                            </Picker>
                        </View>
                        <FieldError field="organizationType" />

                        {organizationType === "OTHER" && (
                            <>
                                <Label text="Especificá el tipo *" />
                                <TextInput
                                    style={styles.input}
                                    placeholder="Tipo personalizado"
                                    placeholderTextColor="#638888"
                                    value={customOrganizationType}
                                    onChangeText={setCustomOrganizationType}
                                />
                                <FieldError field="customOrganizationType" />
                            </>
                        )}
                    </>
                );

            case 2:
                return (
                    <>
                        <Label text="Calle *" />
                        <TextInput style={styles.input} placeholder="Av. Colón" placeholderTextColor="#638888"
                            value={street} onChangeText={setStreet} />
                        <FieldError field="street" />

                        <Label text="Número *" />
                        <TextInput style={styles.input} placeholder="1234" placeholderTextColor="#638888"
                            value={streetNumber} onChangeText={setStreetNumber} keyboardType="numeric" />
                        <FieldError field="streetNumber" />

                        <Label text="Ciudad *" />
                        <TextInput style={styles.input} placeholder="Córdoba Capital" placeholderTextColor="#638888"
                            value={city} onChangeText={setCity} />
                        <FieldError field="city" />

                        <Label text="Provincia" />
                        <TextInput style={[styles.input, styles.readOnly]} value="Córdoba" editable={false} />

                        <Label text="País" />
                        <TextInput style={[styles.input, styles.readOnly]} value="Argentina" editable={false} />

                        <View style={styles.restrictionBadge}>
                            <Icon name="map-pin" size={13} color="#4A9999" />
                            <Text style={styles.restrictionText}>
                                Por el momento solo aceptamos organizaciones de Córdoba, Argentina.
                            </Text>
                        </View>
                    </>
                );

            case 3:
                return (
                    <>
                        <Text style={styles.hint}>
                            Arrastrá el marcador para indicar la ubicación exacta.
                        </Text>
                        <MapViewComponent
                            objectMarker={objectMarker}
                            setObjectMarker={handleMarkerChange}
                            labelText=""
                            markerIsDraggable={true}
                        />
                        {locationSelected ? (
                            <Text style={styles.coordsText}>
                                📍 {objectMarker.latitude.toFixed(5)}, {objectMarker.longitude.toFixed(5)}
                            </Text>
                        ) : (
                            <Text style={styles.hint}>Mové el marcador para confirmar la ubicación.</Text>
                        )}
                        <FieldError field="location" />
                    </>
                );

            case 4:
                return (
                    <>
                        <Label text="Nombre del responsable *" />
                        <TextInput style={styles.input} placeholder="Juan" placeholderTextColor="#638888"
                            value={ownerFirstName} onChangeText={setOwnerFirstName} />
                        <FieldError field="ownerFirstName" />

                        <Label text="Apellido *" />
                        <TextInput style={styles.input} placeholder="Pérez" placeholderTextColor="#638888"
                            value={ownerLastName} onChangeText={setOwnerLastName} />
                        <FieldError field="ownerLastName" />

                        <Label text="Correo electrónico del responsable *" />
                        <TextInput style={styles.input} placeholder="responsable@org.com" placeholderTextColor="#638888"
                            value={ownerEmail} onChangeText={setOwnerEmail}
                            keyboardType="email-address" autoComplete="email" />
                        <FieldError field="ownerEmail" />

                        <Label text="Teléfono *" />
                        <TextInput style={styles.input} placeholder="+54 9 351 000 0000" placeholderTextColor="#638888"
                            value={ownerPhone} onChangeText={setOwnerPhone} keyboardType="phone-pad" />
                        <FieldError field="ownerPhone" />
                    </>
                );

            case 5:
                return (
                    <>
                        <Label text="¿Por qué querés unirte a EurekApp? *" />
                        <TextInput
                            style={[styles.input, styles.multiline]}
                            placeholder="Contanos el motivo de tu solicitud..."
                            placeholderTextColor="#638888"
                            value={reason}
                            onChangeText={setReason}
                            multiline
                            numberOfLines={5}
                            textAlignVertical="top"
                        />
                        <FieldError field="reason" />

                        <View style={styles.summaryBox}>
                            <Text style={styles.summaryTitle}>Resumen de la solicitud</Text>
                            <Text style={styles.summaryLine}>🏢 {organizationName}</Text>
                            <Text style={styles.summaryLine}>📍 {street} {streetNumber}, {city}, Córdoba, Argentina</Text>
                            <Text style={styles.summaryLine}>👤 {ownerFirstName} {ownerLastName} — {ownerEmail}</Text>
                            <Text style={styles.summaryLine}>📧 Solicitante: {requesterEmail}</Text>
                        </View>

                        {submitted && (
                            <View style={styles.statusContainer}>
                                {loading ? (
                                    <ActivityIndicator size="large" color="#111818" />
                                ) : responseOk ? (
                                    <>
                                        <Icon name="circle-check" size={50} color="#008000" />
                                        <Text style={styles.successText}>
                                            Tu solicitud fue enviada correctamente. Te notificaremos cuando sea revisada.
                                        </Text>
                                    </>
                                ) : (
                                    <>
                                        <Icon name="circle-xmark" size={50} color="#ED4337" />
                                        <Text style={styles.errorText}>{errorMessage}</Text>
                                    </>
                                )}
                            </View>
                        )}
                    </>
                );

            default:
                return null;
        }
    };

    return (
        <View style={styles.container}>
            <StepIndicator />
            <Text style={styles.stepTitle}>{STEP_TITLES[step - 1]}</Text>

            <ScrollView
                style={styles.scrollArea}
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
            >
                {renderStep()}
            </ScrollView>

            <View style={styles.navRow}>
                {step > 1 && !responseOk && (
                    <TouchableOpacity style={styles.backButton} onPress={goBack}>
                        <Icon name="arrow-left" size={14} color="#4A9999" />
                        <Text style={styles.backButtonText}>Anterior</Text>
                    </TouchableOpacity>
                )}
                {step < TOTAL_STEPS && (
                    <View style={{ flex: 1, marginLeft: step > 1 ? 12 : 0 }}>
                        <EurekappButton text="Siguiente" onPress={goNext} />
                    </View>
                )}
                {step === TOTAL_STEPS && !responseOk && (
                    <View style={{ flex: 1, marginLeft: step > 1 ? 12 : 0 }}>
                        <EurekappButton text="Enviar solicitud" onPress={onSubmit} />
                    </View>
                )}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: "#fff" },
    stepIndicator: {
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8,
    },
    stepDot: {
        width: 28, height: 28, borderRadius: 14,
        borderWidth: 2, borderColor: "#bdc1c1",
        justifyContent: "center", alignItems: "center",
        backgroundColor: "#fff",
    },
    stepDotActive: { borderColor: "#4A9999", backgroundColor: "#4A9999" },
    stepDotText: { fontSize: 12, fontFamily: "PlusJakartaSans-Bold", color: "#bdc1c1" },
    stepDotTextActive: { color: "#fff" },
    stepLine: { flex: 1, height: 2, backgroundColor: "#E0E0E0" },
    stepLineActive: { backgroundColor: "#4A9999" },
    stepTitle: {
        fontSize: 18, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434",
        paddingHorizontal: 20, paddingBottom: 12,
    },
    scrollArea: { flex: 1 },
    scrollContent: { paddingHorizontal: 20, paddingBottom: 20 },
    label: {
        color: "#111818", fontSize: 14,
        fontFamily: "PlusJakartaSans-Regular", marginTop: 12, marginBottom: 4,
    },
    input: {
        borderRadius: 12, backgroundColor: "#f0f4f4",
        color: "#111818", fontSize: 16, fontFamily: "PlusJakartaSans-Regular",
        paddingVertical: 10, paddingHorizontal: 16, marginBottom: 2,
    },
    readOnly: { color: "#638888" },
    multiline: { height: 150, textAlignVertical: "top", paddingTop: 10 },
    pickerContainer: { borderRadius: 12, backgroundColor: "#f0f4f4", overflow: "hidden", marginBottom: 2 },
    picker: { color: "#111818" },
    textError: {
        color: "#ED4337", fontSize: 12,
        fontFamily: "PlusJakartaSans-Regular", marginBottom: 4, marginLeft: 2,
    },
    hint: { color: "#638888", fontSize: 13, fontFamily: "PlusJakartaSans-Regular", marginBottom: 8 },
    coordsText: {
        color: "#4A9999", fontSize: 13,
        fontFamily: "PlusJakartaSans-Regular", marginTop: 6, textAlign: "center",
    },
    restrictionBadge: {
        flexDirection: "row", alignItems: "flex-start", gap: 6,
        backgroundColor: "#f0f8f8", borderRadius: 10,
        padding: 10, marginTop: 12, borderLeftWidth: 3, borderLeftColor: "#4A9999",
    },
    restrictionText: {
        fontSize: 12, fontFamily: "PlusJakartaSans-Regular",
        color: "#4A9999", flex: 1,
    },
    summaryBox: {
        backgroundColor: "#f0f8f8", borderRadius: 12,
        padding: 14, marginTop: 16, gap: 6,
    },
    summaryTitle: { fontSize: 14, fontFamily: "PlusJakartaSans-Bold", color: "#1A3434", marginBottom: 4 },
    summaryLine: { fontSize: 13, fontFamily: "PlusJakartaSans-Regular", color: "#444" },
    statusContainer: { alignItems: "center", marginTop: 20, gap: 10 },
    successText: {
        fontSize: 15, fontFamily: "PlusJakartaSans-Regular",
        textAlign: "center", color: "#065f46", paddingHorizontal: 8,
    },
    errorText: {
        fontSize: 15, fontFamily: "PlusJakartaSans-Regular",
        textAlign: "center", color: "#ED4337", paddingHorizontal: 8,
    },
    navRow: {
        flexDirection: "row", paddingHorizontal: 20, paddingVertical: 12,
        borderTopWidth: 1, borderTopColor: "#E0E0E0", backgroundColor: "#fff",
    },
    backButton: {
        flexDirection: "row", alignItems: "center", gap: 6,
        borderWidth: 1, borderColor: "#4A9999", borderRadius: 12,
        paddingVertical: 12, paddingHorizontal: 16,
    },
    backButtonText: { color: "#4A9999", fontFamily: "PlusJakartaSans-Bold", fontSize: 14 },
});

export default OrganizationSignupForm;
