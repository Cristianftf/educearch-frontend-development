package com.uci.competencia.security;

import com.uci.competencia.model.entity.User;
import com.uci.competencia.repository.UserRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("UserIdentityResolver - Resolucion de identidad autenticada")
class UserIdentityResolverTest {

    private static final String USER_ID = "550e8400-e29b-41d4-a716-446655440000";
    private static final String EMAIL = "investigador.medico@edusearch.edu";
    private static final String USERNAME = "investigador.medico";

    @Mock
    private UserRepository userRepository;

    @AfterEach
    void tearDown() {
        SecurityContextHolder.clearContext();
    }

    @Nested
    @DisplayName("findUserByIdentifier()")
    class FindUserByIdentifierTests {

        @Test
        @DisplayName("Given_UUIDIdentifier_When_FindUserByIdentifier_Then_ReturnsUserWithoutFallbackLookups")
        void Given_UUIDIdentifier_When_FindUserByIdentifier_Then_ReturnsUserWithoutFallbackLookups() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            com.uci.competencia.model.entity.User persistedUser = buildMedicalResearchUser();

            when(userRepository.findById(USER_ID)).thenReturn(Optional.of(persistedUser));

            Optional<com.uci.competencia.model.entity.User> resolved = resolver.findUserByIdentifier(USER_ID);

            assertTrue(resolved.isPresent());
            assertEquals(USER_ID, resolved.get().getId());
            verify(userRepository).findById(USER_ID);
            verify(userRepository, never()).findByEmail(USER_ID);
            verify(userRepository, never()).findByUsername(USER_ID);
        }

        @Test
        @DisplayName("Given_EmailIdentifier_When_FindUserByIdentifier_Then_ReturnsUser")
        void Given_EmailIdentifier_When_FindUserByIdentifier_Then_ReturnsUser() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            com.uci.competencia.model.entity.User persistedUser = buildMedicalResearchUser();

            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(persistedUser));

            Optional<com.uci.competencia.model.entity.User> resolved = resolver.findUserByIdentifier(EMAIL);

            assertTrue(resolved.isPresent());
            assertEquals(EMAIL, resolved.get().getEmail());
            verify(userRepository, never()).findById(EMAIL);
            verify(userRepository).findByEmail(EMAIL);
            verify(userRepository, never()).findByUsername(EMAIL);
        }

        @Test
        @DisplayName("Given_UsernameIdentifier_When_FindUserByIdentifier_Then_FallsBackToUsernameLookup")
        void Given_UsernameIdentifier_When_FindUserByIdentifier_Then_FallsBackToUsernameLookup() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            com.uci.competencia.model.entity.User persistedUser = buildMedicalResearchUser();

            when(userRepository.findByEmail(USERNAME)).thenReturn(Optional.empty());
            when(userRepository.findByUsername(USERNAME)).thenReturn(Optional.of(persistedUser));

            Optional<com.uci.competencia.model.entity.User> resolved = resolver.findUserByIdentifier(USERNAME);

            assertTrue(resolved.isPresent());
            assertEquals(USERNAME, resolved.get().getUsername());
            verify(userRepository).findByEmail(USERNAME);
            verify(userRepository).findByUsername(USERNAME);
        }

        @Test
        @DisplayName("Given_AnonymousIdentifier_When_FindUserByIdentifier_Then_ReturnsEmptyWithoutRepositoryCalls")
        void Given_AnonymousIdentifier_When_FindUserByIdentifier_Then_ReturnsEmptyWithoutRepositoryCalls() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);

            Optional<com.uci.competencia.model.entity.User> resolved = resolver.findUserByIdentifier("anonymousUser");

            assertFalse(resolved.isPresent());
            verifyNoInteractions(userRepository);
        }
    }

    @Nested
    @DisplayName("resolveCurrentUser()")
    class ResolveCurrentUserTests {

        @Test
        @DisplayName("Given_AuthenticatedPrincipalEmail_When_ResolveCurrentUser_Then_ReturnsPersistedUser")
        void Given_AuthenticatedPrincipalEmail_When_ResolveCurrentUser_Then_ReturnsPersistedUser() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            com.uci.competencia.model.entity.User persistedUser = buildMedicalResearchUser();
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(EMAIL, null)
            );

            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(persistedUser));

            Optional<com.uci.competencia.model.entity.User> resolved = resolver.resolveCurrentUser();

            assertTrue(resolved.isPresent());
            assertEquals(USER_ID, resolved.get().getId());
            verify(userRepository).findByEmail(EMAIL);
        }

        @Test
        @DisplayName("Given_AuthenticatedUserDetails_When_GetCurrentPrincipalIdentifier_Then_ReturnsNormalizedUsername")
        void Given_AuthenticatedUserDetails_When_GetCurrentPrincipalIdentifier_Then_ReturnsNormalizedUsername() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            UserDetails principal = org.springframework.security.core.userdetails.User.withUsername("  " + EMAIL + "  ")
                .password("ignored")
                .authorities("ROLE_STUDENT")
                .build();
            SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities())
            );

            Optional<String> resolvedIdentifier = resolver.getCurrentPrincipalIdentifier();

            assertTrue(resolvedIdentifier.isPresent());
            assertEquals(EMAIL, resolvedIdentifier.get());
            verifyNoInteractions(userRepository);
        }
    }

    @Nested
    @DisplayName("resolveCanonicalUserId() y resolveUserIdentifiers()")
    class CanonicalIdentityTests {

        @Test
        @DisplayName("Given_PrincipalEmail_When_ResolveCanonicalUserId_Then_ReturnsStableUuid")
        void Given_PrincipalEmail_When_ResolveCanonicalUserId_Then_ReturnsStableUuid() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            com.uci.competencia.model.entity.User persistedUser = buildMedicalResearchUser();

            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(persistedUser));

            String canonicalId = resolver.resolveCanonicalUserId(EMAIL);

            assertEquals(USER_ID, canonicalId);
            verify(userRepository).findByEmail(EMAIL);
        }

        @Test
        @DisplayName("Given_PersistedUser_When_ResolveUserIdentifiers_Then_ReturnsIdEmailAndUsername")
        void Given_PersistedUser_When_ResolveUserIdentifiers_Then_ReturnsIdEmailAndUsername() {
            UserIdentityResolver resolver = new UserIdentityResolver(userRepository);
            com.uci.competencia.model.entity.User persistedUser = buildMedicalResearchUser();

            when(userRepository.findByEmail(EMAIL)).thenReturn(Optional.of(persistedUser));

            Set<String> identifiers = resolver.resolveUserIdentifiers(EMAIL);
            LinkedHashSet<String> expectedIdentifiers = new LinkedHashSet<>();
            expectedIdentifiers.add(EMAIL);
            expectedIdentifiers.add(USER_ID);
            expectedIdentifiers.add(USERNAME);

            assertEquals(3, identifiers.size());
            assertIterableEquals(
                expectedIdentifiers,
                new LinkedHashSet<>(identifiers)
            );
        }
    }

    private com.uci.competencia.model.entity.User buildMedicalResearchUser() {
        com.uci.competencia.model.entity.User user = new com.uci.competencia.model.entity.User();
        user.setId(USER_ID);
        user.setEmail(EMAIL);
        user.setUsername(USERNAME);
        user.setFirstName("Elena");
        user.setLastName("Suarez");
        user.setFaculty("Medicina");
        user.setDepartment("Investigacion Clinica");
        user.setActive(true);
        return user;
    }
}
