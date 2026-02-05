package com.uci.competencia.config;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
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
        // Create Admin User
        if (userRepository.findByEmail("admin@uci.cu").isEmpty()) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setEmail("admin@uci.cu");
            admin.setPasswordHash(passwordEncoder.encode("admin123"));
            admin.setFirstName("Administrador");
            admin.setLastName("Sistema");
            admin.setRole(Role.ROLE_ADMIN);
            admin.setFaculty("Informática");
            admin.setDepartment("Sistemas");
            admin.setActive(true);
            userRepository.save(admin);
            log.info("Created admin user: admin@uci.cu/admin123");
        }

        // Create Professor User
        if (userRepository.findByEmail("professor@uci.cu").isEmpty()) {
            User professor = new User();
            professor.setUsername("professor");
            professor.setEmail("professor@uci.cu");
            professor.setPasswordHash(passwordEncoder.encode("prof123"));
            professor.setFirstName("María");
            professor.setLastName("González");
            professor.setRole(Role.ROLE_PROFESSOR);
            professor.setFaculty("Informática");
            professor.setDepartment("Ciencias de la Computación");
            professor.setActive(true);
            userRepository.save(professor);
            log.info("Created professor user: professor@uci.cu/prof123");
        }

        // Create Student User 1
        if (userRepository.findByEmail("student@uci.cu").isEmpty()) {
            User student = new User();
            student.setUsername("student");
            student.setEmail("student@uci.cu");
            student.setPasswordHash(passwordEncoder.encode("stud123"));
            student.setFirstName("Juan");
            student.setLastName("Pérez");
            student.setRole(Role.ROLE_STUDENT);
            student.setFaculty("Informática");
            student.setDepartment("Ingeniería Informática");
            student.setActive(true);
            userRepository.save(student);
            log.info("Created student user: student@uci.cu/stud123");
        }

        // Create Student User 2
        if (userRepository.findByEmail("student2@uci.cu").isEmpty()) {
            User student2 = new User();
            student2.setUsername("student2");
            student2.setEmail("student2@uci.cu");
            student2.setPasswordHash(passwordEncoder.encode("stud123"));
            student2.setFirstName("Ana");
            student2.setLastName("García");
            student2.setRole(Role.ROLE_STUDENT);
            student2.setFaculty("Medicina");
            student2.setDepartment("Medicina General");
            student2.setActive(true);
            userRepository.save(student2);
            log.info("Created student user: student2@uci.cu/stud123");
        }

        log.info("Test users initialization completed");
    }
}