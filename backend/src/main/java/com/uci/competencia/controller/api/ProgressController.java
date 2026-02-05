package com.uci.competencia.controller.api;

import com.uci.competencia.model.dto.response.StudentProgressDTO;
import com.uci.competencia.service.ProgressService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/progress")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class ProgressController {

    @Autowired
    private ProgressService progressService;

    /**
     * Obtiene el progreso del estudiante autenticado
     * GET /api/progress/me
     */
    @GetMapping("/me")
    @PreAuthorize("hasRole('STUDENT')")
    public ResponseEntity<StudentProgressDTO> getMyProgress() {
        String userId = getCurrentUserId();
        log.info("Getting progress for student: {}", userId);
        StudentProgressDTO progress = progressService.getStudentProgress(userId);
        return ResponseEntity.ok(progress);
    }

    /**
     * Obtiene el progreso de un estudiante específico
     * GET /api/progress/{studentId}
     * Solo accesible para profesores y administradores
     */
    @GetMapping("/{studentId}")
    @PreAuthorize("hasAnyRole('PROFESSOR', 'ADMIN')")
    public ResponseEntity<StudentProgressDTO> getStudentProgress(@PathVariable String studentId) {
        log.info("Getting progress for student: {}", studentId);
        StudentProgressDTO progress = progressService.getStudentProgress(studentId);
        return ResponseEntity.ok(progress);
    }

    /**
     * Obtiene el ID del usuario autenticado del contexto de seguridad
     */
    private String getCurrentUserId() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal.toString();
    }
}
