package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.ProfessorAnalyticsDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.service.ProfessorAnalyticsService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/professor")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@PreAuthorize("hasRole('PROFESSOR')")
@Slf4j
public class ProfessorController {

    @Autowired
    private ProfessorAnalyticsService analyticsService;

    @GetMapping("/analytics/overview")
    public ResponseEntity<ProfessorAnalyticsDTO> getAnalyticsOverview() {
        log.info("Getting professor analytics overview");
        String professorId = getCurrentUserId();
        ProfessorAnalyticsDTO analytics = analyticsService.getAnalyticsOverview(professorId);
        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/analytics/student/{studentId}")
    public ResponseEntity<StudentProgressDTO> getStudentAnalytics(@PathVariable String studentId) {
        log.info("Getting analytics for student: {}", studentId);
        StudentProgressDTO progress = analyticsService.getStudentAnalytics(studentId);
        return ResponseEntity.ok(progress);
    }

    @GetMapping("/dashboard/overview")
    public ResponseEntity<ProfessorAnalyticsDTO> getDashboardOverview() {
        log.info("Getting professor dashboard overview");
        String professorId = getCurrentUserId();
        ProfessorAnalyticsDTO analytics = analyticsService.getAnalyticsOverview(professorId);
        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/students")
    public ResponseEntity<java.util.List<StudentProgressDTO>> getStudents() {
        log.info("Getting students list");
        String professorId = getCurrentUserId();
        java.util.List<StudentProgressDTO> students = analyticsService.getProfessorStudents(professorId);
        return ResponseEntity.ok(students);
    }

    @GetMapping("/cases")
    public ResponseEntity<java.util.List<com.uci.competencia.model.dto.response.CaseStudyDTO>> getCases() {
        log.info("Getting cases");
        String professorId = getCurrentUserId();
        java.util.List<com.uci.competencia.model.dto.response.CaseStudyDTO> cases = analyticsService.getProfessorCases(professorId);
        return ResponseEntity.ok(cases);
    }

    @PostMapping("/cases")
    public ResponseEntity<com.uci.competencia.model.dto.response.CaseStudyDTO> createCase(
            @RequestBody com.uci.competencia.model.dto.response.CaseStudyDTO caseData) {
        log.info("Creating new case");
        String professorId = getCurrentUserId();
        com.uci.competencia.model.dto.response.CaseStudyDTO created = analyticsService.createCaseStudy(caseData, professorId);
        return ResponseEntity.status(201).body(created);
    }

    @GetMapping("/analytics/class-performance")
    public ResponseEntity<java.util.Map<String, Object>> getClassPerformance() {
        log.info("Getting class performance analytics");
        String professorId = getCurrentUserId();
        java.util.Map<String, Object> performance = analyticsService.getClassPerformanceMetrics(professorId);
        return ResponseEntity.ok(performance);
    }

    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
    }
}
