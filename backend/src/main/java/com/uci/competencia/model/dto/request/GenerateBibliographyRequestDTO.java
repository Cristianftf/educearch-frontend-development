package com.uci.competencia.model.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class GenerateBibliographyRequestDTO {
    @NotEmpty(message = "Article IDs are required")
    private List<String> articleIds;

    @NotBlank(message = "Format is required")
    private String format; // apa | vancouver | bibtex | xml

    @NotBlank(message = "Name is required")
    private String name;
}
