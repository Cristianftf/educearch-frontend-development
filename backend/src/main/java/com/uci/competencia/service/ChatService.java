package com.uci.competencia.service;

import com.uci.competencia.model.dto.response.ChatContactDTO;
import com.uci.competencia.model.dto.response.ChatMessageDTO;
import com.uci.competencia.model.entity.ChatMessage;

import java.time.LocalDateTime;
import java.util.List;

public interface ChatService {

    List<ChatContactDTO> getContacts(String currentEmail);

    List<ChatMessageDTO> getConversation(String currentEmail, String contactEmail, int limit);

    ChatMessage sendMessage(String senderEmail, String recipientEmail, String content);

    ChatMessageDTO toDto(ChatMessage message, String viewerEmail);

    int markConversationAsRead(String currentEmail, String contactEmail, LocalDateTime readAt);
}
