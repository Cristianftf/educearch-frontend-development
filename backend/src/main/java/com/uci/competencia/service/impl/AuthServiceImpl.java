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

import java.time.LocalDateTime;

@Service
@Slf4j
public class AuthServiceImpl implements AuthService {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtTokenProvider tokenProvider;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @org.springframework.beans.factory.annotation.Value("${app.auth.password-reset.expiration-ms:900000}")
    private long passwordResetExpirationMs;

    @Override
    public LoginResponseDTO login(LoginRequestDTO loginRequest) {
        log.info("Processing login for email: {}", loginRequest.getEmail());
        String normalizedIdentifier = loginRequest.getEmail() != null ? loginRequest.getEmail().trim() : "";
        User user = resolveLoginUser(normalizedIdentifier)
            .orElseThrow(() -> {
                log.warn("Login attempt with non-existent identifier: {}", normalizedIdentifier);
                return new InvalidCredentialsException("Invalid email or password");
            });

        if (!user.isActive()) {
            log.warn("Inactive user login attempt: {}", normalizedIdentifier);
            throw new InvalidCredentialsException("Invalid email or password");
        }

        if (!passwordEncoder.matches(loginRequest.getPassword(), user.getPasswordHash())) {
            log.warn("Invalid password attempt for user: {}", normalizedIdentifier);
            throw new InvalidCredentialsException("Invalid email or password");
        }

        user.setLastLogin(LocalDateTime.now());
        userRepository.save(user);

        log.info("Successful login for user: {}", user.getEmail());
        String token = tokenProvider.generateTokenFromUsername(
            user.getEmail(),
            buildAuthorityClaim(user)
        );

        String refreshToken = tokenProvider.generateRefreshTokenFromUsername(
            user.getEmail(),
            buildAuthorityClaim(user)
        );

        LoginResponseDTO response = new LoginResponseDTO();
        response.setToken(token);
        response.setRefreshToken(refreshToken);
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
        if (tokenProvider.validateToken(refreshToken) && tokenProvider.getPurposeFromToken(refreshToken) == null) {
            String email = tokenProvider.getUsernameFromToken(refreshToken);
            User user = userRepository.findByEmail(email)
                .orElseThrow(() -> new ResourceNotFoundException("User not found"));

            String token = tokenProvider.generateTokenFromUsername(
                user.getEmail(),
                buildAuthorityClaim(user)
            );

            String newRefreshToken = tokenProvider.generateRefreshTokenFromUsername(
                user.getEmail(),
                buildAuthorityClaim(user)
            );

            LoginResponseDTO response = new LoginResponseDTO();
            response.setToken(token);
            response.setRefreshToken(newRefreshToken);
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
        // Implement token invalidation in Redis
        log.info("User logged out");
    }

    @Override
    public String requestPasswordReset(String email) {
        String normalizedEmail = email != null ? email.trim().toLowerCase() : "";
        if (normalizedEmail.isBlank()) {
            return null;
        }

        return userRepository.findByEmail(normalizedEmail)
            .filter(User::isActive)
            .map(user -> tokenProvider.generatePasswordResetToken(user.getEmail(), passwordResetExpirationMs))
            .orElse(null);
    }

    @Override
    public void resetPassword(String token, String newPassword) {
        if (token == null || token.isBlank() || !tokenProvider.validateToken(token)) {
            throw new InvalidCredentialsException("Invalid reset token");
        }
        if (!"password_reset".equals(tokenProvider.getPurposeFromToken(token))) {
            throw new InvalidCredentialsException("Invalid reset token");
        }
        if (!isPasswordStrong(newPassword)) {
            throw new IllegalArgumentException("Password does not meet security requirements");
        }

        String email = tokenProvider.getUsernameFromToken(token);
        User user = userRepository.findByEmail(email)
            .orElseThrow(() -> new InvalidCredentialsException("Invalid reset token"));
        if (!user.isActive()) {
            throw new InvalidCredentialsException("Invalid reset token");
        }

        user.setPasswordHash(passwordEncoder.encode(newPassword));
        userRepository.save(user);
        log.info("Password reset completed for user: {}", user.getEmail());
    }

    private java.util.Optional<User> resolveLoginUser(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return java.util.Optional.empty();
        }

        String normalized = identifier.trim();
        java.util.Optional<User> byEmail = userRepository.findByEmail(normalized);
        if (byEmail.isPresent()) {
            return byEmail;
        }

        return userRepository.findByUsername(normalized);
    }

    private String buildAuthorityClaim(User user) {
        if (user == null || user.getRole() == null) {
            return "ROLE_STUDENT";
        }
        return user.getRole().name();
    }

    private boolean isPasswordStrong(String password) {
        if (password == null || password.length() < 8) {
            return false;
        }
        boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
        boolean hasNumber = password.chars().anyMatch(Character::isDigit);
        boolean hasSymbol = password.chars().anyMatch(ch -> !Character.isLetterOrDigit(ch));
        return hasUpper && hasNumber && hasSymbol;
    }
}
