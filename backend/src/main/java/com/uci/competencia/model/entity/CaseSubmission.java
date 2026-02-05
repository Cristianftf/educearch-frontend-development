package com.uci.competencia.model.entity;

import com.uci.competencia.model.enums.SubmissionStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "case_submissions")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CaseSubmission {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String caseId;

    @Column(nullable = false)
    private String studentId;

    @CreationTimestamp
    private LocalDateTime submittedAt;

    @Column(length = 10000)
    private String content;

    @ElementCollection
    @CollectionTable(name = "submission_selected_articles", joinColumns = @JoinColumn(name = "submission_id"))
    @Column(name = "article_id")
    private List<String> selectedArticles;

    @Column(length = 2000)
    private String bibliography;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private SubmissionStatus status = SubmissionStatus.PENDING;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
