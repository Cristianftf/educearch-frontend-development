package com.uci.competencia.repository;

import com.uci.competencia.model.entity.ChatMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Repository
public interface ChatMessageRepository extends JpaRepository<ChatMessage, UUID> {

    interface SenderUnreadCount {
        String getSenderEmail();
        long getUnreadCount();
    }

    @Query("""
        SELECT m
        FROM ChatMessage m
        WHERE (m.senderEmail = :emailA AND m.recipientEmail = :emailB)
           OR (m.senderEmail = :emailB AND m.recipientEmail = :emailA)
        ORDER BY m.createdAt DESC
        """)
    List<ChatMessage> findConversationLatest(
        @Param("emailA") String emailA,
        @Param("emailB") String emailB,
        Pageable pageable
    );

    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        UPDATE ChatMessage m
           SET m.readAt = :readAt
         WHERE m.senderEmail = :senderEmail
           AND m.recipientEmail = :recipientEmail
           AND m.readAt IS NULL
        """)
    int markConversationAsRead(
        @Param("senderEmail") String senderEmail,
        @Param("recipientEmail") String recipientEmail,
        @Param("readAt") LocalDateTime readAt
    );

    @Query("""
        SELECT m.senderEmail AS senderEmail, COUNT(m) AS unreadCount
          FROM ChatMessage m
         WHERE m.recipientEmail = :recipientEmail
           AND m.readAt IS NULL
         GROUP BY m.senderEmail
        """)
    List<SenderUnreadCount> countUnreadByRecipient(@Param("recipientEmail") String recipientEmail);
}
