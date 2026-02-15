package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.dto.response.CaseSubmissionDTO;
import com.uci.competencia.model.dto.response.StudentAssignmentOptionDTO;
import com.uci.competencia.model.entity.CaseStudy;
import com.uci.competencia.model.entity.CaseSubmission;
import com.uci.competencia.model.entity.Evaluation;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.CaseDifficulty;
import com.uci.competencia.model.enums.CaseStatus;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.model.enums.SubmissionStatus;
import com.uci.competencia.repository.CaseStudyRepository;
import com.uci.competencia.repository.EvaluationRepository;
import com.uci.competencia.repository.CaseSubmissionRepository;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.CaseService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
@Transactional(readOnly = true)
public class CaseServiceImpl implements CaseService {

    private final CaseStudyRepository caseStudyRepository;
    private final CaseSubmissionRepository caseSubmissionRepository;
    private final EvaluationRepository evaluationRepository;
    private final UserRepository userRepository;
    private final ObjectMapper objectMapper;

    @Override
    public List<CaseStudyDTO> getAllCases(CaseStatus status) {
        List<CaseStudy> cases = status != null ?
            caseStudyRepository.findByStatus(status) :
            caseStudyRepository.findAll();

        return cases.stream()
            .map(caseStudy -> {
                try {
                    return convertToDTO(caseStudy);
                } catch (Exception e) {
                    log.warn("Skipping case {} due to conversion error: {}", caseStudy.getId(), e.getMessage());
                    return null;
                }
            })
            .filter(java.util.Objects::nonNull)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseStudyDTO> getProfessorCases(String professorIdentifier, CaseStatus status) {
        Set<String> identifiers = resolveUserIdentifiers(professorIdentifier);
        if (identifiers.isEmpty()) {
            return List.of();
        }

        List<CaseStudy> allCases = new ArrayList<>();
        for (String identifier : identifiers) {
            allCases.addAll(caseStudyRepository.findByCreatedBy(identifier));
        }

        return allCases.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toMap(
                CaseStudy::getId,
                caseStudy -> caseStudy,
                (existing, replacement) -> existing
            ))
            .values()
            .stream()
            .filter(caseStudy -> status == null || caseStudy.getStatus() == status)
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public Optional<CaseStudyDTO> getCaseById(String id) {
        return caseStudyRepository.findById(id)
            .map(this::convertToDTO);
    }

    @Override
    public boolean isCaseOwnedByProfessor(String caseId, String professorIdentifier) {
        Set<String> identifiers = resolveUserIdentifiers(professorIdentifier);
        if (identifiers.isEmpty()) {
            return false;
        }

        return caseStudyRepository.findById(caseId)
            .map(caseStudy -> identifiers.contains(caseStudy.getCreatedBy()))
            .orElse(false);
    }

    @Override
    public boolean isStudentAssignedToCase(String caseId, String studentIdentifier) {
        return caseStudyRepository.findById(caseId)
            .map(caseStudy -> matchesAssignedStudent(caseStudy.getAssignedStudents(), studentIdentifier))
            .orElse(false);
    }

    @Override
    @Transactional
    public CaseStudyDTO createCase(CaseStudyDTO caseStudyDTO, String professorId) {
        CaseStudy caseStudy = convertToEntity(caseStudyDTO);
        String normalizedProfessor = resolvePrimaryUserIdentifier(professorId);
        caseStudy.setCreatedBy(normalizedProfessor);
        caseStudy.setAssignedStudents(normalizeStudentAssignments(caseStudy.getAssignedStudents()));
        if (caseStudy.getStatus() == null) {
            caseStudy.setStatus(CaseStatus.DRAFT);
        }
        if (!caseStudy.getAssignedStudents().isEmpty() && caseStudy.getStatus() == CaseStatus.DRAFT) {
            caseStudy.setStatus(CaseStatus.ACTIVE);
        }

        CaseStudy saved = caseStudyRepository.save(caseStudy);
        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public CaseStudyDTO updateCase(String id, CaseStudyDTO caseStudyDTO) {
        CaseStudy existing = caseStudyRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Case not found: " + id));

        // Update fields
        if (caseStudyDTO.getTitle() != null) {
            existing.setTitle(caseStudyDTO.getTitle());
        }
        if (caseStudyDTO.getScenario() != null) {
            existing.setScenario(caseStudyDTO.getScenario());
        }
        if (caseStudyDTO.getDifficulty() != null) {
            try {
                existing.setDifficulty(CaseDifficulty.valueOf(caseStudyDTO.getDifficulty().toUpperCase()));
            } catch (IllegalArgumentException e) {
                log.warn("Invalid difficulty {}, keeping existing", caseStudyDTO.getDifficulty());
            }
        }
        if (caseStudyDTO.getStatus() != null) {
            try {
                existing.setStatus(CaseStatus.valueOf(caseStudyDTO.getStatus().toUpperCase()));
            } catch (IllegalArgumentException e) {
                log.warn("Invalid status {}, keeping existing", caseStudyDTO.getStatus());
            }
        }
        if (caseStudyDTO.getRequiredArticles() != null) {
            existing.setRequiredArticles(caseStudyDTO.getRequiredArticles());
        }
        if (caseStudyDTO.getOptionalArticles() != null) {
            existing.setOptionalArticles(caseStudyDTO.getOptionalArticles());
        }
        if (caseStudyDTO.getGuidingQuestions() != null) {
            existing.setGuidingQuestions(caseStudyDTO.getGuidingQuestions());
        }
        if (caseStudyDTO.getRubric() != null) {
            existing.setRubric(caseStudyDTO.getRubric().stream()
                .map(this::convertRubricToJson)
                .collect(Collectors.toList()));
        }
        if (caseStudyDTO.getAssignedStudents() != null) {
            existing.setAssignedStudents(normalizeStudentAssignments(caseStudyDTO.getAssignedStudents()));
            if (!existing.getAssignedStudents().isEmpty() && existing.getStatus() == CaseStatus.DRAFT) {
                existing.setStatus(CaseStatus.ACTIVE);
            }
        }
        if (caseStudyDTO.getDueDate() != null) {
            existing.setDueDate(caseStudyDTO.getDueDate());
        }
        if (caseStudyDTO.getStartDate() != null) {
            existing.setStartDate(caseStudyDTO.getStartDate());
        }

        CaseStudy saved = caseStudyRepository.save(existing);
        return convertToDTO(saved);
    }

    @Override
    @Transactional
    public void deleteCase(String id) {
        caseStudyRepository.deleteById(id);
    }

    @Override
    @Transactional
    public CaseStudyDTO assignStudents(String caseId, List<String> studentIds) {
        CaseStudy caseStudy = caseStudyRepository.findById(caseId)
            .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));

        List<String> normalizedStudents = normalizeStudentAssignments(studentIds);
        caseStudy.setAssignedStudents(normalizedStudents);
        if (!normalizedStudents.isEmpty()) {
            caseStudy.setStatus(CaseStatus.ACTIVE);
        } else if (caseStudy.getStatus() == CaseStatus.ACTIVE) {
            caseStudy.setStatus(CaseStatus.DRAFT);
        }

        CaseStudy saved = caseStudyRepository.save(caseStudy);
        return convertToDTO(saved);
    }

    @Override
    public List<CaseSubmissionDTO> getCaseSubmissions(String caseId) {
        List<CaseSubmission> submissions = caseSubmissionRepository.findByCaseId(caseId);
        return submissions.stream()
            .map(this::convertSubmissionToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseStudyDTO> getAssignedCases(String studentId) {
        Set<String> identifiers = resolveUserIdentifiers(studentId);
        if (identifiers.isEmpty()) {
            return List.of();
        }

        List<CaseStudy> cases = new ArrayList<>();
        for (String identifier : identifiers) {
            cases.addAll(caseStudyRepository.findByAssignedStudent(identifier));
        }

        return cases.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toMap(
                CaseStudy::getId,
                caseStudy -> caseStudy,
                (existing, replacement) -> existing
            ))
            .values()
            .stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<CaseStudyDTO> getAssignedCasesByStatus(String studentId, CaseStatus status) {
        Set<String> identifiers = resolveUserIdentifiers(studentId);
        if (identifiers.isEmpty()) {
            return List.of();
        }

        List<CaseStudy> cases = new ArrayList<>();
        for (String identifier : identifiers) {
            cases.addAll(caseStudyRepository.findByAssignedStudentAndStatus(identifier, status));
        }

        return cases.stream()
            .filter(Objects::nonNull)
            .collect(Collectors.toMap(
                CaseStudy::getId,
                caseStudy -> caseStudy,
                (existing, replacement) -> existing
            ))
            .values()
            .stream()
            .map(this::convertToDTO)
            .collect(Collectors.toList());
    }

    @Override
    public List<StudentAssignmentOptionDTO> getAssignableStudents() {
        return userRepository.findByRole(Role.ROLE_STUDENT).stream()
            .filter(Objects::nonNull)
            .map(this::toStudentAssignmentOption)
            .sorted(Comparator.comparing(
                StudentAssignmentOptionDTO::getFullName,
                String.CASE_INSENSITIVE_ORDER
            ))
            .toList();
    }

    @Override
    @Transactional
    public CaseSubmissionDTO submitCase(String caseId, String studentId, CaseSubmissionDTO submissionDTO) {
        // Check if case exists and is assigned to student
        CaseStudy caseStudy = caseStudyRepository.findById(caseId)
            .orElseThrow(() -> new RuntimeException("Case not found: " + caseId));

        if (!matchesAssignedStudent(caseStudy.getAssignedStudents(), studentId)) {
            throw new RuntimeException("Case not assigned to student: " + studentId);
        }

        String canonicalStudentId = resolveCanonicalStudentId(studentId);

        CaseSubmission submission = new CaseSubmission();
        submission.setCaseId(caseId);
        submission.setStudentId(canonicalStudentId);
        submission.setContent(submissionDTO.getContent());
        submission.setSelectedArticles(submissionDTO.getSelectedArticles());
        submission.setBibliography(submissionDTO.getBibliography());
        submission.setStatus(SubmissionStatus.PENDING);

        CaseSubmission saved = caseSubmissionRepository.save(submission);
        return convertSubmissionToDTO(saved);
    }

    @Override
    public Optional<CaseSubmissionDTO> getSubmission(String caseId, String studentId) {
        Set<String> identifiers = resolveUserIdentifiers(studentId);
        if (identifiers.isEmpty()) {
            return Optional.empty();
        }
        List<CaseSubmission> submissions = caseSubmissionRepository.findByCaseIdAndStudentIdInOrderBySubmittedAtDesc(
            caseId,
            new ArrayList<>(identifiers)
        );
        if (submissions.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(convertSubmissionToDTO(submissions.get(0)));
    }

    @Override
    public List<CaseSubmissionDTO> getStudentSubmissions(String studentId) {
        Set<String> identifiers = resolveUserIdentifiers(studentId);
        List<CaseSubmission> submissions = identifiers.stream()
            .flatMap(identifier -> caseSubmissionRepository.findByStudentId(identifier).stream())
            .toList();
        return submissions.stream()
            .map(this::convertSubmissionToDTO)
            .collect(Collectors.toList());
    }

    @Override
    @Transactional
    public CaseSubmissionDTO evaluateSubmission(String submissionId, CaseSubmissionDTO.EvaluationDTO evaluationDTO, String professorId) {
        CaseSubmission submission = caseSubmissionRepository.findById(submissionId)
            .orElseThrow(() -> new RuntimeException("Submission not found: " + submissionId));

        // Crear y guardar evaluaciÃ³n
        Evaluation evaluation = new Evaluation();
        evaluation.setSubmissionId(submissionId);
        evaluation.setProfessorId(professorId);
        
        // Convertir scores a JSON
        String scoresJson = convertScoresToJson(evaluationDTO.getScores());
        evaluation.setScores(scoresJson);
        
        // Convertir comments a JSON
        String commentsJson = convertCommentsToJson(evaluationDTO.getComments());
        evaluation.setComments(commentsJson);
        
        evaluation.setOverallScore(evaluationDTO.getOverallScore());
        evaluation.setFeedback(evaluationDTO.getFeedback());
        
        evaluationRepository.save(evaluation);
        
        // Actualizar estado de la entrega
        submission.setStatus(SubmissionStatus.REVIEWED);
        CaseSubmission saved = caseSubmissionRepository.save(submission);
        
        log.info("Evaluation saved for submission: {}", submissionId);
        
        return convertSubmissionToDTO(saved);
    }

    private String convertScoresToJson(CaseSubmissionDTO.EvaluationDTO.CompetencyScoresDTO scores) {
        return String.format(
            "{\"access\": %d, \"process\": %d, \"communicate\": %d}",
            scores.getAccess(),
            scores.getProcess(),
            scores.getCommunicate()
        );
    }

    private String convertCommentsToJson(CaseSubmissionDTO.EvaluationDTO.CompetencyCommentsDTO comments) {
        return String.format(
            "{\"access\": \"%s\", \"process\": \"%s\", \"communicate\": \"%s\"}",
            escapeJson(comments.getAccess()),
            escapeJson(comments.getProcess()),
            escapeJson(comments.getCommunicate())
        );
    }

    private String escapeJson(String value) {
        return value != null ? value.replace("\"", "\\\"").replace("\n", "\\n") : "";
    }

    private List<String> normalizeStudentAssignments(List<String> studentReferences) {
        if (studentReferences == null || studentReferences.isEmpty()) {
            return List.of();
        }

        LinkedHashSet<String> normalized = new LinkedHashSet<>();
        for (String reference : studentReferences) {
            if (reference == null || reference.isBlank()) {
                continue;
            }
            Optional<User> user = findUserByIdentifier(reference);
            if (user.isEmpty()) {
                log.warn("Skipping unresolved student reference during assignment: {}", reference);
                continue;
            }
            User resolved = user.get();
            if (resolved.getRole() != Role.ROLE_STUDENT) {
                log.warn("Skipping non-student reference during assignment: {}", reference);
                continue;
            }
            normalized.add(resolved.getId());
        }
        return new ArrayList<>(normalized);
    }

    private String resolvePrimaryUserIdentifier(String userIdentifier) {
        return findUserByIdentifier(userIdentifier)
            .map(user -> user.getEmail() != null && !user.getEmail().isBlank() ? user.getEmail() : user.getId())
            .orElse(userIdentifier);
    }

    private String resolveCanonicalStudentId(String studentIdentifier) {
        return findUserByIdentifier(studentIdentifier)
            .filter(user -> user.getRole() == Role.ROLE_STUDENT)
            .map(User::getId)
            .orElse(studentIdentifier);
    }

    private Optional<User> findUserByIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return Optional.empty();
        }
        String normalized = identifier.trim();
        try {
            Optional<User> byId = userRepository.findById(normalized);
            if (byId.isPresent()) {
                return byId;
            }
        } catch (Exception e) {
            log.debug("Identifier {} is not a direct user ID", normalized);
        }
        Optional<User> byEmail = userRepository.findByEmail(normalized);
        if (byEmail.isPresent()) {
            return byEmail;
        }
        return userRepository.findByUsername(normalized);
    }

    private Set<String> resolveUserIdentifiers(String userIdentifier) {
        if (userIdentifier == null || userIdentifier.isBlank()) {
            return Set.of();
        }

        LinkedHashSet<String> identifiers = new LinkedHashSet<>();
        identifiers.add(userIdentifier.trim());

        findUserByIdentifier(userIdentifier).ifPresent(user -> {
            if (user.getId() != null && !user.getId().isBlank()) {
                identifiers.add(user.getId());
            }
            if (user.getEmail() != null && !user.getEmail().isBlank()) {
                identifiers.add(user.getEmail());
            }
            if (user.getUsername() != null && !user.getUsername().isBlank()) {
                identifiers.add(user.getUsername());
            }
        });

        return identifiers;
    }

    private boolean matchesAssignedStudent(List<String> assignedStudents, String studentIdentifier) {
        if (assignedStudents == null || assignedStudents.isEmpty() || studentIdentifier == null || studentIdentifier.isBlank()) {
            return false;
        }
        Set<String> identifiers = resolveUserIdentifiers(studentIdentifier);
        if (identifiers.isEmpty()) {
            return false;
        }
        return assignedStudents.stream().anyMatch(identifiers::contains);
    }

    private StudentAssignmentOptionDTO toStudentAssignmentOption(User user) {
        String firstName = user.getFirstName() != null ? user.getFirstName().trim() : "";
        String lastName = user.getLastName() != null ? user.getLastName().trim() : "";
        String fullName = (firstName + " " + lastName).trim();
        if (fullName.isBlank()) {
            fullName = user.getUsername() != null && !user.getUsername().isBlank() ? user.getUsername() : user.getEmail();
        }
        return new StudentAssignmentOptionDTO(
            user.getId(),
            user.getEmail(),
            user.getUsername(),
            fullName,
            user.isActive()
        );
    }

    // Conversion methods
    private CaseStudyDTO convertToDTO(CaseStudy caseStudy) {
        CaseStudyDTO dto = new CaseStudyDTO();
        dto.setId(caseStudy.getId());
        dto.setTitle(caseStudy.getTitle());
        dto.setScenario(caseStudy.getScenario());
        CaseDifficulty difficulty = caseStudy.getDifficulty() != null
            ? caseStudy.getDifficulty()
            : CaseDifficulty.NOVICE;
        CaseStatus status = caseStudy.getStatus() != null
            ? caseStudy.getStatus()
            : CaseStatus.DRAFT;
        dto.setDifficulty(difficulty.name().toLowerCase());
        dto.setStatus(status.name().toLowerCase());
        dto.setRequiredArticles(safeList(caseStudy.getRequiredArticles()));
        dto.setOptionalArticles(safeList(caseStudy.getOptionalArticles()));
        dto.setGuidingQuestions(safeList(caseStudy.getGuidingQuestions()));
        dto.setCreatedBy(caseStudy.getCreatedBy());
        dto.setCreatedAt(caseStudy.getCreatedAt());
        dto.setStartDate(caseStudy.getStartDate());
        dto.setDueDate(caseStudy.getDueDate());
        dto.setAssignedStudents(safeList(caseStudy.getAssignedStudents()));

        // Convertir rÃºbrica: de List<String> (JSON) a List<RubricItemDTO>
        if (caseStudy.getRubric() != null && !caseStudy.getRubric().isEmpty()) {
            dto.setRubric(caseStudy.getRubric().stream()
                .map(this::parseRubricJson)
                .filter(java.util.Objects::nonNull)
                .collect(Collectors.toList()));
        } else {
            dto.setRubric(List.of());
        }

        return dto;
    }

    private CaseStudy convertToEntity(CaseStudyDTO dto) {
        CaseStudy entity = new CaseStudy();
        entity.setTitle(dto.getTitle());
        entity.setScenario(dto.getScenario());

        // Set difficulty
        if (dto.getDifficulty() != null) {
            try {
                entity.setDifficulty(CaseDifficulty.valueOf(dto.getDifficulty().toUpperCase()));
            } catch (IllegalArgumentException e) {
                entity.setDifficulty(CaseDifficulty.NOVICE); // default
            }
        } else {
            entity.setDifficulty(CaseDifficulty.NOVICE);
        }

        // Set status
        if (dto.getStatus() != null) {
            try {
                entity.setStatus(CaseStatus.valueOf(dto.getStatus().toUpperCase()));
            } catch (IllegalArgumentException e) {
                entity.setStatus(CaseStatus.DRAFT); // default
            }
        } else {
            entity.setStatus(CaseStatus.DRAFT);
        }

        entity.setRequiredArticles(safeList(dto.getRequiredArticles()));
        entity.setOptionalArticles(safeList(dto.getOptionalArticles()));
        entity.setGuidingQuestions(safeList(dto.getGuidingQuestions()));
        entity.setAssignedStudents(safeList(dto.getAssignedStudents()));

        entity.setStartDate(dto.getStartDate());
        entity.setDueDate(dto.getDueDate());

        // Convertir rÃºbrica: de List<RubricItemDTO> a List<String> (JSON)
        if (dto.getRubric() != null && !dto.getRubric().isEmpty()) {
            entity.setRubric(dto.getRubric().stream()
                .map(this::convertRubricToJson)
                .collect(Collectors.toList()));
        } else {
            entity.setRubric(List.of());
        }

        return entity;
    }

    private <T> List<T> safeList(List<T> value) {
        return value != null ? new java.util.ArrayList<>(value) : new java.util.ArrayList<>();
    }

    private CaseSubmissionDTO convertSubmissionToDTO(CaseSubmission submission) {
        CaseSubmissionDTO dto = new CaseSubmissionDTO();
        dto.setId(submission.getId());
        dto.setCaseId(submission.getCaseId());
        dto.setStudentId(submission.getStudentId());
        dto.setSubmittedAt(submission.getSubmittedAt());
        dto.setContent(submission.getContent());
        dto.setSelectedArticles(submission.getSelectedArticles());
        dto.setBibliography(submission.getBibliography());
        dto.setStatus(submission.getStatus().name().toLowerCase());

        // Incluir evaluaciÃ³n si existe
        Optional<Evaluation> evaluation = evaluationRepository.findBySubmissionId(submission.getId());
        if (evaluation.isPresent()) {
            dto.setEvaluation(convertEvaluationToDTO(evaluation.get()));
        } else {
            dto.setEvaluation(null);
        }

        return dto;
    }

    /**
     * Parsea un JSON string de rubric a RubricItemDTO
     * Formato esperado: {"competency":"access","criterion":"...","maxScore":20,"description":"..."}
     */
    private CaseStudyDTO.RubricItemDTO parseRubricJson(String jsonString) {
        try {
            if (jsonString == null || jsonString.isBlank()) {
                return null;
            }
            CaseStudyDTO.RubricItemDTO rubricItem =
                objectMapper.readValue(jsonString, CaseStudyDTO.RubricItemDTO.class);
            log.debug("Parsed rubric item: competency={}, criterion={}",
                rubricItem.getCompetency(), rubricItem.getCriterion());
            return rubricItem;
        } catch (Exception e) {
            log.warn("Error parsing rubric JSON: {}", jsonString, e);
            return null;
        }
    }

    /**
     * Convierte un RubricItemDTO a JSON string
     */
    private String convertRubricToJson(CaseStudyDTO.RubricItemDTO rubricItem) {
        try {
            if (rubricItem == null) {
                return "";
            }
            String json = objectMapper.writeValueAsString(rubricItem);
            log.debug("Converted rubric to JSON: {}", json);
            return json;
        } catch (Exception e) {
            log.warn("Error converting rubric to JSON", e);
            return "";
        }
    }

    /**
     * Extrae un campo de valor de un JSON string
     */
    private String extractJsonField(String json, String fieldName) {
        try {
            String pattern = "\"" + fieldName + "\":\"([^\"]*)\"";
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
            java.util.regex.Matcher m = p.matcher(json);
            
            if (m.find()) {
                return m.group(1);
            }
            
            // Si no es string, intentar con nÃºmero
            pattern = "\"" + fieldName + "\":(\\d+)";
            p = java.util.regex.Pattern.compile(pattern);
            m = p.matcher(json);
            
            if (m.find()) {
                return m.group(1);
            }
            
            return null;
            
        } catch (Exception e) {
            log.warn("Error extracting field {} from JSON", fieldName, e);
            return null;
        }
    }

    /**
     * Convierte una entidad Evaluation a EvaluationDTO
     */
    private CaseSubmissionDTO.EvaluationDTO convertEvaluationToDTO(Evaluation evaluation) {
        if (evaluation == null) {
            return null;
        }
        
        try {
            CaseSubmissionDTO.EvaluationDTO dto = new CaseSubmissionDTO.EvaluationDTO();
            dto.setId(evaluation.getId());
            dto.setSubmissionId(evaluation.getSubmissionId());
            dto.setProfessorId(evaluation.getProfessorId());
            
            // Parsear scores si estÃ¡n en JSON
            if (evaluation.getScoresJson() != null && !evaluation.getScoresJson().isEmpty()) {
                dto.setScores(parseCompetencyScores(evaluation.getScoresJson()));
            }
            
            // Parsear comments si estÃ¡n en JSON
            if (evaluation.getCommentsJson() != null && !evaluation.getCommentsJson().isEmpty()) {
                dto.setComments(parseCompetencyComments(evaluation.getCommentsJson()));
            }
            
            dto.setOverallScore(evaluation.getOverallScore());
            dto.setFeedback(evaluation.getFeedback());
            dto.setEvaluatedAt(evaluation.getEvaluatedAt());
            
            log.debug("Converted evaluation to DTO: {}", evaluation.getId());
            return dto;
            
        } catch (Exception e) {
            log.warn("Error converting evaluation to DTO: {}", evaluation.getId(), e);
            return null;
        }
    }

    /**
     * Parsea scores desde JSON string
     */
    private CaseSubmissionDTO.EvaluationDTO.CompetencyScoresDTO parseCompetencyScores(String jsonString) {
        try {
            CaseSubmissionDTO.EvaluationDTO.CompetencyScoresDTO scores = 
                new CaseSubmissionDTO.EvaluationDTO.CompetencyScoresDTO();
            
            // Extraer scores de acceso, procesamiento y comunicaciÃ³n
            String accessScore = extractJsonField(jsonString, "access");
            if (accessScore != null) {
                scores.setAccess(Integer.parseInt(accessScore));
            }
            
            String processScore = extractJsonField(jsonString, "process");
            if (processScore != null) {
                scores.setProcess(Integer.parseInt(processScore));
            }
            
            String commScore = extractJsonField(jsonString, "communicate");
            if (commScore != null) {
                scores.setCommunicate(Integer.parseInt(commScore));
            }
            
            return scores;
        } catch (Exception e) {
            log.warn("Error parsing competency scores", e);
            return new CaseSubmissionDTO.EvaluationDTO.CompetencyScoresDTO();
        }
    }

    /**
     * Parsea comments desde JSON string
     */
    private CaseSubmissionDTO.EvaluationDTO.CompetencyCommentsDTO parseCompetencyComments(String jsonString) {
        try {
            CaseSubmissionDTO.EvaluationDTO.CompetencyCommentsDTO comments = 
                new CaseSubmissionDTO.EvaluationDTO.CompetencyCommentsDTO();
            
            // Extraer comentarios
            comments.setAccess(extractJsonField(jsonString, "access"));
            comments.setProcess(extractJsonField(jsonString, "process"));
            comments.setCommunicate(extractJsonField(jsonString, "communicate"));
            
            return comments;
        } catch (Exception e) {
            log.warn("Error parsing competency comments", e);
            return new CaseSubmissionDTO.EvaluationDTO.CompetencyCommentsDTO();
        }
    }
}

