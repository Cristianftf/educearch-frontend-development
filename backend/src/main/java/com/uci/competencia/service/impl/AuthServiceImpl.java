package com.uci.competencia.service.impl;

import com.uci.competencia.exception.InvalidCredentialsException;
import com.uci.competencia.exception.ResourceNotFoundException;
import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.security.JwtTokenProvider;
import com.uci.competencia.service.AuthService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@Slf4j
public class AuthServiceImpl implements AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public LoginResponseDTO login(LoginRequestDTO loginRequest) {
        log.info("Processing login for email: {}", loginRequest.getEmail());
        User user = userRepository.findByEmail(loginRequest.getEmail())
            .orElseThrow(() -> {
                log.warn("Login attempt with non-existent email: {}", loginRequest.getEmail());
                return new InvalidCredentialsException("Invalid email or password");
            });

        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPasswordHash())) {
            log.warn("Invalid password attempt for user: {}", loginRequest.getEmail());
            throw new InvalidCredentialsException("Invalid email or password");
        }

        log.info("Successful login for user: {}", loginRequest.getEmail());
        String token = tokenProvider.generateTokenFromUsername(
            user.getEmail(),
            user.getRole().toString()
        );

        LoginResponseDTO response = new LoginResponseDTO();
        response.setToken(token);
        response.setRefreshToken(token);
        response.setUserId(user.getId());
        response.setUsername(user.getUsername());
        response.setEmail(user.getEmail());
        response.setFirstName(user.getFirstName());
        response.setLastName(user.getLastName());
        response.setRole(user.getRole().getDisplayName());

        return response;
    }

    @Override
    public LoginResponseDTO refreshToken(String refreshToken) {
        if (tokenProvider.validateToken(refreshToken)) {
            String email = tokenProvider.getUsernameFromToken(refreshToken);
            User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            String token = tokenProvider.generateTokenFromUsername(
                user.getEmail(),
                user.getRole().toString()
            );

            LoginResponseDTO response = new LoginResponseDTO();
            response.setToken(token);
            response.setRefreshToken(token);
            response.setUserId(user.getId());
            response.setUsername(user.getUsername());
            response.setEmail(user.getEmail());
            response.setRole(user.getRole().getDisplayName());

            return response;
        }
        throw new RuntimeException("Invalid refresh token");
    }

    @Override
    public void logout(String token) {
        // Implementar invalidación de token en Redis
        log.info("User logged out");
    }
}
