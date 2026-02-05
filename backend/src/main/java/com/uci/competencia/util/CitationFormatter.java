package com.uci.competencia.util;

import org.springframework.stereotype.Component;
import java.util.List;
import java.util.StringJoiner;

/**
 * Utilidad para formatear citas en múltiples estilos
 * 
 * Estilos soportados:
 * - APA (American Psychological Association)
 * - VANCOUVER (International Committee of Medical Journal Editors)
 * - BIBTEX (Para LaTeX)
 * - XML
 */
@Component
public class CitationFormatter {
    
    /**
     * Interfaz simple para artículo
     */
    public static class Article {
        public String pmid;
        public String title;
        public List<String> authors;
        public String journal;
        public String publicationDate;
        public String volume;
        public String issue;
        public String pages;
        public String doi;
        public String url;
    }
    
    /**
     * Formatea cita en estilo APA
     * 
     * Formato:
     * Autor(es) (Año). Título del artículo. Título de la Revista, volumen(número), páginas.
     * 
     * @param article Artículo a citar
     * @return Cita formateada en APA
     */
    public String formatAPA(Article article) {
        StringBuilder citation = new StringBuilder();
        
        // Autores
        citation.append(formatAuthorsAPA(article.authors));
        
        // Año
        String year = extractYear(article.publicationDate);
        citation.append(" (").append(year).append("). ");
        
        // Título del artículo
        citation.append(article.title).append(". ");
        
        // Revista (en cursiva, aquí en CAPS)
        citation.append(article.journal);
        
        // Volumen (número), páginas
        if (article.volume != null) {
            citation.append(", ").append(article.volume);
            if (article.issue != null) {
                citation.append("(").append(article.issue).append(")");
            }
            if (article.pages != null) {
                citation.append(", ").append(article.pages);
            }
        }
        
        citation.append(".");
        
        // DOI
        if (article.doi != null) {
            citation.append(" https://doi.org/").append(article.doi);
        }
        
        return citation.toString();
    }
    
    /**
     * Formatea cita en estilo Vancouver
     * 
     * Formato:
     * Autor(es). Título del artículo. Título de la Revista. Año;volumen(número):páginas.
     * 
     * @param article Artículo a citar
     * @return Cita formateada en Vancouver
     */
    public String formatVancouver(Article article) {
        StringBuilder citation = new StringBuilder();
        
        // Autores
        citation.append(formatAuthorsVancouver(article.authors));
        
        // Título del artículo
        citation.append(". ").append(article.title).append(". ");
        
        // Revista
        citation.append(article.journal).append(". ");
        
        // Año
        String year = extractYear(article.publicationDate);
        citation.append(year).append(";");
        
        // Volumen(número):páginas
        if (article.volume != null) {
            citation.append(article.volume);
            if (article.issue != null) {
                citation.append("(").append(article.issue).append(")");
            }
            if (article.pages != null) {
                citation.append(":").append(article.pages);
            }
        }
        
        citation.append(".");
        
        // PMID
        if (article.pmid != null) {
            citation.append(" PMID: ").append(article.pmid);
        }
        
        return citation.toString();
    }
    
    /**
     * Formatea cita en formato BibTeX
     * 
     * @param article Artículo a citar
     * @param citationKey Clave única para la cita
     * @return Entrada BibTeX
     */
    public String formatBibTeX(Article article, String citationKey) {
        StringBuilder bibtex = new StringBuilder();
        
        bibtex.append("@article{").append(citationKey).append(",\n");
        bibtex.append("  author = {").append(formatAuthorsForBibTeX(article.authors)).append("},\n");
        bibtex.append("  title = {").append(article.title).append("},\n");
        bibtex.append("  journal = {").append(article.journal).append("},\n");
        
        String year = extractYear(article.publicationDate);
        bibtex.append("  year = {").append(year).append("},\n");
        
        if (article.volume != null) {
            bibtex.append("  volume = {").append(article.volume).append("},\n");
        }
        if (article.issue != null) {
            bibtex.append("  number = {").append(article.issue).append("},\n");
        }
        if (article.pages != null) {
            bibtex.append("  pages = {").append(article.pages).append("},\n");
        }
        if (article.doi != null) {
            bibtex.append("  doi = {").append(article.doi).append("},\n");
        }
        if (article.pmid != null) {
            bibtex.append("  pmid = {").append(article.pmid).append("},\n");
        }
        
        bibtex.setLength(bibtex.length() - 2); // Eliminar última coma y salto
        bibtex.append("\n}");
        
        return bibtex.toString();
    }
    
    /**
     * Formatea cita en XML
     * 
     * @param article Artículo a citar
     * @return Entrada XML
     */
    public String formatXML(Article article) {
        StringBuilder xml = new StringBuilder();
        
        xml.append("<citation>\n");
        xml.append("  <pmid>").append(escapeXML(article.pmid)).append("</pmid>\n");
        xml.append("  <title>").append(escapeXML(article.title)).append("</title>\n");
        xml.append("  <journal>").append(escapeXML(article.journal)).append("</journal>\n");
        
        xml.append("  <authors>\n");
        for (String author : article.authors) {
            xml.append("    <author>").append(escapeXML(author)).append("</author>\n");
        }
        xml.append("  </authors>\n");
        
        if (article.publicationDate != null) {
            xml.append("  <publicationDate>").append(article.publicationDate).append("</publicationDate>\n");
        }
        if (article.volume != null) {
            xml.append("  <volume>").append(article.volume).append("</volume>\n");
        }
        if (article.issue != null) {
            xml.append("  <issue>").append(article.issue).append("</issue>\n");
        }
        if (article.pages != null) {
            xml.append("  <pages>").append(article.pages).append("</pages>\n");
        }
        if (article.doi != null) {
            xml.append("  <doi>").append(article.doi).append("</doi>\n");
        }
        if (article.url != null) {
            xml.append("  <url>").append(escapeXML(article.url)).append("</url>\n");
        }
        
        xml.append("</citation>");
        
        return xml.toString();
    }
    
    /**
     * Formatea autores en estilo APA
     * Smith, J., Johnson, B., & Williams, C. (Máx 3 autores)
     */
    private String formatAuthorsAPA(List<String> authors) {
        if (authors == null || authors.isEmpty()) {
            return "Unknown author";
        }
        
        if (authors.size() == 1) {
            return formatAuthorName(authors.get(0));
        } else if (authors.size() == 2) {
            return formatAuthorName(authors.get(0)) + " & " + formatAuthorName(authors.get(1));
        } else if (authors.size() <= 3) {
            StringJoiner joiner = new StringJoiner(", ");
            for (int i = 0; i < authors.size() - 1; i++) {
                joiner.add(formatAuthorName(authors.get(i)));
            }
            joiner.add("& " + formatAuthorName(authors.get(authors.size() - 1)));
            return joiner.toString();
        } else {
            // Más de 3: solo el primero + et al.
            return formatAuthorName(authors.get(0)) + " et al.";
        }
    }
    
    /**
     * Formatea autores en estilo Vancouver
     * Smith J, Johnson B, Williams C
     */
    private String formatAuthorsVancouver(List<String> authors) {
        if (authors == null || authors.isEmpty()) {
            return "Unknown author";
        }
        
        StringJoiner joiner = new StringJoiner(", ");
        int limit = Math.min(authors.size(), 3); // Vancouver: máximo 3
        
        for (int i = 0; i < limit; i++) {
            String fullName = authors.get(i);
            String[] parts = fullName.split(" ");
            if (parts.length >= 2) {
                // Formato: Last First Middle -> Last F
                joiner.add(parts[parts.length - 1] + " " + parts[0].charAt(0));
            } else {
                joiner.add(fullName);
            }
        }
        
        if (authors.size() > 3) {
            joiner.add("et al");
        }
        
        return joiner.toString();
    }
    
    /**
     * Formatea autores para BibTeX
     */
    private String formatAuthorsForBibTeX(List<String> authors) {
        if (authors == null || authors.isEmpty()) {
            return "Unknown";
        }
        
        return String.join(" and ", authors);
    }
    
    /**
     * Formatea nombre de autor (asume formato "First Last")
     */
    private String formatAuthorName(String author) {
        if (author == null || author.isEmpty()) {
            return "Unknown";
        }
        
        String[] parts = author.split(" ");
        if (parts.length >= 2) {
            // "First Last" -> "Last, F."
            String last = parts[parts.length - 1];
            String first = parts[0];
            return last + ", " + first.charAt(0) + ".";
        }
        return author;
    }
    
    /**
     * Extrae año de una fecha
     */
    private String extractYear(String date) {
        if (date == null) return "s.a.";
        
        // Formatos: "2023-06-15", "June 15, 2023", "2023"
        if (date.contains("-")) {
            return date.substring(0, 4);
        } else if (date.contains(",")) {
            String[] parts = date.split(",");
            return parts[parts.length - 1].trim();
        } else {
            return date;
        }
    }
    
    /**
     * Escapa caracteres especiales en XML
     */
    private String escapeXML(String str) {
        if (str == null) return "";
        return str
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&apos;");
    }
}
