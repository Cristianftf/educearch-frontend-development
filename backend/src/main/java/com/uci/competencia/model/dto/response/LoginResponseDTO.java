package com.uci.competencia.model.dto.response;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginResponseDTO {
    private String token;
    private String refreshToken;
    private String userId;
    private String username;
    private String email;
    private String firstName;
    private String lastName;
    private String role;
}
