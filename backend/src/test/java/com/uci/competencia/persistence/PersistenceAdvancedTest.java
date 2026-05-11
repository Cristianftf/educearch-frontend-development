package com.uci.competencia.persistence;

import com.uci.competencia.model.entity.*;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.model.enums.StudyType;
import com.uci.competencia.repository.*;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

/**
 * Advanced JPA Persistence Tests for EduSearch.
 * 
 * Validates complex scenarios:
 * - Cascading deletes and updates
 * - Relationship changes
 * - JSON persistence in TEXT fields
 * - Pagination queries
 * - @ElementCollection persistence
 * - Entity synchronization
 * - Medical domain data
 * 
 * Using @SpringBootTest for full integration testing with transactions.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
@DisplayName("PersistenceAdvancedTest - Advanced Persistence Scenarios")
class PersistenceAdvancedTest {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private SearchResultRepository searchResultRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CompetencyProgressRepository competencyProgressRepository;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        searchSessionRepository.deleteAll();
        searchResultRepository.deleteAll();
        competencyProgressRepository.deleteAll();
    }

    // =========================================================================
    //  1. CASCADE OPERATIONS
    // =========================================================================

    @Nested
    @DisplayName("Cascade Operations")
    class CascadeTest {

        @Test
        @DisplayName("Cascade DELETE: eliminar User elimina SearchSessions")
        void givenUserWithSessions_whenDeleteUser_thenCascadeDeletesSessions() {
            // Arrange
            User user = createUser("cascade.user", "cascade@test.edu", Role.ROLE_STUDENT);
            User savedUser = userRepository.save(user);

            SearchSession session1 = new SearchSession();
            session1.setUser(savedUser);
            session1.setOriginalQuery("COVID-19");
            session1.setStartedAt(LocalDateTime.now());
            searchSessionRepository.save(session1);

            SearchSession session2 = new SearchSession();
            session2.setUser(savedUser);
            session2.setOriginalQuery("Ventilator");
            session2.setStartedAt(LocalDateTime.now());
            searchSessionRepository.save(session2);

            String userId = savedUser.getId();
            long sessionCountBefore = searchSessionRepository.countByUser_Id(userId);
            assertThat(sessionCountBefore).isEqualTo(2);

            // Act
            userRepository.deleteById(userId);

            // Assert
            long sessionCountAfter = searchSessionRepository.countByUser_Id(userId);
            assertThat(sessionCountAfter)
                .as("Sessions should be cascade deleted when User is deleted")
                .isEqualTo(0);
        }
    }

    // =========================================================================
    //  2. RELATIONSHIP CHANGES
    // =========================================================================

    @Nested
    @DisplayName("Relationship Changes")
    class RelationshipChangeTest {

        @Test
        @DisplayName("Update ManyToOne: reasignar SearchSession a otro User")
        void givenSearchSessionWithUser_whenChangeUser_thenForeignKeyUpdated() {
            // Arrange
            User user1 = createUser("user1", "user1@test.edu", Role.ROLE_STUDENT);
            User savedUser1 = userRepository.save(user1);

            User user2 = createUser("user2", "user2@test.edu", Role.ROLE_STUDENT);
            User savedUser2 = userRepository.save(user2);

            SearchSession session = new SearchSession();
            session.setUser(savedUser1);
            session.setOriginalQuery("Initial query");
            session.setStartedAt(LocalDateTime.now());
            SearchSession savedSession = searchSessionRepository.save(session);

            // Act
            SearchSession toUpdate = searchSessionRepository.findById(savedSession.getId())
                .orElseThrow();
            toUpdate.setUser(savedUser2);
            searchSessionRepository.save(toUpdate);

            // Assert
            SearchSession updated = searchSessionRepository.findById(savedSession.getId())
                .orElseThrow();
            assertThat(updated.getUser().getId())
                .as("Session should be associated with user2")
                .isEqualTo(savedUser2.getId());
        }
    }

    // =========================================================================
    //  3. PAGINATION
    // =========================================================================

    @Nested
    @DisplayName("Pagination")
    class PaginationTest {

        @Test
        @DisplayName("Page<User> findByRole con PageRequest")
        void givenManyUsers_whenFindByRoleWithPagination_thenReturnsPaginatedResults() {
            // Arrange
            for (int i = 1; i <= 15; i++) {
                User student = createUser("student_" + i, "student_" + i + "@test.edu", 
                    Role.ROLE_STUDENT);
                userRepository.save(student);
            }

            // Act
            Page<User> page1 = userRepository.findByRole(
                Role.ROLE_STUDENT,
                PageRequest.of(0, 10)
            );

            // Assert
            assertThat(page1.getContent())
                .as("First page should have 10 elements")
                .hasSize(10);
            assertThat(page1.getTotalElements())
                .as("Total should be 15")
                .isEqualTo(15);
            assertThat(page1.getTotalPages())
                .as("Total pages should be 2")
                .isEqualTo(2);

            Page<User> page2 = userRepository.findByRole(
                Role.ROLE_STUDENT,
                PageRequest.of(1, 10)
            );
            assertThat(page2.getContent())
                .as("Second page should have 5 elements")
                .hasSize(5);
        }
    }

    // =========================================================================
    //  4. JSON FIELDS
    // =========================================================================

    @Nested
    @DisplayName("JSON Fields")
    class JsonFieldTest {

        @Test
        @DisplayName("JSON en TEXT: guardar filtersApplied como JSON")
        void givenSearchSessionWithFilters_whenSaveJson_thenPersistsCorrectly() {
            // Arrange
            User user = createUser("json.user", "json@test.edu", Role.ROLE_STUDENT);
            User savedUser = userRepository.save(user);

            SearchSession session = new SearchSession();
            session.setUser(savedUser);
            session.setOriginalQuery("diabetes AND insulin");
            session.setTransformedQuery("(diabetes) AND (insulin OR insulin-like)");
            session.setStartedAt(LocalDateTime.now());
            session.setSearchEngine("PubMed");
            session.setResultsCount(450);
            
            String filtersJson = """
                {
                  "publicationYear": {"min": 2020, "max": 2024},
                  "studyType": ["RCT", "Cohort"],
                  "language": "English",
                  "hasFullText": true
                }
                """;
            session.setFiltersApplied(filtersJson);

            SearchSession savedSession = searchSessionRepository.save(session);

            // Act & Assert
            SearchSession retrieved = searchSessionRepository.findById(savedSession.getId())
                .orElseThrow();
            assertThat(retrieved.getFiltersApplied())
                .as("JSON filters should persist correctly")
                .isNotNull()
                .contains("publicationYear")
                .contains("2020");
        }
    }

    // =========================================================================
    //  5. ELEMENT COLLECTION
    // =========================================================================

    @Nested
    @DisplayName("@ElementCollection")
    class ElementCollectionTest {

        @Test
        @DisplayName("@ElementCollection: MeSH terms persistidos en tabla separada")
        void givenSearchResultWithMeshTerms_whenSave_thenElementCollectionPersisted() {
            // Arrange
            SearchResult result = new SearchResult();
            result.setPmid("12345678");
            result.setTitle("Efficacy of immunotherapy in cancer treatment");
            result.setAbstractText("This study evaluates immunotherapy effectiveness...");
            result.setAuthors("Smith J, Johnson A, Brown B");
            result.setJournal("Nature Medicine");
            result.setPublicationDate(LocalDate.of(2024, 1, 15));
            result.setPublicationYear(2024);
            result.setStudyType(StudyType.RANDOMIZED_CONTROLLED_TRIAL);
            result.setEvidenceLevel(1);
            result.setRelevanceScore(0.95);
            result.setHasFullText(true);
            result.setFullTextUrl("https://example.com/article.pdf");
            result.setSampleSize(500);
            result.setHasConflictOfInterest(false);
            result.setDoi("10.1038/s41591-024-01234");
            
            result.setMeshTerms(List.of(
                "Immunotherapy",
                "Neoplasms",
                "Humans",
                "Clinical Trials as Topic",
                "Treatment Outcome"
            ));

            searchResultRepository.save(result);

            // Act & Assert
            SearchResult retrieved = searchResultRepository.findByPmid("12345678")
                .orElseThrow();
            assertThat(retrieved.getMeshTerms())
                .as("MeSH terms should persist in @ElementCollection")
                .hasSize(5)
                .contains("Immunotherapy", "Neoplasms");
        }
    }

    // =========================================================================
    //  6. ENTITY SYNCHRONIZATION
    // =========================================================================

    @Nested
    @DisplayName("Entity Synchronization")
    class SynchronizationTest {

        @Test
        @DisplayName("Sincronización herencia: cambio en Student reflejado en User")
        void givenStudent_whenUpdateBaseClassField_thenChangeVisibleInBothTables() {
            // Arrange
            Student student = new Student();
            student.setUsername("sync.student");
            student.setEmail("sync@test.edu");
            student.setPasswordHash("$2a$10$hash");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty("Medicina");
            student.setActive(true);
            student.setCreatedAt(LocalDateTime.now());
            student.setUpdatedAt(LocalDateTime.now());
            student.setStudentId("MED2024000789");
            student.setYearOfStudy(2);
            student.setProgram("Medicina General");

            Student saved = studentRepository.save(student);

            // Act
            Student toUpdate = studentRepository.findById(saved.getId()).orElseThrow();
            toUpdate.setActive(false);
            toUpdate.setUpdatedAt(LocalDateTime.now());
            studentRepository.save(toUpdate);

            // Assert
            Student retrievedStudent = studentRepository.findById(saved.getId()).orElseThrow();
            assertThat(retrievedStudent.isActive())
                .as("Active field should be synchronized in Student")
                .isFalse();

            User retrievedUser = userRepository.findById(saved.getId()).orElseThrow();
            assertThat(retrievedUser.isActive())
                .as("Active field should be synchronized in User")
                .isFalse();
        }

        @Test
        @DisplayName("OneToOne sincronización: Student → CompetencyProgress")
        void givenStudentWithCompetencyProgress_whenUpdateProgress_thenChangePersisted() {
            // Arrange
            Student student = new Student();
            student.setUsername("progress.student");
            student.setEmail("progress@test.edu");
            student.setPasswordHash("$2a$10$hash");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty("Medicina");
            student.setActive(true);
            student.setCreatedAt(LocalDateTime.now());
            student.setUpdatedAt(LocalDateTime.now());
            student.setStudentId("MED2024001000");
            student.setYearOfStudy(3);

            Student saved = studentRepository.save(student);

            CompetencyProgress progress = new CompetencyProgress();
            progress.setStudent(saved);
            progress.setAccessScore(65.0);
            progress.setProcessingScore(58.5);
            progress.setCommunicationScore(70.0);
            progress.setLastUpdated(LocalDateTime.now());

            competencyProgressRepository.save(progress);

            // Act
            CompetencyProgress toUpdate = 
                competencyProgressRepository.findByStudentId(saved.getId()).orElseThrow();
            toUpdate.setAccessScore(85.5);
            toUpdate.setProcessingScore(82.0);
            toUpdate.setLastUpdated(LocalDateTime.now());
            competencyProgressRepository.save(toUpdate);

            // Assert
            CompetencyProgress updated = 
                competencyProgressRepository.findByStudentId(saved.getId()).orElseThrow();
            assertThat(updated.getAccessScore())
                .as("AccessScore should be updated")
                .isEqualTo(85.5);
            assertThat(updated.getProcessingScore())
                .as("ProcessingScore should be updated")
                .isEqualTo(82.0);
        }
    }

    // =========================================================================
    //  7. CUSTOM QUERIES
    // =========================================================================

    @Nested
    @DisplayName("Custom Queries")
    class CustomQueryTest {

        @Test
        @DisplayName("findByPmid: búsqueda de artículo por PMID único")
        void givenSearchResult_whenFindByPmid_thenReturnsUniqueArticle() {
            // Arrange
            SearchResult result1 = new SearchResult();
            result1.setPmid("30123456");
            result1.setTitle("Study 1");

            SearchResult result2 = new SearchResult();
            result2.setPmid("31234567");
            result2.setTitle("Study 2");

            searchResultRepository.save(result1);
            searchResultRepository.save(result2);

            // Act
            Optional<SearchResult> found = searchResultRepository.findByPmid("30123456");

            // Assert
            assertThat(found)
                .isPresent()
                .get()
                .extracting("title")
                .isEqualTo("Study 1");
        }
    }

    // =========================================================================
    //  8. TIMESTAMPS
    // =========================================================================

    @Nested
    @DisplayName("Timestamps")
    class TimestampTest {

        @Test
        @DisplayName("Timestamps: createdAt (creación), updatedAt (cambios)")
        void givenEntity_whenPersist_thenTimestampsAutoAssigned() {
            // Arrange & Act
            User user = createUser("timestamp.user", "timestamp@test.edu", Role.ROLE_STUDENT);
            LocalDateTime beforeSave = LocalDateTime.now();
            user.setCreatedAt(beforeSave);
            user.setUpdatedAt(beforeSave);

            User saved = userRepository.save(user);

            // Assert
            User retrieved = userRepository.findById(saved.getId()).orElseThrow();
            assertThat(retrieved.getCreatedAt())
                .as("CreatedAt should be set on insert")
                .isNotNull();
            assertThat(retrieved.getUpdatedAt())
                .as("UpdatedAt should be set on insert")
                .isNotNull();
        }
    }

    // =========================================================================
    //  Helper Methods
    // =========================================================================

    private User createUser(String username, String email, Role role) {
        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash("$2a$10$hash");
        user.setRole(role);
        user.setFaculty("Medicina");
        user.setActive(true);
        user.setCreatedAt(LocalDateTime.now());
        user.setUpdatedAt(LocalDateTime.now());
        return user;
    }
}
