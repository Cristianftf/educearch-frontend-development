package com.uci.competencia.model.dto.response;

import com.fasterxml.jackson.annotation.JsonFormat;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class SearchHedgeDTO {
    
    private String id;
    
    @NotBlank(message = "Name is required")
    @Size(min = 3, max = 255, message = "Name must be 3-255 characters")
    private String name;
    
    @NotBlank(message = "Category is required")
    private String category;
    
    @NotBlank(message = "Query is required")
    @Size(min = 5, max = 2000, message = "Query must be 5-2000 characters")
    private String query;
    
    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;
    
    @Min(value = 0, message = "Estimated results must be >= 0")
    private Integer estimatedResults;
    
    @Min(value = 0, message = "Precision must be >= 0")
    @Max(value = 1, message = "Precision must be <= 1")
    private Double precision;
    
    @Min(value = 0, message = "Recall must be >= 0")
    @Max(value = 1, message = "Recall must be <= 1")
    private Double recall;
    
    private String createdBy;
    
    @JsonFormat(shape = JsonFormat.Shape.STRING,
                pattern = "yyyy-MM-dd'T'HH:mm:ss'Z'",
                timezone = "UTC")
    private LocalDateTime createdAt;
    
    private Boolean isTemplate;
}
