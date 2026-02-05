package com.uci.competencia.model.entity;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Entidad Course - Cursos/Materias impartidas por profesores
 */
@Entity
@Table(name = "courses", uniqueConstraints = @UniqueConstraint(columnNames = "code"))
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Course {
    
    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;
    
    @Column(nullable = false, length = 100, unique = true)
    private String code; // "MED-2024-01", "NUR-2024-02"
    
    @Column(nullable = false, length = 255)
    private String title;
    
    @Lob
    private String description;
    
    @Column(length = 50)
    private String semester; // "2024-1", "2024-2"
    
    @Column(length = 50)
    private String academicYear; // "2023-2024", "2024-2025"
    
    @Column(nullable = false)
    private Integer capacity = 50;
    
    @Column(nullable = false)
    private Integer enrolledStudents = 0;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "professor_id", nullable = false)
    @JsonIgnore
    private Professor professor;
    
    @ManyToMany
    @JoinTable(
        name = "course_students",
        joinColumns = @JoinColumn(name = "course_id"),
        inverseJoinColumns = @JoinColumn(name = "student_id")
    )
    @JsonIgnore
    private Set<Student> students = new HashSet<>();
    
    @Column(nullable = false)
    private LocalDateTime startDate;
    
    @Column(nullable = false)
    private LocalDateTime endDate;
    
    @Lob
    private String syllabus; // URL o contenido del programa
    
    @Column(length = 50)
    private String status; // "ACTIVE", "ARCHIVED", "PLANNING"
    
    @Column(nullable = false)
    private LocalDateTime createdAt;
    
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = "ACTIVE";
        }
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
