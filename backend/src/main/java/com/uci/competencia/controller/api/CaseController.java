package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.dto.response.CaseSubmissionDTO;
import com.uci.competencia.model.enums.CaseStatus;
import com.uci.competencia.service.CaseService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/cases")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class CaseController {

    @Autowired
    private CaseService caseService;

    /**
     * Obtener todos los casos (Profesores)
     * GET /api/cases?status={status}
     */
    @GetMapping
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<List<CaseStudyDTO>> getAllCases(
            @RequestParam(required = false) String status) {
        CaseStatus caseStatus = status != null ? CaseStatus.valueOf(status.toUpperCase()) : null;
        List<CaseStudyDTO> cases = caseService.getAllCases(caseStatus);
        return ResponseEntity.ok(cases);
    }

    /**
     * Obtener caso por ID
     * GET /api/cases/{id}
     */
    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'STUDENT')")
    public ResponseEntity<CaseStudyDTO> getCaseById(@PathVariable String id) {
        return caseService.getCaseById(id)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Crear nuevo caso (Profesores)
     * POST /api/cases
     */
    @PostMapping
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseStudyDTO> createCase(@RequestBody CaseStudyDTO caseStudy) {
        String professorId = getCurrentUserId();
        CaseStudyDTO created = caseService.createCase(caseStudy, professorId);
        return ResponseEntity.ok(created);
    }

    /**
     * Actualizar caso (Profesores)
     * PUT /api/cases/{id}
     */
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseStudyDTO> updateCase(@PathVariable String id, @RequestBody CaseStudyDTO caseStudy) {
        CaseStudyDTO updated = caseService.updateCase(id, caseStudy);
        return ResponseEntity.ok(updated);
    }

    /**
     * Eliminar caso (Profesores)
     * DELETE /api/cases/{id}
     */
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<Void> deleteCase(@PathVariable String id) {
        caseService.deleteCase(id);
        return ResponseEntity.noContent().build();
    }

    /**
     * Asignar estudiantes a un caso (Profesores)
     * POST /api/cases/{id}/assign
     */
    @PostMapping("/{id}/assign")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseStudyDTO> assignStudents(
            @PathVariable String id,
            @RequestBody AssignStudentsRequest request) {
        CaseStudyDTO updated = caseService.assignStudents(id, request.getStudentIds());
        return ResponseEntity.ok(updated);
    }

    /**
     * Obtener entregas de un caso (Profesores)
     * GET /api/cases/{caseId}/submissions
     */
    @GetMapping("/{caseId}/submissions")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<List<CaseSubmissionDTO>> getCaseSubmissions(@PathVariable String caseId) {
        List<CaseSubmissionDTO> submissions = caseService.getCaseSubmissions(caseId);
        return ResponseEntity.ok(submissions);
    }

    /**
     * Obtener casos asignados al estudiante actual
     * GET /api/cases/assigned
     */
    @GetMapping("/assigned")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<List<CaseStudyDTO>> getAssignedCases() {
        String studentId = getCurrentUserId();
        List<CaseStudyDTO> cases = caseService.getAssignedCases(studentId);
        return ResponseEntity.ok(cases);
    }

    /**
     * Enviar entrega de caso (Estudiantes)
     * POST /api/cases/{caseId}/submit
     */
    @PostMapping("/{caseId}/submit")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<CaseSubmissionDTO> submitCase(
            @PathVariable String caseId,
            @RequestBody CaseSubmissionDTO submission) {
        String studentId = getCurrentUserId();
        CaseSubmissionDTO result = caseService.submitCase(caseId, studentId, submission);
        return ResponseEntity.ok(result);
    }

    /**
     * Obtener entrega de un estudiante para un caso
     * GET /api/cases/{caseId}/submission
     */
    @GetMapping("/{caseId}/submission")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<CaseSubmissionDTO> getSubmission(@PathVariable String caseId) {
        String studentId = getCurrentUserId();
        return caseService.getSubmission(caseId, studentId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Evaluar entrega (Profesores)
     * POST /api/cases/submissions/{submissionId}/evaluate
     */
    @PostMapping("/submissions/{submissionId}/evaluate")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<CaseSubmissionDTO> evaluateSubmission(
            @PathVariable String submissionId,
            @RequestBody CaseSubmissionDTO.EvaluationDTO evaluation) {
        String professorId = getCurrentUserId();
        CaseSubmissionDTO result = caseService.evaluateSubmission(submissionId, evaluation, professorId);
        return ResponseEntity.ok(result);
    }

    /**
     * Obtener ID del usuario autenticado
     */
    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
    }

    // DTOs auxiliares
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