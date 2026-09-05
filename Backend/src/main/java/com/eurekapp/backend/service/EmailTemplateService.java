package com.eurekapp.backend.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

import java.util.List;

@Service
public class EmailTemplateService {

    private final TemplateEngine templateEngine;
    private final String frontUrl;

    public EmailTemplateService(TemplateEngine templateEngine,
                                @Value("${application.front.url}") String frontUrl) {
        this.templateEngine = templateEngine;
        this.frontUrl = frontUrl;
    }

    public String buildWelcomeEmail(String firstName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        return templateEngine.process("email/welcome", ctx);
    }

    public String buildForgotPasswordEmail(String firstName, String code) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("code", code);
        return templateEngine.process("email/forgot-password", ctx);
    }

    public String buildEmployeeInvitationEmail(String firstName, String orgName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        return templateEngine.process("email/employee-invitation", ctx);
    }

    public String buildEncargadoAssignedEmail(String firstName, String orgName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        return templateEngine.process("email/encargado-assigned", ctx);
    }

    public String buildOrgRequestSubmittedEmail(String firstName, String orgName, String orgType,
                                                  String customType, String street, String streetNumber,
                                                  String city, String province, String country,
                                                  String ownerFirstName, String ownerLastName,
                                                  String ownerEmail, String ownerPhone, String reason) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("orgType", orgType);
        ctx.setVariable("customType", customType);
        ctx.setVariable("street", street);
        ctx.setVariable("streetNumber", streetNumber);
        ctx.setVariable("city", city);
        ctx.setVariable("province", province);
        ctx.setVariable("country", country);
        ctx.setVariable("ownerFirstName", ownerFirstName);
        ctx.setVariable("ownerLastName", ownerLastName);
        ctx.setVariable("ownerEmail", ownerEmail);
        ctx.setVariable("ownerPhone", ownerPhone);
        ctx.setVariable("reason", reason);
        return templateEngine.process("email/org-request-submitted", ctx);
    }

    public String buildOrgRequestNewEmail(String requesterFirstName, String requesterLastName,
                                           String requesterEmail, String orgName, String orgType,
                                           String customType, String street, String streetNumber,
                                           String city, String province, String country,
                                           Double latitude, Double longitude,
                                           String ownerFirstName, String ownerLastName,
                                           String ownerEmail, String ownerPhone, String reason,
                                           String createdAt) {
        Context ctx = new Context();
        ctx.setVariable("requesterFirstName", requesterFirstName);
        ctx.setVariable("requesterLastName", requesterLastName);
        ctx.setVariable("requesterEmail", requesterEmail);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("orgType", orgType);
        ctx.setVariable("customType", customType);
        ctx.setVariable("street", street);
        ctx.setVariable("streetNumber", streetNumber);
        ctx.setVariable("city", city);
        ctx.setVariable("province", province);
        ctx.setVariable("country", country);
        ctx.setVariable("latitude", latitude);
        ctx.setVariable("longitude", longitude);
        ctx.setVariable("ownerFirstName", ownerFirstName);
        ctx.setVariable("ownerLastName", ownerLastName);
        ctx.setVariable("ownerEmail", ownerEmail);
        ctx.setVariable("ownerPhone", ownerPhone);
        ctx.setVariable("reason", reason);
        ctx.setVariable("createdAt", createdAt);
        return templateEngine.process("email/org-request-new", ctx);
    }

    public String buildOrgRequestResolvedEmail(String firstName, String orgName,
                                                boolean approved, String adminNote) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("approved", approved);
        ctx.setVariable("adminNote", adminNote);
        return templateEngine.process("email/org-request-resolved", ctx);
    }

    public String buildOrgOwnerApprovedEmail(String firstName, String orgName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        return templateEngine.process("email/org-owner-approved", ctx);
    }

    public String buildOrgOwnerInvitedEmail(String firstName, String orgName, String ownerEmail) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("ownerEmail", ownerEmail);
        return templateEngine.process("email/org-owner-invited", ctx);
    }

    /**
     * EU-353: el usuario reconoció una coincidencia como suya. Le manda los datos del hallazgo y de
     * dónde retirarlo, que hasta ahora sólo existían en un modal que al cerrarse no volvía.
     *
     * <p>No confundir con {@link #buildObjectMatchFoundEmail}: aquél es el aviso previo ("apareció
     * algo parecido a lo que buscás"); éste es la consecuencia de que el usuario ya haya dicho que
     * el objeto es suyo.</p>
     */
    public String buildObjectClaimedEmail(String firstName, String objectTitle, String description,
                                           String orgName, String contactData) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("objectTitle", objectTitle);
        ctx.setVariable("description", description);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("contactData", contactData);
        return templateEngine.process("email/object-claimed", ctx);
    }

    /**
     * Email de la búsqueda INVERSA (EU-279): se cargó un objeto que coincide con una o más búsquedas
     * guardadas del usuario. Lista las búsquedas coincidentes de ese usuario.
     */
    public String buildObjectMatchFoundEmail(String orgName, String contactData,
                                              List<String> searchDescriptions, String imageUrl) {
        Context ctx = new Context();
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("contactData", contactData);
        ctx.setVariable("searchDescriptions", searchDescriptions);
        ctx.setVariable("imageUrl", imageUrl);
        return templateEngine.process("email/object-match-found", ctx);
    }

    public String buildObjectReturnedEmail(String firstName, String lastName,
                                            String objectTitle, String returnDateTime,
                                            String dni) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("lastName", lastName);
        ctx.setVariable("objectTitle", objectTitle);
        ctx.setVariable("returnDateTime", returnDateTime);
        ctx.setVariable("dni", dni);
        return templateEngine.process("email/object-returned", ctx);
    }

    /**
     * EU-353: aviso al dueño de Eurekapp de que se generó una alerta de fraude.
     *
     * <p>Sin organización: las alertas nuevas son globales (se detectan cruzando organizaciones y las
     * gestiona el ADMIN), así que la clave del caso es el DNI y no una organización. El {@code reason}
     * tiene que llegar ya humanizado —{@code FraudCaseType.humanizeReason}—: el crudo es "CASE_1,CASE_3",
     * jerga interna que no se le muestra a nadie.</p>
     */
    public String buildFraudAlertEmail(String reason, String details, String dni, String createdAt) {
        Context ctx = new Context();
        ctx.setVariable("reason", reason);
        ctx.setVariable("details", details);
        ctx.setVariable("dni", dni);
        ctx.setVariable("createdAt", createdAt);
        return templateEngine.process("email/fraud-alert", ctx);
    }

    /**
     * EU-373: el correo que ya le avisaba a la persona que recupero su objeto suma la invitacion a
     * calificar la atencion recibida. Se aprovecha el envio que ya existe en vez de mandar un correo
     * aparte: es el mismo momento y el mismo destinatario.
     *
     * El enlace lleva el token de la encuesta, no el id de la devolucion. Si no hay token, el correo
     * sale sin la invitacion: se prefiere un correo sin encuesta antes que un enlace que no lleva a
     * ningun lado. Si la persona no responde, no pasa nada: no se insiste ni se bloquea nada.
     */
    public String buildObjectRecoveredEmail(String firstName, String objectTitle,
                                             String orgName, String returnDateTime, String surveyToken) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("objectTitle", objectTitle);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("returnDateTime", returnDateTime);
        ctx.setVariable("surveyUrl", buildSurveyUrl(surveyToken));
        return templateEngine.process("email/object-recovered", ctx);
    }

    private String buildSurveyUrl(String surveyToken) {
        if (surveyToken == null || surveyToken.isBlank()) return null;
        String base = frontUrl != null && frontUrl.endsWith("/")
                ? frontUrl.substring(0, frontUrl.length() - 1)
                : frontUrl;
        return base + "/OrganizationFeedbackSurvey?token=" + surveyToken;
    }

    public String buildObjectReceivedEmail(String firstName, String objectTitle, String orgName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("objectTitle", objectTitle);
        ctx.setVariable("orgName", orgName);
        return templateEngine.process("email/object-received", ctx);
    }

    public String buildOrgDeactivatedEmail(String firstName, String orgName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        return templateEngine.process("email/org-deactivated", ctx);
    }

    public String buildOrgReactivatedEmail(String firstName, String orgName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("orgName", orgName);
        return templateEngine.process("email/org-reactivated", ctx);
    }

    public String buildUserDeactivatedEmail(String firstName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        return templateEngine.process("email/user-deactivated", ctx);
    }

    public String buildUserReactivatedEmail(String firstName) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        return templateEngine.process("email/user-reactivated", ctx);
    }
}
