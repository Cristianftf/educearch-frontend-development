package com.uci.competencia.config;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Profile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@Profile("dev")
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        createTestUsers();
    }

    private void createTestUsers() {
        createUserIfMissing(
            "admin.test@uci.cu",
            "admin",
            "Admin123!",
            "Admin",
            "System",
            Role.ROLE_ADMIN,
            "Informatica",
            "Sistemas"
        );

        createUserIfMissing(
            "professor.test@uci.cu",
            "professor",
            "Professor123!",
            "Maria",
            "Gonzalez",
            Role.ROLE_PROFESSOR,
            "Informatica",
            "Ciencias de la Computacion"
        );

        createUserIfMissing(
            "student.test@uci.cu",
            "student",
            "Student123!",
            "Juan",
            "Perez",
            Role.ROLE_STUDENT,
            "Informatica",
            "Ingenieria Informatica"
        );

        log.info("Test users initialization completed");
    }

    private void createUserIfMissing(
        String email,
        String username,
        String rawPassword,
        String firstName,
        String lastName,
        Role role,
        String faculty,
        String department
    ) {
        if (userRepository.findByEmail(email).isPresent()) {
            return;
        }

        User user = new User();
        user.setUsername(username);
        user.setEmail(email);
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setFirstName(firstName);
        user.setLastName(lastName);
        user.setRole(role);
        user.setFaculty(faculty);
        user.setDepartment(department);
        user.setActive(true);
        userRepository.save(user);
        log.info("Created test user: {} / {}", email, rawPassword);
    }
}