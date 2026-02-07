package com.uci.competencia.model.converter;

import com.uci.competencia.model.enums.CaseDifficulty;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

@Converter(autoApply = false)
public class CaseDifficultyConverter implements AttributeConverter<CaseDifficulty, String> {

    @Override
    public String convertToDatabaseColumn(CaseDifficulty attribute) {
        if (attribute == null) {
            return CaseDifficulty.NOVICE.name();
        }
        return attribute.name();
    }

    @Override
    public CaseDifficulty convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.trim().isEmpty()) {
            return CaseDifficulty.NOVICE;
        }
        try {
            return CaseDifficulty.valueOf(dbData.trim().toUpperCase());
        } catch (IllegalArgumentException e) {
            return CaseDifficulty.NOVICE;
        }
    }
}
