package com.uci.competencia.controller.ws;

import com.uci.competencia.model.dto.request.ChatSendRequestDTO;
import com.uci.competencia.model.dto.response.ChatMessageDTO;
import com.uci.competencia.model.entity.ChatMessage;
import com.uci.competencia.service.ChatService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.handler.annotation.MessageMapping;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Controller;

import java.security.Principal;

@Controller
@RequiredArgsConstructor
@Slf4j
public class ChatWebSocketController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    @MessageMapping("/chat.send")
    public void sendMessage(@Valid ChatSendRequestDTO request, Principal principal) {
        if (principal == null || principal.getName() == null || principal.getName().isBlank()) {
            throw new AccessDeniedException("Unauthenticated websocket user");
        }

        String senderEmail = principal.getName();
        ChatMessage message = chatService.sendMessage(senderEmail, request.getRecipientEmail(), request.getContent());

        ChatMessageDTO senderView = chatService.toDto(message, senderEmail);
        ChatMessageDTO recipientView = chatService.toDto(message, request.getRecipientEmail());

        messagingTemplate.convertAndSendToUser(request.getRecipientEmail(), "/queue/chat.messages", recipientView);
        messagingTemplate.convertAndSendToUser(senderEmail, "/queue/chat.messages", senderView);
    }
}
