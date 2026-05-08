package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.CaseStudyDTO;
import com.uci.competencia.model.dto.response.ProfessorAnalyticsDTO;
import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.service.ProfessorAnalyticsService;
import com.uci.competencia.util.SecurityUtils;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/professor")
@PreAuthorize("hasRole('PROFESSOR')")
@RequiredArgsConstructor
@Slf4j
public class ProfessorController {

    private final ProfessorAnalyticsService analyticsService;

    @GetMapping("/analytics/overview")
    public ResponseEntity<ProfessorAnalyticsDTO> getAnalyticsOverview() {
        log.info("Getting professor analytics overview");
        String professorId = SecurityUtils.getCurrentUserId();
        ProfessorAnalyticsDTO analytics = analyticsService.getAnalyticsOverview(professorId);
        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/analytics/student/{studentId}")
    public ResponseEntity<StudentProgressDTO> getStudentAnalytics(@PathVariable String studentId) {
        log.info("Getting analytics for student: {}", studentId);
        String professorId = SecurityUtils.getCurrentUserId();
        StudentProgressDTO progress = analyticsService.getStudentAnalytics(professorId, studentId);
        return ResponseEntity.ok(progress);
    }

    @GetMapping("/dashboard/overview")
    public ResponseEntity<ProfessorAnalyticsDTO> getDashboardOverview() {
        log.info("Getting professor dashboard overview");
        String professorId = SecurityUtils.getCurrentUserId();
        ProfessorAnalyticsDTO analytics = analyticsService.getAnalyticsOverview(professorId);
        return ResponseEntity.ok(analytics);
    }

    @GetMapping("/students")
    public ResponseEntity<java.util.List<StudentProgressDTO>> getStudents() {
        log.info("Getting students list");
        String professorId = SecurityUtils.getCurrentUserId();
        List<StudentProgressDTO> students = analyticsService.getProfessorStudents(professorId);
        return ResponseEntity.ok(students);
    }

    @GetMapping("/cases")
    public ResponseEntity<List<CaseStudyDTO>> getCases() {
        log.info("Getting cases");
        String professorId = SecurityUtils.getCurrentUserId();
        List<CaseStudyDTO> cases = analyticsService.getProfessorCases(professorId);
        return ResponseEntity.ok(cases);
    }

    @PostMapping("/cases")
    public ResponseEntity<CaseStudyDTO> createCase(@RequestBody CaseStudyDTO caseData) {
        log.info("Creating new case");
        String professorId = SecurityUtils.getCurrentUserId();
        CaseStudyDTO created = analyticsService.createCaseStudy(caseData, professorId);
        return ResponseEntity.status(201).body(created);
    }

    @GetMapping("/analytics/class-performance")
    public ResponseEntity<Map<String, Object>> getClassPerformance() {
        log.info("Getting class performance analytics");
        String professorId = SecurityUtils.getCurrentUserId();
        Map<String, Object> performance = analyticsService.getClassPerformanceMetrics(professorId);
        return ResponseEntity.ok(performance);
    }
}
