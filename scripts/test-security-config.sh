#!/bin/bash

###############################################################################
# Script para verificar configuración de seguridad CORS e IP Whitelist
# Uso: ./test-security-config.sh [dev|prod] [backend-url]
# Ejemplo: ./test-security-config.sh dev http://localhost:8080
###############################################################################

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuración por defecto
PROFILE=${1:-dev}
BACKEND_URL=${2:-http://localhost:8080}
ADMIN_TOKEN=${ADMIN_TOKEN:-}

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Security Configuration Test${NC}"
echo -e "${BLUE}Environment: $PROFILE${NC}"
echo -e "${BLUE}Backend URL: $BACKEND_URL${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Función para imprimir resultados
print_test() {
    local test_name=$1
    local result=$2
    local expected=$3
    
    if [[ "$result" == "$expected" ]]; then
        echo -e "${GREEN}✅ PASS${NC}: $test_name"
    else
        echo -e "${RED}❌ FAIL${NC}: $test_name"
        echo -e "  Expected: $expected"
        echo -e "  Got: $result"
    fi
    echo
}

# Test 1: Backend está disponible
echo -e "${YELLOW}[1/8] Verificando conectividad con Backend...${NC}"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" || echo "000")
print_test "Backend disponible" "$HTTP_CODE" "401"  # 401 porque no tiene token

# Test 2: CORS - Verificar header con origen localhost
echo -e "${YELLOW}[2/8] Verificando CORS para localhost...${NC}"
CORS_RESPONSE=$(curl -s -i -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: GET" \
  "$BACKEND_URL/api/search" 2>/dev/null | grep -i "access-control-allow-origin" || echo "NO_CORS_HEADER")
if [[ "$CORS_RESPONSE" == *"localhost:3000"* ]] || [[ "$CORS_RESPONSE" == *"localhost"* ]]; then
    echo -e "${GREEN}✅ PASS${NC}: CORS permite localhost"
else
    echo -e "${RED}❌ FAIL${NC}: CORS no permite localhost"
    echo -e "  Response: $CORS_RESPONSE"
fi
echo

# Test 3: CORS - Verificar rechazo de origen no autorizado
echo -e "${YELLOW}[3/8] Verificando rechazo de CORS para origen malicioso...${NC}"
CORS_MALICIOUS=$(curl -s -i -H "Origin: https://malicious.com" \
  "$BACKEND_URL/api/search" 2>/dev/null | grep -i "access-control-allow-origin" || echo "REJECTED")
if [[ "$CORS_MALICIOUS" == "REJECTED" ]] || [[ -z "$CORS_MALICIOUS" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: CORS rechaza origen malicioso"
else
    echo -e "${RED}❌ FAIL${NC}: CORS permite origen malicioso"
    echo -e "  Response: $CORS_MALICIOUS"
fi
echo

# Test 4: Swagger UI - Debe requerir autenticación
echo -e "${YELLOW}[4/8] Verificando protección de Swagger UI...${NC}"
SWAGGER_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/swagger-ui/index.html" || echo "000")
if [[ "$SWAGGER_CODE" == "401" ]] || [[ "$SWAGGER_CODE" == "403" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Swagger UI protegido (HTTP $SWAGGER_CODE)"
else
    echo -e "${RED}❌ FAIL${NC}: Swagger UI debería estar protegido"
    echo -e "  Got HTTP $SWAGGER_CODE (esperado 401 o 403)"
fi
echo

# Test 5: API Docs - Debe requerir autenticación
echo -e "${YELLOW}[5/8] Verificando protección de API Docs...${NC}"
APIDOCS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/v3/api-docs" || echo "000")
if [[ "$APIDOCS_CODE" == "401" ]] || [[ "$APIDOCS_CODE" == "403" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: API Docs protegido (HTTP $APIDOCS_CODE)"
else
    echo -e "${RED}❌ FAIL${NC}: API Docs debería estar protegido"
    echo -e "  Got HTTP $APIDOCS_CODE (esperado 401 o 403)"
fi
echo

# Test 6: Endpoints públicos deben estar disponibles
echo -e "${YELLOW}[6/8] Verificando endpoints públicos...${NC}"
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"test"}' \
  "$BACKEND_URL/api/auth/login" || echo "000")
if [[ "$AUTH_CODE" == "400" ]] || [[ "$AUTH_CODE" == "401" ]] || [[ "$AUTH_CODE" == "200" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Endpoints públicos accesibles (HTTP $AUTH_CODE)"
else
    echo -e "${RED}❌ FAIL${NC}: Endpoints públicos no accesibles"
    echo -e "  Got HTTP $AUTH_CODE"
fi
echo

# Test 7: Security Headers
echo -e "${YELLOW}[7/8] Verificando Security Headers...${NC}"
SECURITY_HEADERS=$(curl -s -i "$BACKEND_URL/api/auth/login" 2>/dev/null | grep -E "X-Content-Type-Options|X-Frame-Options|Content-Security-Policy" || echo "NO_HEADERS")
if [[ "$SECURITY_HEADERS" != "NO_HEADERS" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Security Headers configurados"
    echo -e "  Encontrados:"
    echo "$SECURITY_HEADERS" | sed 's/^/    /'
else
    echo -e "${RED}❌ FAIL${NC}: Security Headers no configurados"
fi
echo

# Test 8: Health Check - Debe requerir autenticación
echo -e "${YELLOW}[8/8] Verificando protección de Health Check...${NC}"
HEALTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$BACKEND_URL/api/health" || echo "000")
if [[ "$HEALTH_CODE" == "401" ]] || [[ "$HEALTH_CODE" == "403" ]]; then
    echo -e "${GREEN}✅ PASS${NC}: Health Check protegido (HTTP $HEALTH_CODE)"
else
    echo -e "${RED}❌ FAIL${NC}: Health Check debería estar protegido"
    echo -e "  Got HTTP $HEALTH_CODE (esperado 401 o 403)"
fi
echo

# Resumen
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Test Complete${NC}"
echo -e "${BLUE}========================================${NC}\n"

# Si hay token ADMIN, hacer tests adicionales
if [[ -n "$ADMIN_TOKEN" ]]; then
    echo -e "${BLUE}Running authenticated tests...${NC}\n"
    
    # Test A: Swagger UI con autenticación
    echo -e "${YELLOW}[A] Swagger UI con token ADMIN...${NC}"
    SWAGGER_AUTH=$(curl -s -o /dev/null -w "%{http_code}" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      "$BACKEND_URL/swagger-ui/index.html" || echo "000")
    if [[ "$SWAGGER_AUTH" == "200" ]]; then
        echo -e "${GREEN}✅ PASS${NC}: Swagger UI accesible con token ADMIN"
    else
        echo -e "${RED}❌ FAIL${NC}: Swagger UI no accesible con token ADMIN (HTTP $SWAGGER_AUTH)"
    fi
    echo
fi

echo -e "${BLUE}Recomendaciones:${NC}"
echo "1. En PRODUCCIÓN, cambiar URL a dominio real (https://api.uci.cu)"
echo "2. Configurar SSL/TLS si no está habilitado"
echo "3. Revisar aplicación.properties para valores de CORS"
echo "4. Actualizar IP whitelist con IPs reales de administración"
echo "5. Ejecutar regularmente para monitorear cambios"
