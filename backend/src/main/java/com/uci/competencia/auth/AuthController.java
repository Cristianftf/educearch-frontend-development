package com.uci.competencia.auth;

import com.uci.competencia.model.dto.request.LoginRequestDTO;
import com.uci.competencia.model.dto.request.RegisterRequestDTO;
import com.uci.competencia.model.dto.response.LoginResponseDTO;
import com.uci.competencia.model.dto.response.UserDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import com.uci.competencia.service.AuthService;
import jakarta.validation.Valid;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@CrossOrigin(origins = {"http://localhost:3000", "http://localhost:3001", "https://frontend.uci.cu"})
@Slf4j
public class AuthController {

    @Autowired
    private AuthService authService;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

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

    @GetMapping("/me")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<UserDTO> getCurrentUser() {
        String email = getCurrentUserEmail();
        if (email == null) {
            return ResponseEntity.status(401).build();
        }

        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) {
            return ResponseEntity.notFound().build();
        }

        return ResponseEntity.ok(toUserDTO(user));
    }

    private String getCurrentUserEmail() {
        Object principal = SecurityContextHolder.getContext().getAuthentication().getPrincipal();
        if (principal instanceof UserDetails) {
            return ((UserDetails) principal).getUsername();
        }
        return principal != null ? principal.toString() : null;
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
}