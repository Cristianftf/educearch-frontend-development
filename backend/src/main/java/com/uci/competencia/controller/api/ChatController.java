package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.request.ChatMarkReadRequestDTO;
import com.uci.competencia.model.dto.request.ChatSendRequestDTO;
import com.uci.competencia.model.dto.response.ChatContactDTO;
import com.uci.competencia.model.dto.response.ChatMessageDTO;
import com.uci.competencia.model.entity.ChatMessage;
import com.uci.competencia.service.ChatService;
import com.uci.competencia.util.SecurityUtils;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/chat")
@PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR', 'ADMIN')")
@RequiredArgsConstructor
@Slf4j
public class ChatController {

    private final ChatService chatService;
    private final SimpMessagingTemplate messagingTemplate;

    @GetMapping("/contacts")
    public ResponseEntity<List<ChatContactDTO>> getContacts() {
        String currentEmail = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(chatService.getContacts(currentEmail));
    }

    @GetMapping("/messages")
    public ResponseEntity<List<ChatMessageDTO>> getMessages(
        @RequestParam String contactEmail,
        @RequestParam(defaultValue = "100") int limit
    ) {
        String currentEmail = SecurityUtils.getCurrentUserId();
        return ResponseEntity.ok(chatService.getConversation(currentEmail, contactEmail, limit));
    }

    @PostMapping("/send")
    public ResponseEntity<ChatMessageDTO> sendMessage(@Valid @RequestBody ChatSendRequestDTO request) {
        String currentEmail = SecurityUtils.getCurrentUserId();
        ChatMessage message = chatService.sendMessage(currentEmail, request.getRecipientEmail(), request.getContent());

        ChatMessageDTO senderView = chatService.toDto(message, currentEmail);
        ChatMessageDTO recipientView = chatService.toDto(message, request.getRecipientEmail());

        messagingTemplate.convertAndSendToUser(request.getRecipientEmail(), "/queue/chat.messages", recipientView);
        messagingTemplate.convertAndSendToUser(currentEmail, "/queue/chat.messages", senderView);

        return ResponseEntity.status(HttpStatus.CREATED).body(senderView);
    }

    @PostMapping("/read")
    public ResponseEntity<Map<String, Object>> markAsRead(@Valid @RequestBody ChatMarkReadRequestDTO request) {
        String currentEmail = SecurityUtils.getCurrentUserId();
        LocalDateTime readAt = LocalDateTime.now();
        int updated = chatService.markConversationAsRead(currentEmail, request.getContactEmail(), readAt);

        if (updated > 0) {
            messagingTemplate.convertAndSendToUser(
                request.getContactEmail(),
                "/queue/chat.read",
                Map.of("readBy", currentEmail, "readAt", readAt.toString())
            );
        }

        return ResponseEntity.ok(Map.of("updated", updated));
    }
}
