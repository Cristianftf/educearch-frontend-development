package com.uci.competencia.model.dto.response;

import lombok.Data;

import java.time.LocalDateTime;

@Data
public class ChatMessageDTO {
    private String id;
    private String senderEmail;
    private String recipientEmail;
    private String content;
    private LocalDateTime createdAt;
    private LocalDateTime readAt;
    private boolean mine;
}
