package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ChatMarkReadRequestDTO {

    @NotBlank(message = "Contact email is required")
    @Size(max = 255, message = "Contact email is too long")
    private String contactEmail;
}
