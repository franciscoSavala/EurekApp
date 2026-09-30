package com.eurekapp.backend.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

/**
 * EU-277: una de las devoluciones que disparó una alerta de fraude. Es la evidencia con la que el
 * dueño de Eurekapp decide si la alerta es una falsa alarma: qué objeto se retiró, dónde, cuándo y
 * quién lo entregó.
 */
@Data
@Builder
public class FraudAlertReturnDto {
    private String objectTitle;
    private String organizationName;
    private LocalDateTime returnedAt;
    private String deliveredByFullName;
}
