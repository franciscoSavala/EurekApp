package com.eurekapp.backend.dto.command;

import lombok.Data;

@Data
public class UpdateClaimStatusCommand {
    private String newStatus;
    private String note;
}
