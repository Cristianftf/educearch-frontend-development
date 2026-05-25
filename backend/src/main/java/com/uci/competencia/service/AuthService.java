package com.uci.competencia.service;

import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;

public interface AuthService {
    LoginResponseDTO login(LoginRequestDTO loginRequest);
    LoginResponseDTO refreshToken(String refreshToken);
    void logout(String token);
    String requestPasswordReset(String email);
    void resetPassword(String token, String newPassword);
}
