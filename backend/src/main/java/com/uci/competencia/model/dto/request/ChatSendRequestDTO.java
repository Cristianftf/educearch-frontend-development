package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

@Data
public class ChatSendRequestDTO {

    @NotBlank(message = "Recipient email is required")
    @Size(max = 255, message = "Recipient email is too long")
    private String recipientEmail;

    @NotBlank(message = "Message content is required")
    @Size(max = 2000, message = "Message content cannot exceed 2000 characters")
    private String content;
}
