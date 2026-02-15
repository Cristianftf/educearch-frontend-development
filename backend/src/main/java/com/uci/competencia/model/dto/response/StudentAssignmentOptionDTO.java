package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class StudentAssignmentOptionDTO {
    private String id;
    private String email;
    private String username;
    private String fullName;
    private boolean active;
}
