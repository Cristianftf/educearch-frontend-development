package com.uci.competencia.controller.api;

import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.dto.response.CaseSubmissionDTO;
import com.uci.competencia.model.dto.response.StudentAssignmentOptionDTO;
import com.uci.competencia.model.enums.CaseStatus;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.CaseService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Optional;

@RestController
@RequestMapping("/api/cases")
@Slf4j
public class CaseController {

    @Autowired
    private CaseService caseService;

    @Autowired
    private UserIdentityResolver userIdentityResolver;

    @GetMapping
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<List<CaseStudyDTO>> getAllCases(@RequestParam(required = false) String status) {
        CaseStatus caseStatus = null;
        String professorId = getCurrentUserId();
        if (status != null && !status.isBlank()) {
            try {
                caseStatus = CaseStatus.valueOf(status.toUpperCase());
            } catch (IllegalArgumentException e) {
                log.warn("Invalid case status filter: {}", status);
                throw new IllegalArgumentException("Invalid case status filter: " + status);
            }
        }
        List<CaseStudyDTO> cases = caseService.getProfessorCases(professorId, caseStatus);
        return ResponseEntity.ok(cases);
    }

    @GetMapping("/students")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<List<StudentAssignmentOptionDTO>> getAssignableStudents() {
        return ResponseEntity.ok(caseService.getAssignableStudents());
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<CaseStudyDTO> getCaseById(@PathVariable String id) {
        Optional<CaseStudyDTO> caseStudy = caseService.getCaseById(id);
        if (caseStudy.isEmpty()) {
            throw new ResourceNotFoundException("Case not found: " + id);
        }

        String currentUserId = getCurrentUserId();
        if (hasRole("ROLE_PROFESSOR") && !caseService.isCaseOwnedByProfessor(id, currentUserId)) {
            throw new AccessDeniedException("You do not have access to this case");
        }
        if (hasRole("ROLE_STUDENT") && !caseService.isStudentAssignedToCase(id, currentUserId)) {
            throw new AccessDeniedException("You do not have access to this case");
        }
        return ResponseEntity.ok(caseStudy.get());
    }

    @PostMapping
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseStudyDTO> createCase(@Valid @RequestBody CaseStudyDTO caseStudy) {
        String professorId = getCurrentUserId();
        return ResponseEntity.ok(caseService.createCase(caseStudy, professorId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseStudyDTO> updateCase(@PathVariable String id, @RequestBody CaseStudyDTO caseStudy) {
        if (!isCaseOwnedByCurrentProfessor(id)) {
            throw new AccessDeniedException("You do not have access to update this case");
        }
        return ResponseEntity.ok(caseService.updateCase(id, caseStudy));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Void> deleteCase(@PathVariable String id) {
        if (!isCaseOwnedByCurrentProfessor(id)) {
            throw new AccessDeniedException("You do not have access to delete this case");
        }
        caseService.deleteCase(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseStudyDTO> assignStudents(
        @PathVariable String id,
        @Valid @RequestBody AssignStudentsRequest request
    ) {
        if (!isCaseOwnedByCurrentProfessor(id)) {
            throw new AccessDeniedException("You do not have access to assign students to this case");
        }
        return ResponseEntity.ok(caseService.assignStudents(id, request.getStudentIds()));
    }

    @GetMapping("/{caseId}/submissions")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<List<CaseSubmissionDTO>> getCaseSubmissions(@PathVariable String caseId) {
        if (!isCaseOwnedByCurrentProfessor(caseId)) {
            throw new AccessDeniedException("You do not have access to submissions for this case");
        }
        return ResponseEntity.ok(caseService.getCaseSubmissions(caseId));
    }

    @GetMapping("/assigned")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<CaseStudyDTO>> getAssignedCases() {
        String studentId = getCurrentUserId();
        return ResponseEntity.ok(caseService.getAssignedCases(studentId));
    }

    @PostMapping("/{caseId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<CaseSubmissionDTO> submitCase(
        @PathVariable String caseId,
        @Valid @RequestBody CaseSubmissionDTO submission
    ) {
        String studentId = getCurrentUserId();
        return ResponseEntity.ok(caseService.submitCase(caseId, studentId, submission));
    }

    @GetMapping("/{caseId}/submission")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<CaseSubmissionDTO> getSubmission(@PathVariable String caseId) {
        String studentId = getCurrentUserId();
        return caseService.getSubmission(caseId, studentId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.noContent().build());
    }

    @PostMapping("/submissions/{submissionId}/evaluate")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseSubmissionDTO> evaluateSubmission(
        @PathVariable String submissionId,
        @Valid @RequestBody CaseSubmissionDTO.EvaluationDTO evaluation
    ) {
        String professorId = getCurrentUserId();
        return ResponseEntity.ok(caseService.evaluateSubmission(submissionId, evaluation, professorId));
    }

    private String getCurrentUserId() {
        return userIdentityResolver.getCurrentPrincipalIdentifier().orElse(null);
    }

    private boolean hasRole(String role) {
        var authentication = org.springframework.security.core.context.SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || authentication.getAuthorities() == null) {
            return false;
        }
        return authentication.getAuthorities().stream()
            .anyMatch(authority -> role.equals(authority.getAuthority()));
    }

    private boolean isCaseOwnedByCurrentProfessor(String caseId) {
        String professorId = getCurrentUserId();
        return caseService.isCaseOwnedByProfessor(caseId, professorId);
    }

    public static class AssignStudentsRequest {
        private List<String> studentIds;

        public List<String> getStudentIds() {
            return studentIds;
        }

        public void setStudentIds(List<String> studentIds) {
            this.studentIds = studentIds;
        }
    }
}
