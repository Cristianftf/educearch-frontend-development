#!/bin/bash

###############################################################################
# Script para validar cabeceras de protección contra clickjacking
# Verifica X-Frame-Options y Content-Security-Policy en todos los endpoints
# 
# Uso: ./validate-clickjacking-protection.sh [env] [backend-url]
# Ejemplo: ./validate-clickjacking-protection.sh dev http://localhost:8080
###############################################################################

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
ORANGE='\033[0;33m'
NC='\033[0m' # No Color

# Configuración por defecto
ENV=${1:-dev}
BACKEND_URL=${2:-http://localhost:8080}
FRONTEND_URL=${3:-http://localhost:3000}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Clickjacking Protection Validation${NC}"
echo -e "${BLUE}Environment: $ENV${NC}"
echo -e "${BLUE}Backend: $BACKEND_URL${NC}"
echo -e "${BLUE}Frontend: $FRONTEND_URL${NC}"
echo -e "${BLUE}========================================${NC}\n"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0

# Función para validar cabeceras
validate_headers() {
    local url=$1
    local name=$2
    local expected_x_frame=$3  # SAMEORIGIN o DENY
    
    echo -e "${YELLOW}Validando: $name${NC}"
    echo "  URL: $url"
    
    # Hacer request y capturar headers
    headers=$(curl -s -I "$url" 2>/dev/null || echo "ERROR")
    
    if [[ "$headers" == "ERROR" ]]; then
        echo -e "  ${RED}❌ FAIL${NC}: No se puede conectar"
        ((FAIL_COUNT++))
        echo ""
        return
    fi
    
    # Validar X-Frame-Options
    x_frame=$(echo "$headers" | grep -i "^X-Frame-Options:" | cut -d' ' -f2- | tr -d '\r')
    
    if [[ -n "$x_frame" ]]; then
        if [[ "$x_frame" == "$expected_x_frame" ]]; then
            echo -e "  ${GREEN}✅ X-Frame-Options: $x_frame${NC}"
            ((PASS_COUNT++))
        else
            echo -e "  ${ORANGE}⚠️  X-Frame-Options: $x_frame (esperado: $expected_x_frame)${NC}"
            ((WARN_COUNT++))
        fi
    else
        echo -e "  ${RED}❌ X-Frame-Options NO ENCONTRADO${NC}"
        ((FAIL_COUNT++))
    fi
    
    # Validar Content-Security-Policy frame-ancestors
    csp=$(echo "$headers" | grep -i "^Content-Security-Policy:" | cut -d' ' -f2-)
    
    if [[ "$csp" == *"frame-ancestors"* ]]; then
        frame_ancestors=$(echo "$csp" | grep -oP "frame-ancestors [^;]+")
        echo -e "  ${GREEN}✅ CSP: $frame_ancestors${NC}"
        ((PASS_COUNT++))
    else
        echo -e "  ${RED}❌ CSP frame-ancestors NO ENCONTRADO${NC}"
        ((FAIL_COUNT++))
    fi
    
    echo ""
}

# Función para validar múltiples endpoints
validate_endpoint_group() {
    local base_url=$1
    local group_name=$2
    local endpoints=$3
    local token=${4:-}
    
    echo -e "${BLUE}─────────────────────────────────────${NC}"
    echo -e "${BLUE}Grupo: $group_name${NC}"
    echo -e "${BLUE}─────────────────────────────────────${NC}\n"
    
    while IFS= read -r endpoint; do
        [[ -z "$endpoint" ]] && continue
        [[ "$endpoint" =~ ^# ]] && continue
        
        url="${base_url}${endpoint}"
        
        # Hacer request con headers si es necesario
        if [[ -n "$token" ]]; then
            headers=$(curl -s -I -H "Authorization: Bearer $token" "$url" 2>/dev/null || echo "ERROR")
        else
            headers=$(curl -s -I "$url" 2>/dev/null || echo "ERROR")
        fi
        
        if [[ "$headers" == "ERROR" ]]; then
            echo -e "${YELLOW}$endpoint${NC}"
            echo -e "  ${RED}❌ No se puede conectar${NC}\n"
            ((FAIL_COUNT++))
            continue
        fi
        
        echo -e "${YELLOW}$endpoint${NC}"
        
        # X-Frame-Options
        x_frame=$(echo "$headers" | grep -i "^X-Frame-Options:" | cut -d' ' -f2- | tr -d '\r')
        if [[ -n "$x_frame" ]]; then
            echo -e "  ${GREEN}✅${NC} X-Frame-Options: $x_frame"
            ((PASS_COUNT++))
        else
            echo -e "  ${RED}❌${NC} X-Frame-Options missing"
            ((FAIL_COUNT++))
        fi
        
        # CSP frame-ancestors
        if echo "$headers" | grep -iq "frame-ancestors"; then
            echo -e "  ${GREEN}✅${NC} CSP frame-ancestors configured"
            ((PASS_COUNT++))
        else
            echo -e "  ${RED}❌${NC} CSP frame-ancestors missing"
            ((FAIL_COUNT++))
        fi
        
        echo ""
    done <<< "$endpoints"
}

# ============================================================================
# VALIDACIONES BACKEND
# ============================================================================

echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   VALIDACIÓN BACKEND (Spring Boot)  ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}\n"

# Endpoints públicos del backend
public_endpoints="/api/auth/login
/api/auth/register
/api/auth/refresh-token
/error"

validate_endpoint_group "$BACKEND_URL" "Endpoints Públicos" "$public_endpoints"

# Endpoints sensibles (admin)
admin_endpoints="/swagger-ui/index.html
/v3/api-docs
/api/health
/actuator"

echo -e "${BLUE}Nota${NC}: Los endpoints admin requerirán token ADMIN para acceso real"
validate_endpoint_group "$BACKEND_URL" "Endpoints Admin (Sensibles)" "$admin_endpoints"

# ============================================================================
# VALIDACIONES FRONTEND
# ============================================================================

echo -e "${BLUE}╔════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   VALIDACIÓN FRONTEND (Next.js)    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════╝${NC}\n"

if [[ "$FRONTEND_URL" != "disabled" ]]; then
    frontend_endpoints="/
/login
/register
/_next/image"
    
    validate_endpoint_group "$FRONTEND_URL" "Páginas Frontend" "$frontend_endpoints"
else
    echo -e "${ORANGE}Frontend validation deshabilitado${NC}\n"
fi

# ============================================================================
# RESUMEN
# ============================================================================

echo -e "${BLUE}════════════════════════════════════${NC}"
echo -e "${BLUE}Resumen de Validación${NC}"
echo -e "${BLUE}════════════════════════════════════${NC}\n"

echo -e "Total de validaciones:"
echo -e "  ${GREEN}✅ Pasadas: $PASS_COUNT${NC}"
echo -e "  ${RED}❌ Fallidas: $FAIL_COUNT${NC}"
echo -e "  ${ORANGE}⚠️  Advertencias: $WARN_COUNT${NC}\n"

# Calcular porcentaje
TOTAL=$((PASS_COUNT + FAIL_COUNT + WARN_COUNT))
if [[ $TOTAL -gt 0 ]]; then
    SUCCESS_RATE=$((PASS_COUNT * 100 / TOTAL))
    echo -e "Tasa de éxito: ${YELLOW}${SUCCESS_RATE}%${NC}\n"
fi

# Verificaciones específicas
echo -e "${BLUE}Verificaciones Clave:${NC}\n"

# X-Frame-Options SAMEORIGIN
echo -n "¿X-Frame-Options: SAMEORIGIN en todas las respuestas? "
if [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

# CSP frame-ancestors
echo -n "¿CSP frame-ancestors 'self' en todas las respuestas? "
if [[ $(grep -c "frame-ancestors" <<< "$(curl -s -I $BACKEND_URL/ 2>/dev/null || echo '')" || echo 0) -gt 0 ]]; then
    echo -e "${GREEN}✅${NC}"
else
    echo -e "${RED}❌${NC}"
fi

echo ""

# Recomendaciones basadas en resultados
if [[ $FAIL_COUNT -eq 0 ]] && [[ $WARN_COUNT -eq 0 ]]; then
    echo -e "${GREEN}🎉 ¡Todas las validaciones pasaron!${NC}"
    echo -e "✅ Protección contra clickjacking: ${GREEN}IMPLEMENTADA${NC}\n"
    exit 0
elif [[ $FAIL_COUNT -eq 0 ]]; then
    echo -e "${ORANGE}⚠️  Hay algunas advertencias que revisar${NC}\n"
    exit 0
else
    echo -e "${RED}❌ Hay errores que necesitan atención${NC}\n"
    
    echo -e "${YELLOW}Recomendaciones:${NC}"
    echo "1. Revisar SecurityHeadersFilter.java en el backend"
    echo "2. Revisar next.config.mjs en el frontend"
    echo "3. Asegurar que X-Frame-Options: SAMEORIGIN está en todas las respuestas"
    echo "4. Asegurar que CSP frame-ancestors 'self' está en todas las respuestas"
    echo "5. Reiniciar aplicaciones después de cambios"
    echo ""
    exit 1
fi
