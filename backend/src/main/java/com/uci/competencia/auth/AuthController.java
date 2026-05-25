package com.uci.competencia.auth;

import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.request.RegisterRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;
import com.uci.competencia.model.dto.response.UserDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.AuthService;
import com.uci.competencia.service.external.EmailService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/auth")
@Slf4j
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private UserIdentityResolver userIdentityResolver;

    @Autowired
    private EmailService emailService;

    @Value("${app.frontend.base-url:http://localhost:3000}")
    private String frontendBaseUrl;

    @Value("${app.auth.password-reset.expose-dev-link:false}")
    private boolean exposePasswordResetDevLink;

    @PostMapping("/login")
    public ResponseEntity<LoginResponseDTO> login(@Valid @RequestBody LoginRequestDTO loginRequest) {
        log.info("Login attempt for user: {}", loginRequest.getEmail());
        LoginResponseDTO response = authService.login(loginRequest);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/register")
    public ResponseEntity<UserDTO> register(@Valid @RequestBody RegisterRequestDTO request) {
        log.info("Registering user: {}", request.getEmail());

        if (userRepository.existsByEmail(request.getEmail())) {
            return ResponseEntity.badRequest().build();
        }

        if (!isPasswordStrong(request.getPassword())) {
            return ResponseEntity.badRequest().build();
        }

        User user = new User();
        String name = request.getName() != null ? request.getName().trim() : "";
        String[] parts = name.split("\\s+", 2);
        user.setFirstName(parts.length > 0 ? parts[0] : name);
        user.setLastName(parts.length > 1 ? parts[1] : "");
        user.setEmail(request.getEmail());
        user.setUsername(request.getUsername() != null && !request.getUsername().isBlank()
            ? request.getUsername()
            : request.getEmail().split("@")[0]);
        if (userRepository.existsByUsername(user.getUsername())) {
            return ResponseEntity.badRequest().build();
        }
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));
        user.setFaculty(request.getFaculty());
        user.setDepartment(request.getDepartment());
        user.setActive(true);

        Role role = Role.ROLE_STUDENT;
        if (request.getRole() != null && !"student".equalsIgnoreCase(request.getRole())) {
            log.warn("Ignoring non-student role registration attempt: {}", request.getRole());
        }
        user.setRole(role);

        User saved = userRepository.save(user);
        return ResponseEntity.status(201).body(toUserDTO(saved));
    }

    @PostMapping("/refresh")
    public ResponseEntity<LoginResponseDTO> refreshToken(
            @RequestHeader("Authorization") String refreshToken) {
        String token = refreshToken.replace("Bearer ", "");
        LoginResponseDTO response = authService.refreshToken(token);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestHeader("Authorization") String token) {
        String jwtToken = token.replace("Bearer ", "");
        authService.logout(jwtToken);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/forgot-password")
    public ResponseEntity<Map<String, String>> forgotPassword(@RequestBody Map<String, String> request) {
        String email = request != null ? request.get("email") : null;
        log.info("Password reset requested for email: {}", email);

        String resetToken = authService.requestPasswordReset(email);
        Map<String, String> response = new HashMap<>();
        response.put("message", "If the email exists, password reset instructions will be sent.");

        if (resetToken != null) {
            String resetUrl = buildResetUrl(resetToken);
            emailService.sendPasswordResetEmail(email.trim().toLowerCase(), resetUrl);
            if (exposePasswordResetDevLink) {
                response.put("resetUrl", resetUrl);
            }
        }

        return ResponseEntity.ok(response);
    }

    @PostMapping("/reset-password")
    public ResponseEntity<Map<String, String>> resetPassword(@RequestBody Map<String, String> request) {
        String token = request != null ? request.get("token") : null;
        String password = request != null ? request.get("password") : null;
        authService.resetPassword(token, password);
        return ResponseEntity.ok(Map.of("message", "Password updated successfully."));
    }

    @GetMapping("/me")
    public ResponseEntity<UserDTO> getCurrentUser() {
        User user = resolveCurrentUser();
        if (user == null) {
            return ResponseEntity.status(401).build();
        }
        return ResponseEntity.ok(toUserDTO(user));
    }

    private User resolveCurrentUser() {
        return userIdentityResolver.resolveCurrentUser().orElse(null);
    }

    private UserDTO toUserDTO(User user) {
        UserDTO dto = new UserDTO();
        dto.setId(user.getId());
        dto.setEmail(user.getEmail());
        dto.setFirstName(user.getFirstName());
        dto.setLastName(user.getLastName());
        dto.setName((user.getFirstName() != null ? user.getFirstName() : "") +
            " " + (user.getLastName() != null ? user.getLastName() : ""));
        dto.setRole(user.getRole().name().toLowerCase().replace("role_", ""));
        dto.setAvatar(user.getAvatar());
        dto.setFaculty(user.getFaculty());
        dto.setActive(user.isActive());
        dto.setCreatedAt(user.getCreatedAt() != null ? user.getCreatedAt().toString() : null);
        dto.setLastLogin(user.getLastLogin() != null ? user.getLastLogin().toString() : null);
        return dto;
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

    private String buildResetUrl(String token) {
        String baseUrl = frontendBaseUrl != null && !frontendBaseUrl.isBlank()
            ? frontendBaseUrl.replaceAll("/+$", "")
            : "http://localhost:3000";
        return baseUrl + "/reset-password/" + token;
    }
}
