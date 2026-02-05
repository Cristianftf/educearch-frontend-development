package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class UserDTO {
    private String id;
    private String email;
    private String name;  // Combinación de firstName + lastName
    private String firstName;
    private String lastName;
    private String role;
    private String avatar;  // Nuevo campo
    private String faculty;
    private boolean isActive;  // Renombrado de active
    private String createdAt;  // Nuevo campo
    private String lastLogin;  // Nuevo campo
}
