package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.service.StudentService;
import com.uci.competencia.service.ProgressTrackingService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/student")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@PreAuthorize("hasRole('STUDENT')")
@Slf4j
public class StudentController {

    @Autowired
    private StudentService studentService;

    @Autowired
    private ProgressTrackingService progressTrackingService;

    @GetMapping("/dashboard/overview")
    public ResponseEntity<StudentProgressDTO> getDashboardOverview() {
        log.info("Getting student dashboard overview");
        String studentId = getCurrentUserId();
        StudentProgressDTO progress = studentService.getStudentProgress(studentId);
        return ResponseEntity.ok(progress);
    }

    @GetMapping("/progress/detailed")
    public ResponseEntity<Map<String, Object>> getDetailedProgress() {
        log.info("Getting detailed progress");
        String studentId = getCurrentUserId();
        Map<String, Object> detailedProgress = progressTrackingService.getDetailedProgress(studentId);
        return ResponseEntity.ok(detailedProgress);
    }

    @GetMapping("/search/history")
    public ResponseEntity<java.util.List<com.uci.competencia.model.dto.response.SearchSessionDTO>> getSearchHistory() {
        log.info("Getting search history");
        String studentId = getCurrentUserId();
        java.util.List<com.uci.competencia.model.dto.response.SearchSessionDTO> history = studentService.getSearchHistory(studentId);
        return ResponseEntity.ok(history);
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
}
