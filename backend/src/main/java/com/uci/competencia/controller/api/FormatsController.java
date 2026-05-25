package com.uci.competencia.controller.api;

import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/formats")
public class FormatsController {

    @GetMapping("/available")
    @PreAuthorize("hasAnyRole('STUDENT', 'PROFESSOR')")
    public ResponseEntity<Map<String, List<String>>> getAvailableFormats() {
        return ResponseEntity.ok(Map.of(
            "formats",
            List.of("apa", "vancouver", "bibtex", "xml")
        ));
    }
}
