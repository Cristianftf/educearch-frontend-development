package com.uci.competencia.controller.api;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/export")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class ExportController {

    @PostMapping("/bibliography")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<String> exportBibliography(@RequestBody String request) {
        log.info("Exporting bibliography");
        return ResponseEntity.ok("Bibliography export initiated");
    }

    @PostMapping("/report/progress")
    @PreAuthorize("hasRole('PROFESSOR')")
    public ResponseEntity<String> exportProgressReport(@RequestBody String request) {
        log.info("Exporting progress report");
        return ResponseEntity.ok("Progress report export initiated");
    }

    @GetMapping("/download/{id}")
    public ResponseEntity<String> downloadExport(@PathVariable String id) {
        log.info("Downloading export: {}", id);
        return ResponseEntity.ok("Export file");
    }
}
