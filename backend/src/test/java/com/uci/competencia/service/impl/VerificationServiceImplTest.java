package com.uci.competencia.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.uci.competencia.model.dto.request.VerificationRequestDTO;
import com.uci.competencia.model.dto.response.VerificationResponseDTO;
import com.uci.competencia.model.entity.User;
import com.uci.competencia.model.entity.VerificationResult;
import com.uci.competencia.model.enums.Role;
import com.uci.competencia.model.enums.Verdict;
import com.uci.competencia.model.enums.VerificationStatus;
import com.uci.competencia.repository.VerificationResultRepository;
import com.uci.competencia.security.UserIdentityResolver;
import com.uci.competencia.service.RAGService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("VerificationServiceImpl - Validacion semantica basada en evidencia")
class VerificationServiceImplTest {

    @Mock
    private VerificationResultRepository verificationResultRepository;

    @Mock
    private UserIdentityResolver userIdentityResolver;

    @Mock
    private ObjectMapper objectMapper;

    @Mock
    private RAGService ragService;

    @InjectMocks
    private VerificationServiceImpl verificationService;

    @Nested
    @DisplayName("verifyClaim()")
    class VerifyClaimTests {

        @Test
        @DisplayName("Given_HighEvidenceTrueClaim_When_VerifyClaim_Then_ReturnsVerifiedWithHighSemanticScore")
        void Given_HighEvidenceTrueClaim_When_VerifyClaim_Then_ReturnsVerifiedWithHighSemanticScore() throws Exception {
            VerificationRequestDTO request = buildRequest("El ejercicio reduce la diabetes.");
            User user = buildUser();

            VerificationResult initialSaved = new VerificationResult();
            initialSaved.setId("verification-001");
            initialSaved.setClaimText(request.getClaimText());
            initialSaved.setStatus(VerificationStatus.PROCESSING);

            VerificationResponseDTO ragResponse = new VerificationResponseDTO();
            ragResponse.setVerdict("SUPPORTED");
            ragResponse.setScore(0.91);
            ragResponse.setConfidence(0.93);
            ragResponse.setEvidenceCount(3);
            ragResponse.setExplanation("La literatura cientifica apoya que el ejercicio regular reduce el riesgo de diabetes tipo 2.");
            ragResponse.setRecommendations(List.of("Mantener actividad fisica regular", "Consultar revisiones sistematicas recientes"));
            ragResponse.setSupportingEvidence(List.of(evidence("38111111", true, 0.92)));
            ragResponse.setContradictingEvidence(List.of());

            when(userIdentityResolver.resolveCurrentUser()).thenReturn(Optional.of(user));
            when(verificationResultRepository.save(any(VerificationResult.class)))
                .thenReturn(initialSaved)
                .thenAnswer(invocation -> invocation.getArgument(0));
            when(ragService.verifyClaimAgainstEvidence(any())).thenReturn(ragResponse);
            when(objectMapper.writeValueAsString(any())).thenReturn("[serialized]");

            VerificationResponseDTO response = verificationService.verifyClaim(request);

            assertNotNull(response);
            assertEquals("verification-001", response.getId());
            assertEquals("El ejercicio reduce la diabetes.", response.getClaim());
            assertEquals("SUPPORTED", response.getVerdict());
            assertEquals(0.91, response.getScore());
            assertTrue(response.getConfidence() > 0.90);
            assertEquals(3, response.getEvidenceCount());

            ArgumentCaptor<VerificationResult> captor = ArgumentCaptor.forClass(VerificationResult.class);
            verify(verificationResultRepository, times(2)).save(captor.capture());
            VerificationResult initialPersisted = captor.getAllValues().get(0);
            VerificationResult persistedFinal = captor.getAllValues().get(1);
            assertEquals(user, initialPersisted.getUser());
            assertEquals(VerificationStatus.COMPLETED, persistedFinal.getStatus());
            assertEquals(Verdict.SUPPORTED, persistedFinal.getVerdict());
            assertEquals(0.91, persistedFinal.getOverallScore());
            verify(ragService).verifyClaimAgainstEvidence(any());
        }

        @Test
        @DisplayName("Given_FalseClaim_When_VerifyClaim_Then_ReturnsMisinformationWithLowScore")
        void Given_FalseClaim_When_VerifyClaim_Then_ReturnsMisinformationWithLowScore() throws Exception {
            VerificationRequestDTO request = buildRequest("El chocolate cura el cáncer.");

            VerificationResult initialSaved = new VerificationResult();
            initialSaved.setId("verification-002");
            initialSaved.setClaimText(request.getClaimText());
            initialSaved.setStatus(VerificationStatus.PROCESSING);

            VerificationResponseDTO ragResponse = new VerificationResponseDTO();
            ragResponse.setVerdict("REFUTED");
            ragResponse.setScore(0.14);
            ragResponse.setConfidence(0.89);
            ragResponse.setEvidenceCount(4);
            ragResponse.setExplanation("La afirmacion es falsa y corresponde a un patron de desinformacion medica.");
            ragResponse.setRecommendations(List.of("No difundir la afirmacion", "Consultar fuentes oncologicas oficiales"));
            ragResponse.setSupportingEvidence(List.of());
            ragResponse.setContradictingEvidence(List.of(evidence("38222222", false, 0.88)));

            when(verificationResultRepository.save(any(VerificationResult.class)))
                .thenReturn(initialSaved)
                .thenAnswer(invocation -> invocation.getArgument(0));
            when(ragService.verifyClaimAgainstEvidence(any())).thenReturn(ragResponse);
            when(objectMapper.writeValueAsString(any())).thenReturn("[serialized]");
            when(userIdentityResolver.resolveCurrentUser()).thenReturn(Optional.empty());

            VerificationResponseDTO response = verificationService.verifyClaim(request);

            assertEquals("REFUTED", response.getVerdict());
            assertTrue(response.getScore() < 0.20);
            assertTrue(response.getConfidence() > 0.80);

            ArgumentCaptor<VerificationResult> captor = ArgumentCaptor.forClass(VerificationResult.class);
            verify(verificationResultRepository, times(2)).save(captor.capture());
            VerificationResult persistedFinal = captor.getAllValues().get(1);
            assertEquals(Verdict.REFUTED, persistedFinal.getVerdict());
            assertEquals(VerificationStatus.COMPLETED, persistedFinal.getStatus());
        }

        @Test
        @DisplayName("Given_AmbiguousClaim_When_VerifyClaim_Then_ReturnsConflictingWithMediumScore")
        void Given_AmbiguousClaim_When_VerifyClaim_Then_ReturnsConflictingWithMediumScore() throws Exception {
            VerificationRequestDTO request = buildRequest("La vitamina D previene resfriados.");

            VerificationResult initialSaved = new VerificationResult();
            initialSaved.setId("verification-003");
            initialSaved.setClaimText(request.getClaimText());
            initialSaved.setStatus(VerificationStatus.PROCESSING);

            VerificationResponseDTO ragResponse = new VerificationResponseDTO();
            ragResponse.setVerdict("CONFLICTING");
            ragResponse.setScore(0.56);
            ragResponse.setConfidence(0.61);
            ragResponse.setEvidenceCount(2);
            ragResponse.setExplanation("La evidencia es ambigua: algunos estudios sugieren beneficio, pero no existe consenso robusto.");
            ragResponse.setRecommendations(List.of("Revisar metaanalisis recientes", "Evitar afirmaciones absolutas"));
            ragResponse.setSupportingEvidence(List.of(evidence("38333333", true, 0.62)));
            ragResponse.setContradictingEvidence(List.of(evidence("38333334", false, 0.58)));

            when(verificationResultRepository.save(any(VerificationResult.class)))
                .thenReturn(initialSaved)
                .thenAnswer(invocation -> invocation.getArgument(0));
            when(ragService.verifyClaimAgainstEvidence(any())).thenReturn(ragResponse);
            when(objectMapper.writeValueAsString(any())).thenReturn("[serialized]");

            VerificationResponseDTO response = verificationService.verifyClaim(request);

            assertEquals("CONFLICTING", response.getVerdict());
            assertTrue(response.getScore() >= 0.45 && response.getScore() <= 0.65);
            assertTrue(response.getConfidence() >= 0.50 && response.getConfidence() <= 0.70);
            verify(ragService).verifyClaimAgainstEvidence(any());
        }

        @Test
        @DisplayName("Given_ClaimWithoutScientificEvidence_When_VerifyClaim_Then_ReturnsInsufficientEvidence")
        void Given_ClaimWithoutScientificEvidence_When_VerifyClaim_Then_ReturnsInsufficientEvidence() throws Exception {
            VerificationRequestDTO request = buildRequest("Una pulsera magnetica elimina la insuficiencia renal.");

            VerificationResult initialSaved = new VerificationResult();
            initialSaved.setId("verification-004");
            initialSaved.setClaimText(request.getClaimText());
            initialSaved.setStatus(VerificationStatus.PROCESSING);

            VerificationResponseDTO ragResponse = new VerificationResponseDTO();
            ragResponse.setVerdict("INSUFFICIENT_EVIDENCE");
            ragResponse.setScore(0.31);
            ragResponse.setConfidence(0.42);
            ragResponse.setEvidenceCount(0);
            ragResponse.setExplanation("No se encontro evidencia cientifica suficiente para validar la afirmacion.");
            ragResponse.setRecommendations(List.of("Buscar ensayos clinicos", "No usar la afirmacion como recomendacion medica"));
            ragResponse.setSupportingEvidence(List.of());
            ragResponse.setContradictingEvidence(List.of());

            when(verificationResultRepository.save(any(VerificationResult.class)))
                .thenReturn(initialSaved)
                .thenAnswer(invocation -> invocation.getArgument(0));
            when(ragService.verifyClaimAgainstEvidence(any())).thenReturn(ragResponse);
            when(objectMapper.writeValueAsString(any())).thenReturn("[serialized]");

            VerificationResponseDTO response = verificationService.verifyClaim(request);

            assertEquals("INSUFFICIENT_EVIDENCE", response.getVerdict());
            assertEquals(0, response.getEvidenceCount());
            assertTrue(response.getScore() < 0.40);
        }

        @Test
        @DisplayName("Given_AIModelException_When_VerifyClaim_Then_ReturnsPendingFallbackAndStoresFailure")
        void Given_AIModelException_When_VerifyClaim_Then_ReturnsPendingFallbackAndStoresFailure() throws Exception {
            VerificationRequestDTO request = buildRequest("El chocolate cura el cáncer.");

            VerificationResult initialSaved = new VerificationResult();
            initialSaved.setId("verification-005");
            initialSaved.setClaimText(request.getClaimText());
            initialSaved.setStatus(VerificationStatus.PROCESSING);

            when(verificationResultRepository.save(any(VerificationResult.class)))
                .thenReturn(initialSaved)
                .thenAnswer(invocation -> invocation.getArgument(0));
            when(ragService.verifyClaimAgainstEvidence(any()))
                .thenThrow(new RuntimeException("BioBERT model timeout"));

            VerificationResponseDTO response = verificationService.verifyClaim(request);

            assertNotNull(response);
            assertEquals("verification-005", response.getId());
            assertEquals("pending", response.getStatus());
            assertEquals(0.0, response.getScore());
            assertTrue(response.getExplanation().contains("No se pudo completar"));

            ArgumentCaptor<VerificationResult> captor = ArgumentCaptor.forClass(VerificationResult.class);
            verify(verificationResultRepository, times(2)).save(captor.capture());
            VerificationResult failedResult = captor.getAllValues().get(1);
            assertEquals(VerificationStatus.FAILED, failedResult.getStatus());
            verify(objectMapper, never()).writeValueAsString(any());
        }
    }

    @Nested
    @DisplayName("getVerificationResult() y getVerificationHistory()")
    class RetrievalTests {

        @Test
        @DisplayName("Given_PersistedVerification_When_GetVerificationResult_Then_MapsSemanticEvidenceCorrectly")
        void Given_PersistedVerification_When_GetVerificationResult_Then_MapsSemanticEvidenceCorrectly() throws Exception {
            VerificationResult persisted = new VerificationResult();
            persisted.setId("verification-100");
            persisted.setClaimText("La vitamina D previene resfriados.");
            persisted.setStatus(VerificationStatus.COMPLETED);
            persisted.setVerdict(Verdict.CONFLICTING);
            persisted.setOverallScore(0.57);
            persisted.setConfidence(0.63);
            persisted.setEvidenceCount(2);
            persisted.setSupportingEvidence("[{\"pmid\":\"38100001\",\"title\":\"Vitamin D and respiratory infections\",\"snippet\":\"Possible benefit in deficient adults\",\"supports\":true,\"similarity\":0.62}]");
            persisted.setConflictingEvidence("[{\"pmid\":\"38100002\",\"title\":\"Vitamin D trial\",\"snippet\":\"No significant prevention effect\",\"supports\":false,\"similarity\":0.58}]");
            persisted.setRecommendations("[\"Evitar generalizaciones\",\"Consultar revisiones sistematicas\"]");
            persisted.setExplanations("La evidencia es mixta.");
            persisted.setCompletedAt(LocalDateTime.of(2026, 5, 7, 18, 30));

            when(verificationResultRepository.findById("verification-100")).thenReturn(Optional.of(persisted));
            when(objectMapper.readValue(eq(persisted.getSupportingEvidence()), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(List.of(Map.of("pmid", "38100001", "title", "Vitamin D and respiratory infections", "snippet", "Possible benefit in deficient adults", "supports", true, "similarity", 0.62)));
            when(objectMapper.readValue(eq(persisted.getConflictingEvidence()), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(List.of(Map.of("pmid", "38100002", "title", "Vitamin D trial", "snippet", "No significant prevention effect", "supports", false, "similarity", 0.58)));
            when(objectMapper.readValue(eq(persisted.getRecommendations()), any(com.fasterxml.jackson.core.type.TypeReference.class)))
                .thenReturn(List.of("Evitar generalizaciones", "Consultar revisiones sistematicas"));

            VerificationResponseDTO response = verificationService.getVerificationResult("verification-100");

            assertEquals("conflicting", response.getStatus());
            assertEquals(0.57, response.getScore());
            assertEquals(2, response.getEvidenceCount());
            assertEquals(1, response.getSupportingEvidence().size());
            assertEquals(1, response.getContradictingEvidence().size());
            assertTrue(response.getSupportingEvidence().getFirst().getSupports());
            assertFalse(response.getContradictingEvidence().getFirst().getSupports());
        }

        @Test
        @DisplayName("Given_HistoryRequest_When_GetVerificationHistory_Then_ReturnsPaginatedSemanticResults")
        void Given_HistoryRequest_When_GetVerificationHistory_Then_ReturnsPaginatedSemanticResults() {
            User user = buildUser();
            VerificationResult item = new VerificationResult();
            item.setId("history-001");
            item.setUser(user);
            item.setClaimText("El ejercicio reduce la diabetes.");
            item.setStatus(VerificationStatus.COMPLETED);
            item.setVerdict(Verdict.SUPPORTED);
            item.setOverallScore(0.88);
            item.setCompletedAt(LocalDateTime.now());

            when(verificationResultRepository.findByUser_Id(eq("user-001"), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(item)));

            List<VerificationResponseDTO> history = verificationService.getVerificationHistory("user-001", 1, 10);

            assertEquals(1, history.size());
            assertEquals("verified", history.getFirst().getStatus());
            assertEquals("El ejercicio reduce la diabetes.", history.getFirst().getClaim());
        }
    }

    private VerificationRequestDTO buildRequest(String claim) {
        VerificationRequestDTO request = new VerificationRequestDTO();
        request.setClaimText(claim);
        VerificationRequestDTO.VerificationContextDTO context = new VerificationRequestDTO.VerificationContextDTO();
        context.setSessionId("semantic-session-001");
        request.setContext(context);
        return request;
    }

    private User buildUser() {
        User user = new User();
        user.setId("user-001");
        user.setEmail("ana.medina@edusearch.edu");
        user.setUsername("ana.medina");
        user.setRole(Role.ROLE_STUDENT);
        return user;
    }

    private VerificationResponseDTO.EvidenceDTO evidence(String pmid, boolean supports, double similarity) {
        VerificationResponseDTO.EvidenceDTO evidence = new VerificationResponseDTO.EvidenceDTO();
        evidence.setPmid(pmid);
        evidence.setArticleId(pmid);
        evidence.setTitle("Scientific evidence for " + pmid);
        evidence.setSnippet("Snippet for " + pmid);
        evidence.setSupports(supports);
        evidence.setSimilarity(similarity);
        evidence.setRelevanceScore(similarity);
        evidence.setEvidenceLevel(supports ? 1 : 2);
        return evidence;
    }
}
