package com.eurekapp.backend.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.thymeleaf.TemplateEngine;
import org.thymeleaf.context.Context;

@RequiredArgsConstructor
@Service
public class EmailTemplateService {

    private final TemplateEngine templateEngine;

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
                                           String ownerEmail, String ownerPhone, String reason) {
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

    public String buildObjectFoundEmail(String orgName, String contactData,
                                         String description, String imageUrl) {
        Context ctx = new Context();
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("contactData", contactData);
        ctx.setVariable("description", description);
        ctx.setVariable("imageUrl", imageUrl);
        return templateEngine.process("email/object-found", ctx);
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

    public String buildFraudAlertEmail(String orgName, String reason, String details,
                                        String createdAt) {
        Context ctx = new Context();
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("reason", reason);
        ctx.setVariable("details", details);
        ctx.setVariable("createdAt", createdAt);
        return templateEngine.process("email/fraud-alert", ctx);
    }

    public String buildObjectRecoveredEmail(String firstName, String objectTitle,
                                             String orgName, String returnDateTime) {
        Context ctx = new Context();
        ctx.setVariable("firstName", firstName);
        ctx.setVariable("objectTitle", objectTitle);
        ctx.setVariable("orgName", orgName);
        ctx.setVariable("returnDateTime", returnDateTime);
        return templateEngine.process("email/object-recovered", ctx);
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
}
