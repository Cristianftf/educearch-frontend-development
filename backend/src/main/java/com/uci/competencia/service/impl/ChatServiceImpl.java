package com.uci.competencia.service.impl;

import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.response.ChatContactDTO;
import com.uci.competencia.model.dto.response.ChatMessageDTO;
import com.uci.competencia.model.entity.ChatMessage;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.ChatMessageRepository;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.ChatService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

@Service
@RequiredArgsConstructor
@Slf4j
public class ChatServiceImpl implements ChatService {

    private final UserRepository userRepository;
    private final ChatMessageRepository chatMessageRepository;

    @Override
    @Transactional(readOnly = true)
    public List<ChatContactDTO> getContacts(String currentEmail) {
        User currentUser = getActiveUserOrThrow(currentEmail);
        List<Role> allowedRoles = allowedContactRoles(currentUser.getRole());

        Map<String, ChatContactDTO> contactsByEmail = new LinkedHashMap<>();
        for (Role role : allowedRoles) {
            for (User candidate : userRepository.findByRole(role)) {
                if (!candidate.isActive()) {
                    continue;
                }
                if (candidate.getEmail() == null || candidate.getEmail().equalsIgnoreCase(currentEmail)) {
                    continue;
                }
                contactsByEmail.putIfAbsent(candidate.getEmail().toLowerCase(), toContactDto(candidate));
            }
        }

        Map<String, Long> unreadBySender = new LinkedHashMap<>();
        for (ChatMessageRepository.SenderUnreadCount item : chatMessageRepository.countUnreadByRecipient(currentEmail)) {
            unreadBySender.put(item.getSenderEmail().toLowerCase(), item.getUnreadCount());
        }

        List<ChatContactDTO> contacts = new ArrayList<>(contactsByEmail.values());
        for (ChatContactDTO contact : contacts) {
            long unread = unreadBySender.getOrDefault(contact.getEmail().toLowerCase(), 0L);
            contact.setUnreadCount(unread);
        }

        contacts.sort(Comparator.comparing(ChatContactDTO::getName, String.CASE_INSENSITIVE_ORDER));
        return contacts;
    }

    @Override
    @Transactional(readOnly = true)
    public List<ChatMessageDTO> getConversation(String currentEmail, String contactEmail, int limit) {
        validateConversationParticipants(currentEmail, contactEmail);
        int safeLimit = Math.max(1, Math.min(limit, 200));

        List<ChatMessage> latest = chatMessageRepository.findConversationLatest(
            currentEmail,
            contactEmail,
            PageRequest.of(0, safeLimit)
        );

        Collections.reverse(latest);
        return latest.stream()
            .map(message -> toDto(message, currentEmail))
            .toList();
    }

    @Override
    @Transactional
    public ChatMessage sendMessage(String senderEmail, String recipientEmail, String content) {
        User sender = getActiveUserOrThrow(senderEmail);
        User recipient = getActiveUserOrThrow(recipientEmail);
        validateMessagingPermission(sender, recipient);

        String normalizedContent = Objects.requireNonNullElse(content, "").trim();
        if (normalizedContent.isEmpty()) {
            throw new IllegalArgumentException("Message content cannot be empty");
        }
        if (normalizedContent.length() > 2000) {
            throw new IllegalArgumentException("Message content cannot exceed 2000 characters");
        }

        ChatMessage message = new ChatMessage();
        message.setSenderEmail(sender.getEmail());
        message.setRecipientEmail(recipient.getEmail());
        message.setContent(normalizedContent);

        ChatMessage saved = chatMessageRepository.save(message);
        log.debug("Chat message stored: {} -> {}", sender.getEmail(), recipient.getEmail());
        return saved;
    }

    @Override
    public ChatMessageDTO toDto(ChatMessage message, String viewerEmail) {
        ChatMessageDTO dto = new ChatMessageDTO();
        dto.setId(message.getId() != null ? message.getId().toString() : null);
        dto.setSenderEmail(message.getSenderEmail());
        dto.setRecipientEmail(message.getRecipientEmail());
        dto.setContent(message.getContent());
        dto.setCreatedAt(message.getCreatedAt());
        dto.setReadAt(message.getReadAt());
        dto.setMine(message.getSenderEmail() != null && message.getSenderEmail().equalsIgnoreCase(viewerEmail));
        return dto;
    }

    @Override
    @Transactional
    public int markConversationAsRead(String currentEmail, String contactEmail, LocalDateTime readAt) {
        validateConversationParticipants(currentEmail, contactEmail);
        return chatMessageRepository.markConversationAsRead(contactEmail, currentEmail, readAt);
    }

    private void validateConversationParticipants(String currentEmail, String contactEmail) {
        User currentUser = getActiveUserOrThrow(currentEmail);
        User contact = getActiveUserOrThrow(contactEmail);
        validateMessagingPermission(currentUser, contact);
    }

    private void validateMessagingPermission(User sender, User recipient) {
        if (!canMessage(sender.getRole(), recipient.getRole())) {
            throw new AccessDeniedException("You are not allowed to chat with this user");
        }
    }

    private boolean canMessage(Role senderRole, Role recipientRole) {
        if (senderRole == null || recipientRole == null) {
            return false;
        }

        return switch (senderRole) {
            case ROLE_STUDENT -> recipientRole == Role.ROLE_PROFESSOR;
            case ROLE_PROFESSOR -> recipientRole == Role.ROLE_STUDENT || recipientRole == Role.ROLE_ADMIN;
            case ROLE_ADMIN -> recipientRole == Role.ROLE_PROFESSOR;
        };
    }

    private List<Role> allowedContactRoles(Role role) {
        if (role == null) {
            return List.of();
        }
        return switch (role) {
            case ROLE_STUDENT -> List.of(Role.ROLE_PROFESSOR);
            case ROLE_PROFESSOR -> List.of(Role.ROLE_STUDENT, Role.ROLE_ADMIN);
            case ROLE_ADMIN -> List.of(Role.ROLE_PROFESSOR);
        };
    }

    private User getActiveUserOrThrow(String email) {
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new ResourceNotFoundException("User not found"));
        if (!user.isActive()) {
            throw new AccessDeniedException("User is inactive");
        }
        return user;
    }

    private ChatContactDTO toContactDto(User user) {
        ChatContactDTO dto = new ChatContactDTO();
        dto.setEmail(user.getEmail());
        dto.setName(buildDisplayName(user));
        dto.setRole(normalizeRole(user.getRole()));
        dto.setAvatar(user.getAvatar());
        dto.setFaculty(user.getFaculty());
        dto.setUnreadCount(0);
        return dto;
    }

    private String buildDisplayName(User user) {
        String firstName = user.getFirstName() == null ? "" : user.getFirstName().trim();
        String lastName = user.getLastName() == null ? "" : user.getLastName().trim();
        String fullName = (firstName + " " + lastName).trim();
        if (!fullName.isEmpty()) {
            return fullName;
        }
        if (user.getUsername() != null && !user.getUsername().isBlank()) {
            return user.getUsername();
        }
        return user.getEmail();
    }

    private String normalizeRole(Role role) {
        return role.name().replace("ROLE_", "").toLowerCase();
    }
}
