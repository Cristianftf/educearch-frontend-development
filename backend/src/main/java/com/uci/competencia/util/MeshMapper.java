package com.uci.competencia.util;

import org.springframework.stereotype.Component;
import java.util.*;

/**
 * Utilidad para mapeo de términos a MeSH (Medical Subject Headings)
 * 
 * MeSH es el vocabulario controlado de la National Library of Medicine
 * Contiene ~29,000 términos jerárquicamente organizados
 * 
 * Este componente:
 * - Mapea términos comunes a descriptores MeSH
 * - Busca sinónimos
 * - Maneja variaciones de términos
 * - Cachea resultados
 */
@Component
public class MeshMapper {
    
    // Mapeo simplificado de términos comunes a MeSH (en producción usar API de MeSH)
    private static final Map<String, String> MESH_MAPPING = new HashMap<>();
    
    // Sinónimos comunes
    private static final Map<String, Set<String>> SYNONYMS = new HashMap<>();
    
    static {
        // Términos endocrinología/diabetes
        MESH_MAPPING.put("diabetes", "Diabetes Mellitus");
        MESH_MAPPING.put("diabetes type 2", "Diabetes Mellitus, Type 2");
        MESH_MAPPING.put("type 2 diabetes", "Diabetes Mellitus, Type 2");
        MESH_MAPPING.put("t2dm", "Diabetes Mellitus, Type 2");
        MESH_MAPPING.put("insulin resistance", "Insulin Resistance");
        MESH_MAPPING.put("metformin", "Metformin");
        MESH_MAPPING.put("glibenclamide", "Glyburide");
        
        // Términos cardiología
        MESH_MAPPING.put("hypertension", "Hypertension");
        MESH_MAPPING.put("high blood pressure", "Hypertension");
        MESH_MAPPING.put("heart disease", "Heart Diseases");
        MESH_MAPPING.put("cardiovascular", "Cardiovascular Diseases");
        MESH_MAPPING.put("myocardial infarction", "Myocardial Infarction");
        MESH_MAPPING.put("heart attack", "Myocardial Infarction");
        
        // Términos psiquiatría
        MESH_MAPPING.put("depression", "Depression");
        MESH_MAPPING.put("anxiety", "Anxiety");
        MESH_MAPPING.put("anxiety disorder", "Anxiety Disorders");
        MESH_MAPPING.put("bipolar", "Bipolar Disorder");
        
        // Términos infecciosas
        MESH_MAPPING.put("covid", "COVID-19");
        MESH_MAPPING.put("coronavirus", "SARS-CoV-2");
        MESH_MAPPING.put("influenza", "Influenza, Human");
        MESH_MAPPING.put("flu", "Influenza, Human");
        MESH_MAPPING.put("tuberculosis", "Tuberculosis");
        MESH_MAPPING.put("tb", "Tuberculosis");
        
        // Sinónimos
        SYNONYMS.put("Diabetes Mellitus", new HashSet<>(Arrays.asList(
            "diabetes", "diabetes mellitus", "dm", "glucose intolerance"
        )));
        SYNONYMS.put("Hypertension", new HashSet<>(Arrays.asList(
            "high blood pressure", "hypertension", "elevated blood pressure", "bp"
        )));
        SYNONYMS.put("Myocardial Infarction", new HashSet<>(Arrays.asList(
            "heart attack", "mi", "myocardial infarction", "acute coronary syndrome"
        )));
    }
    
    /**
     * Mapea un término a su descriptor MeSH
     * 
     * @param term Término a mapear
     * @return Descriptor MeSH si existe, null en caso contrario
     */
    public String mapToMeshTerm(String term) {
        if (term == null || term.trim().isEmpty()) {
            return null;
        }
        
        String normalized = normalizeTerm(term);
        
        // Búsqueda directa
        if (MESH_MAPPING.containsKey(normalized)) {
            return MESH_MAPPING.get(normalized);
        }
        
        // Búsqueda por sinónimos
        for (Map.Entry<String, Set<String>> entry : SYNONYMS.entrySet()) {
            if (entry.getValue().stream().anyMatch(s -> s.equalsIgnoreCase(normalized))) {
                return entry.getKey();
            }
        }
        
        // No encontrado
        return null;
    }
    
    /**
     * Obtiene los sinónimos de un término MeSH
     * 
     * @param meshTerm Término MeSH
     * @return Set de sinónimos
     */
    public Set<String> getSynonyms(String meshTerm) {
        return SYNONYMS.getOrDefault(meshTerm, new HashSet<>());
    }
    
    /**
     * Normaliza un término para búsqueda (lowercase, sin espacios extras)
     */
    private String normalizeTerm(String term) {
        return term.toLowerCase()
            .trim()
            .replaceAll("\\s+", " ");
    }
    
    /**
     * Busca términos MeSH que coincidan (búsqueda amplia)
     * 
     * @param partialTerm Término parcial
     * @return Lista de términos MeSH que contienen el partial
     */
    public List<String> findMatchingMeshTerms(String partialTerm) {
        List<String> matches = new ArrayList<>();
        String normalized = normalizeTerm(partialTerm).toLowerCase();
        
        MESH_MAPPING.values().stream()
            .filter(meshTerm -> meshTerm.toLowerCase().contains(normalized))
            .distinct()
            .forEach(matches::add);
        
        SYNONYMS.keySet().stream()
            .filter(meshTerm -> meshTerm.toLowerCase().contains(normalized))
            .forEach(matches::add);
        
        return matches;
    }
    
    /**
     * Obtiene la jerarquía MeSH de un término (parent terms)
     * Ejemplo: "Diabetes Mellitus, Type 2" → "Diabetes Mellitus" → "Metabolic Diseases" → ...
     * 
     * @param meshTerm Término MeSH
     * @return Lista de términos padre en la jerarquía
     */
    public List<String> getMeshHierarchy(String meshTerm) {
        // En implementación real, consultar servicio MeSH o base de datos
        // Por ahora retornamos lista vacía
        return new ArrayList<>();
    }
    
    /**
     * Obtiene la definición oficial de un término MeSH
     * 
     * @param meshTerm Término MeSH
     * @return Definición del término
     */
    public String getMeshDefinition(String meshTerm) {
        // En implementación real, consultar API MeSH o caché
        // Por ahora retornamos null
        return null;
    }
    
    /**
     * Calcula similitud entre dos términos (0-1)
     * 
     * @param term1 Primer término
     * @param term2 Segundo término
     * @return Similitud (0 = nada similar, 1 = idénticos)
     */
    public double calculateSimilarity(String term1, String term2) {
        if (term1 == null || term2 == null) {
            return 0.0;
        }
        
        String t1 = normalizeTerm(term1);
        String t2 = normalizeTerm(term2);
        
        if (t1.equals(t2)) {
            return 1.0;
        }
        
        // Mapear a MeSH y comparar
        String mesh1 = mapToMeshTerm(t1);
        String mesh2 = mapToMeshTerm(t2);
        
        if (mesh1 != null && mesh1.equals(mesh2)) {
            return 0.9;
        }
        
        // Similitud de Levenshtein
        return levenshteinSimilarity(t1, t2);
    }
    
    /**
     * Calcula similitud usando distancia de Levenshtein
     */
    private double levenshteinSimilarity(String s1, String s2) {
        int distance = levenshteinDistance(s1, s2);
        int maxLength = Math.max(s1.length(), s2.length());
        if (maxLength == 0) return 1.0;
        return 1.0 - ((double) distance / maxLength);
    }
    
    /**
     * Calcula distancia de Levenshtein entre dos strings
     */
    private int levenshteinDistance(String s1, String s2) {
        int[][] dp = new int[s1.length() + 1][s2.length() + 1];
        
        for (int i = 0; i <= s1.length(); i++) {
            dp[i][0] = i;
        }
        
        for (int j = 0; j <= s2.length(); j++) {
            dp[0][j] = j;
        }
        
        for (int i = 1; i <= s1.length(); i++) {
            for (int j = 1; j <= s2.length(); j++) {
                if (s1.charAt(i - 1) == s2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = 1 + Math.min(
                        Math.min(dp[i - 1][j], dp[i][j - 1]),
                        dp[i - 1][j - 1]
                    );
                }
            }
        }
        
        return dp[s1.length()][s2.length()];
    }
}
