package com.uci.competencia.model.entity;

import com.uci.competencia.model.converter.CaseDifficultyConverter;
import com.uci.competencia.model.converter.CaseStatusConverter;
import com.uci.competencia.model.enums.CaseDifficulty;
import com.uci.competencia.model.enums.CaseStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "case_studies")
@Data
@NoArgsConstructor
@AllArgsConstructor
public class CaseStudy {
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false)
    private String title;

    @Column(length = 5000)
    private String scenario;

    @Convert(converter = CaseDifficultyConverter.class)
    @Column(nullable = false)
    private CaseDifficulty difficulty;

    @Convert(converter = CaseStatusConverter.class)
    @Column(nullable = false)
    private CaseStatus status = CaseStatus.DRAFT;

    @ElementCollection
    @CollectionTable(name = "case_required_articles", joinColumns = @JoinColumn(name = "case_id"))
    @Column(name = "article_id")
    private List<String> requiredArticles;

    @ElementCollection
    @CollectionTable(name = "case_optional_articles", joinColumns = @JoinColumn(name = "case_id"))
    @Column(name = "article_id")
    private List<String> optionalArticles;

    @ElementCollection
    @CollectionTable(name = "case_guiding_questions", joinColumns = @JoinColumn(name = "case_id"))
    @Column(name = "question", length = 1000)
    private List<String> guidingQuestions;

    @ElementCollection
    @CollectionTable(name = "case_rubric", joinColumns = @JoinColumn(name = "case_id"))
    @Column(name = "rubric_data", columnDefinition = "TEXT")
    private List<String> rubric; // JSON string for rubric items

    @Column(nullable = false)
    private String createdBy; // Professor ID

    @CreationTimestamp
    private LocalDateTime createdAt;

    private LocalDateTime startDate;

    private LocalDateTime dueDate;

    @ElementCollection
    @CollectionTable(name = "case_assigned_students", joinColumns = @JoinColumn(name = "case_id"))
    @Column(name = "student_id")
    private List<String> assignedStudents;

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
