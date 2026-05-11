package com.uci.competencia.persistence;

import com.uci.competencia.model.entity.*;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.*;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.*;

/**
 * Pruebas de integración de persistencia JPA con contexto Spring completo.
 *
 * Valida:
 * - Operaciones CRUD completas (Create, Read, Update, Delete)
 * - Persistencia real en base de datos H2 (modo PostgreSQL)
 * - Relaciones JPA (ManyToOne, OneToOne)
 * - Transacciones y rollback
 * - Constraints únicos (email, username)
 * - Consultas personalizadas findBy
 * - Herencia de tabla unida (Student extends User)
 * - Datos médicos coherentes con dominio de EduSearch
 *
 * Usando @SpringBootTest en lugar de @DataJpaTest para evitar
 * problemas de resolución de TestEntityManager en Spring Boot 4.
 *
 * @see com.uci.competencia.repository.UserRepository
 * @see com.uci.competencia.repository.SearchSessionRepository
 * @see com.uci.competencia.repository.StudentRepository
 * @see com.uci.competencia.repository.CompetencyProgressRepository
 */
@SpringBootTest
@ActiveProfiles("integration")
@Transactional
@DisplayName("PersistenceIntegrationTest - CRUD, Relaciones, Transacciones")
class PersistenceIntegrationTest {

    @Autowired
    private EntityManager em;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private SearchSessionRepository searchSessionRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private CompetencyProgressRepository competencyProgressRepository;

    private static final String STUDENT_EMAIL = "laura.medina@universidad.edu";
    private static final String FACULTY_MEDICINA = "Medicina";

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        searchSessionRepository.deleteAll();
        competencyProgressRepository.deleteAll();
    }

    // =========================================================================
    //  1. CRUD DE USER
    // =========================================================================

    @Nested
    @DisplayName("User CRUD Operations")
    class UserCrudTest {

        @Test
        @DisplayName("CREATE: Crear usuario investigador m\u00e9dico")
        void givenValidUserData_whenSave_thenPersistsInDatabase() {
            User researcher = new User();
            researcher.setUsername("dr.carlos.lopez");
            researcher.setEmail("carlos.lopez@hospital.edu");
            researcher.setPasswordHash("$2a$10$bcrypt_hash_example");
            researcher.setFirstName("Carlos");
            researcher.setLastName("L\u00f3pez Garc\u00eda");
            researcher.setRole(Role.ROLE_PROFESSOR);
            researcher.setFaculty("Medicina");
            researcher.setDepartment("Infectolog\u00eda");
            researcher.setActive(true);
            researcher.setCreatedAt(LocalDateTime.now());
            researcher.setUpdatedAt(LocalDateTime.now());

            User saved = userRepository.save(researcher);
            em.flush();
            em.clear();

            Optional<User> retrieved = userRepository.findByEmail("carlos.lopez@hospital.edu");
            assertThat(retrieved).isPresent();
            assertThat(retrieved.get().getUsername()).isEqualTo("dr.carlos.lopez");
            assertThat(retrieved.get().getRole()).isEqualTo(Role.ROLE_PROFESSOR);
            assertThat(retrieved.get().getFaculty()).isEqualTo("Medicina");
            assertThat(retrieved.get().isActive()).isTrue();
            assertThat(retrieved.get().getId()).isNotNull();
        }

        @Test
        @DisplayName("READ: Obtener usuario por email")
        void givenSavedUser_whenFindByEmail_thenReturnsUserFromDatabase() {
            User student = new User();
            student.setUsername("laura.medina");
            student.setEmail(STUDENT_EMAIL);
            student.setPasswordHash("$2a$10$hashed_password_example_1");
            student.setFirstName("Laura");
            student.setLastName("Medina Ruiz");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty(FACULTY_MEDICINA);
            student.setDepartment("Epidemiolog\u00eda");
            student.setActive(true);
            student.setCreatedAt(LocalDateTime.now());
            student.setUpdatedAt(LocalDateTime.now());
            userRepository.save(student);
            em.flush();
            em.clear();

            Optional<User> result = userRepository.findByEmail(STUDENT_EMAIL);
            assertThat(result).isPresent();
            assertThat(result.get().getUsername()).isEqualTo("laura.medina");
            assertThat(result.get().getRole()).isEqualTo(Role.ROLE_STUDENT);
        }

        @Test
        @DisplayName("UPDATE: Actualizar usuario (lastLogin)")
        void givenSavedUser_whenUpdateLastLogin_thenPersistsChange() {
            User user = new User();
            user.setUsername("test.user");
            user.setEmail("test@ejemplo.edu");
            user.setPasswordHash("$2a$10$hashed");
            user.setRole(Role.ROLE_STUDENT);
            user.setFaculty("Medicina");
            user.setActive(true);
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
            em.flush();
            em.clear();

            User toUpdate = userRepository.findByEmail("test@ejemplo.edu").orElseThrow();
            LocalDateTime loginTime = LocalDateTime.now();
            toUpdate.setLastLogin(loginTime);
            userRepository.save(toUpdate);
            em.flush();
            em.clear();

            User updated = userRepository.findByEmail("test@ejemplo.edu").orElseThrow();
            assertThat(updated.getLastLogin()).isEqualTo(loginTime);
        }

        @Test
        @DisplayName("DELETE: Eliminar usuario")
        void givenSavedUser_whenDelete_thenRemovedFromDatabase() {
            User user = new User();
            user.setUsername("to.delete");
            user.setEmail("delete@test.edu");
            user.setPasswordHash("$2a$10$hash");
            user.setRole(Role.ROLE_STUDENT);
            user.setFaculty("Medicina");
            user.setActive(true);
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            User saved = userRepository.save(user);
            String userId = saved.getId();
            em.flush();
            em.clear();

            userRepository.deleteById(userId);
            em.flush();
            em.clear();

            Optional<User> result = userRepository.findById(userId);
            assertThat(result).isEmpty();
        }
    }

    // =========================================================================
    //  2. CONSTRAINTS
    // =========================================================================

    @Nested
    @DisplayName("Database Constraints - Unique, Not Null")
    class ConstraintValidationTest {

        @Test
        @DisplayName("UNIQUE constraint email")
        void givenDuplicateEmail_whenSave_thenThrowsConstraintException() {
            User user1 = new User();
            user1.setUsername("user1");
            user1.setEmail("duplicate@test.edu");
            user1.setPasswordHash("$2a$10$hash1");
            user1.setRole(Role.ROLE_STUDENT);
            user1.setFaculty("Medicina");
            user1.setActive(true);
            user1.setCreatedAt(LocalDateTime.now());
            user1.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user1);
            em.flush();

            User user2 = new User();
            user2.setUsername("user2");
            user2.setEmail("duplicate@test.edu");
            user2.setPasswordHash("$2a$10$hash2");
            user2.setRole(Role.ROLE_STUDENT);
            user2.setFaculty("Medicina");
            user2.setActive(true);
            user2.setCreatedAt(LocalDateTime.now());
            user2.setUpdatedAt(LocalDateTime.now());

            assertThatThrownBy(() -> {
                userRepository.save(user2);
                em.flush();
            }).isInstanceOf(Exception.class);
        }

        @Test
        @DisplayName("UNIQUE constraint username")
        void givenDuplicateUsername_whenSave_thenThrowsConstraintException() {
            User user1 = new User();
            user1.setUsername("duplicate.user");
            user1.setEmail("email1@test.edu");
            user1.setPasswordHash("$2a$10$hash1");
            user1.setRole(Role.ROLE_STUDENT);
            user1.setFaculty("Medicina");
            user1.setActive(true);
            user1.setCreatedAt(LocalDateTime.now());
            user1.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user1);
            em.flush();

            User user2 = new User();
            user2.setUsername("duplicate.user");
            user2.setEmail("email2@test.edu");
            user2.setPasswordHash("$2a$10$hash2");
            user2.setRole(Role.ROLE_STUDENT);
            user2.setFaculty("Medicina");
            user2.setActive(true);
            user2.setCreatedAt(LocalDateTime.now());
            user2.setUpdatedAt(LocalDateTime.now());

            assertThatThrownBy(() -> {
                userRepository.save(user2);
                em.flush();
            }).isInstanceOf(Exception.class);
        }
    }

    // =========================================================================
    //  3. RELACIONES JPA
    // =========================================================================

    @Nested
    @DisplayName("JPA Relationships - Foreign Keys")
    class RelationshipTest {

        @Test
        @DisplayName("ManyToOne: SearchSession -> User")
        void givenUserAndSearchSession_whenSaveSession_thenForeignKeyPersisted() {
            User user = new User();
            user.setUsername("researcher.1");
            user.setEmail("researcher1@hospital.edu");
            user.setPasswordHash("$2a$10$hash");
            user.setRole(Role.ROLE_STUDENT);
            user.setFaculty("Medicina");
            user.setActive(true);
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            User savedUser = userRepository.save(user);
            em.flush();

            SearchSession session = new SearchSession();
            session.setUser(savedUser);
            session.setOriginalQuery("COVID-19 AND ventilator");
            session.setTransformedQuery("coronavirus AND (mechanical ventilation)");
            session.setStartedAt(LocalDateTime.now());
            session.setSearchEngine("PubMed");
            session.setResultsCount(250);
            SearchSession savedSession = searchSessionRepository.save(session);
            em.flush();
            em.clear();

            SearchSession retrieved = searchSessionRepository.findById(savedSession.getId()).orElseThrow();
            assertThat(retrieved.getUser()).isNotNull();
            assertThat(retrieved.getUser().getEmail()).isEqualTo("researcher1@hospital.edu");
        }

        @Test
        @DisplayName("OneToOne: Student -> CompetencyProgress")
        void givenStudentAndCompetencyProgress_whenSave_thenRelationshipPersisted() {
            Student student = new Student();
            student.setUsername("med.student.1");
            student.setEmail("med.student1@universidad.edu");
            student.setPasswordHash("$2a$10$hash");
            student.setFirstName("Maria");
            student.setLastName("Garcia");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty("Medicina");
            student.setDepartment("Cardiolog\u00eda");
            student.setActive(true);
            student.setCreatedAt(LocalDateTime.now());
            student.setUpdatedAt(LocalDateTime.now());
            student.setStudentId("MED202600123");
            student.setYearOfStudy(4);
            student.setProgram("Medicina General");
            Student savedStudent = studentRepository.save(student);
            em.flush();

            CompetencyProgress progress = new CompetencyProgress();
            progress.setStudent(savedStudent);
            progress.setAccessScore(85.5);
            progress.setTotalSearches(42);
            progress.setSuccessfulSearches(38);
            progress.setAvgSearchTime(120.5);
            progress.setMeshTermsMastered(15);
            progress.setProcessingScore(78.3);
            progress.setCommunicationScore(82.0);
            progress.setLastUpdated(LocalDateTime.now());
            competencyProgressRepository.save(progress);
            em.flush();
            em.clear();

            Optional<CompetencyProgress> retrieved =
                competencyProgressRepository.findByStudentId(savedStudent.getId());
            assertThat(retrieved).isPresent();
            assertThat(retrieved.get().getAccessScore()).isEqualTo(85.5);
        }
    }

    // =========================================================================
    //  4. CONSULTAS PERSONALIZADAS
    // =========================================================================

    @Nested
    @DisplayName("Custom Queries - findBy, Pagination")
    class CustomQueriesTest {

        @Test
        @DisplayName("findByRole: buscar usuarios por rol")
        void givenMultipleUsers_whenFindByRole_thenReturnsFilteredUsers() {
            User student = new User();
            student.setUsername("student.1");
            student.setEmail("student@test.edu");
            student.setPasswordHash("$2a$10$hash");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty("Medicina");
            student.setActive(true);
            student.setCreatedAt(LocalDateTime.now());
            student.setUpdatedAt(LocalDateTime.now());
            userRepository.save(student);

            User professor = new User();
            professor.setUsername("prof.1");
            professor.setEmail("prof@test.edu");
            professor.setPasswordHash("$2a$10$hash");
            professor.setRole(Role.ROLE_PROFESSOR);
            professor.setFaculty("Medicina");
            professor.setActive(true);
            professor.setCreatedAt(LocalDateTime.now());
            professor.setUpdatedAt(LocalDateTime.now());
            userRepository.save(professor);

            em.flush();
            em.clear();

            List<User> professors = userRepository.findByRole(Role.ROLE_PROFESSOR);
            List<User> students = userRepository.findByRole(Role.ROLE_STUDENT);

            assertThat(professors).hasSize(1);
            assertThat(professors).allMatch(u -> u.getRole() == Role.ROLE_PROFESSOR);
            assertThat(students).hasSize(1);
            assertThat(students).allMatch(u -> u.getRole() == Role.ROLE_STUDENT);
        }

        @Test
        @DisplayName("existsByEmail: verificar existencia")
        void givenUser_whenExistsByEmail_thenReturnsTrue() {
            User user = new User();
            user.setUsername("exists.test");
            user.setEmail("exists@test.edu");
            user.setPasswordHash("$2a$10$hash");
            user.setRole(Role.ROLE_STUDENT);
            user.setFaculty("Medicina");
            user.setActive(true);
            user.setCreatedAt(LocalDateTime.now());
            user.setUpdatedAt(LocalDateTime.now());
            userRepository.save(user);
            em.flush();
            em.clear();

            assertThat(userRepository.existsByEmail("exists@test.edu")).isTrue();
            assertThat(userRepository.existsByEmail("nonexistent@test.edu")).isFalse();
        }

        @Test
        @DisplayName("countByRole: contar usuarios por rol")
        void givenMultipleUsers_whenCountByRole_thenReturnsCorrectCount() {
            for (int i = 0; i < 3; i++) {
                User s = new User();
                s.setUsername("student_" + i);
                s.setEmail("student_" + i + "@test.edu");
                s.setPasswordHash("$2a$10$hash");
                s.setRole(Role.ROLE_STUDENT);
                s.setFaculty("Medicina");
                s.setActive(true);
                s.setCreatedAt(LocalDateTime.now());
                s.setUpdatedAt(LocalDateTime.now());
                userRepository.save(s);
            }

            User prof = new User();
            prof.setUsername("prof_1");
            prof.setEmail("prof_1@test.edu");
            prof.setPasswordHash("$2a$10$hash");
            prof.setRole(Role.ROLE_PROFESSOR);
            prof.setFaculty("Medicina");
            prof.setActive(true);
            prof.setCreatedAt(LocalDateTime.now());
            prof.setUpdatedAt(LocalDateTime.now());
            userRepository.save(prof);

            em.flush();
            em.clear();

            assertThat(userRepository.countByRole(Role.ROLE_STUDENT)).isEqualTo(3);
            assertThat(userRepository.countByRole(Role.ROLE_PROFESSOR)).isEqualTo(1);
        }
    }

    // =========================================================================
    //  5. HERENCIA JOINED TABLE
    // =========================================================================

    @Nested
    @DisplayName("Joined Table Inheritance - Student extends User")
    class InheritanceTest {

        @Test
        @DisplayName("Herencia: crear Student")
        void givenStudentData_whenSave_thenInsertsInBothTables() {
            Student student = new Student();
            student.setUsername("herencia.student");
            student.setEmail("herencia@universidad.edu");
            student.setPasswordHash("$2a$10$hash");
            student.setFirstName("Juan");
            student.setLastName("P\u00e9rez");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty("Medicina");
            student.setDepartment("Cirug\u00eda");
            student.setActive(true);
            student.setCreatedAt(LocalDateTime.now());
            student.setUpdatedAt(LocalDateTime.now());
            student.setStudentId("MED202600456");
            student.setYearOfStudy(3);
            student.setProgram("Medicina General");

            Student saved = studentRepository.save(student);
            em.flush();
            em.clear();

            Optional<Student> retrieved = studentRepository.findById(saved.getId());
            assertThat(retrieved).isPresent();
            assertThat(retrieved.get().getStudentId()).isEqualTo("MED202600456");
            assertThat(retrieved.get().getYearOfStudy()).isEqualTo(3);

            Optional<User> asUser = userRepository.findByEmail("herencia@universidad.edu");
            assertThat(asUser).isPresent();
            assertThat(asUser.get()).isInstanceOf(Student.class);
        }
    }
}