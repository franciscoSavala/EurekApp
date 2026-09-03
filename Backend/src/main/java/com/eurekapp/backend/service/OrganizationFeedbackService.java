package com.eurekapp.backend.service;

import com.eurekapp.backend.dto.request.SubmitOrganizationFeedbackRequestDto;
import com.eurekapp.backend.dto.response.OrganizationFeedbackSurveyDto;
import com.eurekapp.backend.exception.BadRequestException;
import com.eurekapp.backend.exception.NotFoundException;
import com.eurekapp.backend.model.FoundObject;
import com.eurekapp.backend.model.Organization;
import com.eurekapp.backend.model.OrganizationFeedback;
import com.eurekapp.backend.model.ReturnFoundObject;
import com.eurekapp.backend.model.UserEurekapp;
import com.eurekapp.backend.repository.FoundObjectRepository;
import com.eurekapp.backend.repository.IOrganizationFeedbackRepository;
import com.eurekapp.backend.repository.IOrganizationRepository;
import com.eurekapp.backend.repository.IReturnFoundObjectRepository;
import lombok.AllArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;

/**
 * EU-371: la calificación de la organización, ligada a la devolución concreta.
 *
 * Antes se calificaba a la organización en la pantalla de resultados de la búsqueda, cuando la
 * persona todavía no había ido a retirar nada ni tratado con nadie. Acá se registra después del
 * retiro, que es cuando hay algo que calificar.
 */
@AllArgsConstructor
@Service
public class OrganizationFeedbackService {

    private static final Logger log = LoggerFactory.getLogger(OrganizationFeedbackService.class);

    private final IOrganizationFeedbackRepository repository;
    private final IReturnFoundObjectRepository returnFoundObjectRepository;
    private final IOrganizationRepository organizationRepository;
    private final FoundObjectRepository foundObjectRepository;

    /**
     * Lo que la pantalla de la encuesta necesita para mostrarse: de qué organización se trata, qué
     * objeto se retiró, y si esa devolución ya fue calificada.
     */
    public OrganizationFeedbackSurveyDto getSurvey(UserEurekapp user, Long returnId) {
        ReturnFoundObject rfo = requireOwnReturn(user, returnId);

        return OrganizationFeedbackSurveyDto.builder()
                .returnId(rfo.getId())
                .organizationName(organizationName(rfo.getOrganizationId()))
                .objectTitle(objectTitle(rfo.getFoundObjectUUID()))
                .alreadyRated(repository.existsByReturnFoundObject_Id(rfo.getId()))
                .build();
    }

    public void submit(UserEurekapp user, Long returnId, SubmitOrganizationFeedbackRequestDto dto) {
        ReturnFoundObject rfo = requireOwnReturn(user, returnId);

        /* Una devolución, una calificación. Sin esto, el enlace del correo —que no vence— dejaría
         * calificar la misma atención tantas veces como se lo abriera, y el promedio del reporte
         * quedaría a merced de quien más insista. */
        if (repository.existsByReturnFoundObject_Id(rfo.getId())) {
            throw new BadRequestException("already_rated",
                    "Ya calificaste la atención de esta devolución.");
        }

        OrganizationFeedback feedback = OrganizationFeedback.builder()
                .returnFoundObject(rfo)
                .organizationId(rfo.getOrganizationId())
                .user(user)
                .staffTreatment(dto.getStaffTreatment())
                .waitingTime(dto.getWaitingTime())
                .instructionsClarity(dto.getInstructionsClarity())
                .objectCondition(dto.getObjectCondition())
                .pickupSecurity(dto.getPickupSecurity())
                .comment(dto.getComment() != null && !dto.getComment().isBlank()
                        ? dto.getComment().trim() : null)
                .createdAt(LocalDateTime.now())
                .build();

        repository.save(feedback);
    }

    /**
     * La encuesta la responde quien retiró el objeto, y sobre su propia devolución. El enlace del
     * correo lleva el identificador de la devolución a la vista, así que sin esta comprobación
     * cualquiera con una sesión válida podría calificar la atención que recibió otra persona.
     *
     * Se rechaza con 400 y no con 403: el front usa el 401/403 para renovar la sesión vencida, y un
     * rechazo de negocio disfrazado de problema de sesión se vuelve un fallo silencioso.
     */
    private ReturnFoundObject requireOwnReturn(UserEurekapp user, Long returnId) {
        ReturnFoundObject rfo = returnFoundObjectRepository.findById(returnId)
                .orElseThrow(() -> new NotFoundException("return_not_found",
                        "No encontramos la devolución que querés calificar."));

        if (rfo.getUserEurekapp() == null || user == null
                || !rfo.getUserEurekapp().getId().equals(user.getId())) {
            throw new BadRequestException("not_your_return",
                    "Esta devolución no es tuya, así que no podés calificarla.");
        }

        /* Las devoluciones anteriores a EU-371 no guardaron su organización, y sin ella la
         * calificación no se le podría atribuir a nadie. No se inventa: se rechaza. */
        if (rfo.getOrganizationId() == null) {
            throw new BadRequestException("return_without_organization",
                    "Esta devolución es anterior a la encuesta de atención y no se puede calificar.");
        }

        return rfo;
    }

    private String organizationName(Long organizationId) {
        return organizationRepository.findById(organizationId)
                .map(Organization::getName)
                .orElse(null);
    }

    /* El título del objeto es contexto para que la persona sepa de qué retiro le están hablando.
     * Vive en la base vectorial: si no responde, la encuesta se muestra igual sin el título, porque
     * no es lo que se está calificando. */
    private String objectTitle(String foundObjectUUID) {
        try {
            FoundObject fo = foundObjectRepository.getByUuid(foundObjectUUID);
            return fo != null ? fo.getTitle() : null;
        } catch (Exception e) {
            log.warn("No se pudo recuperar el título del objeto {}: {}", foundObjectUUID, e.getMessage());
            return null;
        }
    }
}
