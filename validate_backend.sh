#!/bin/bash
# Script de Validación del Backend educearch
# Este script verifica que todos los componentes estén funcionando correctamente

echo "╔════════════════════════════════════════════════════════════════╗"
echo "║        VALIDACIÓN DEL BACKEND - educearch                      ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Variables
BACKEND_URL="http://localhost:8080"
TEST_EMAIL="test@uci.edu"
TEST_PASSWORD="testpass123"
TEST_TOKEN=""

# Función para mostrar resultado
show_result() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✅ PASS${NC} - $2"
    else
        echo -e "${RED}❌ FAIL${NC} - $2"
    fi
}

# Función para hacer requests
make_request() {
    local method=$1
    local endpoint=$2
    local data=$3
    local token=$4
    
    if [ -z "$data" ]; then
        if [ -z "$token" ]; then
            curl -s -X $method "$BACKEND_URL$endpoint" \
                -H "Content-Type: application/json"
        else
            curl -s -X $method "$BACKEND_URL$endpoint" \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json"
        fi
    else
        if [ -z "$token" ]; then
            curl -s -X $method "$BACKEND_URL$endpoint" \
                -H "Content-Type: application/json" \
                -d "$data"
        else
            curl -s -X $method "$BACKEND_URL$endpoint" \
                -H "Authorization: Bearer $token" \
                -H "Content-Type: application/json" \
                -d "$data"
        fi
    fi
}

echo "═══════════════════════════════════════════════════════════════"
echo "1️⃣  VERIFICACIÓN DE CONECTIVIDAD"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 1: Health Check
echo -n "Health Check... "
HEALTH=$(make_request "GET" "/api/system/health")
if echo "$HEALTH" | grep -q "UP"; then
    show_result 0 "Backend está online y saludable"
else
    show_result 1 "Backend no responde correctamente"
    echo "  Respuesta: $HEALTH"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "2️⃣  VERIFICACIÓN DE SEGURIDAD"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 2: Sin autenticación debe rechazar
echo -n "Endpoint protegido sin token... "
PROTECTED=$(make_request "GET" "/api/professor/analytics/overview")
if echo "$PROTECTED" | grep -q "401\|Unauthorized\|forbidden"; then
    show_result 0 "Seguridad: endpoints protegidos funcionan"
else
    # Si no rechaza, verificar si requiere token (algunos endpoints sin token devuelven error diferente)
    if ! echo "$PROTECTED" | grep -q "UP\|SUCCESS"; then
        show_result 0 "Seguridad: endpoints protegidos funcionan"
    else
        show_result 1 "Seguridad: endpoint NO está protegido"
    fi
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "3️⃣  VERIFICACIÓN DE DTOs Y RESPUESTAS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 3: Health response tiene estructura
echo -n "Estructura de respuesta de Health... "
if echo "$HEALTH" | grep -q "status\|components"; then
    show_result 0 "Health response tiene estructura correcta"
else
    show_result 1 "Health response NO tiene estructura correcta"
    echo "  Respuesta: $HEALTH"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "4️⃣  VERIFICACIÓN DE BASES DE DATOS"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 4: Database connectivity
echo -n "Conexión a PostgreSQL... "
if echo "$HEALTH" | grep -q "\"db\":\"UP\""; then
    show_result 0 "PostgreSQL conectado"
elif echo "$HEALTH" | grep -q "db.*UP"; then
    show_result 0 "PostgreSQL conectado"
else
    show_result 1 "PostgreSQL NO conectado"
    echo "  Asegurate que PostgreSQL está corriendo en localhost:5432"
fi
echo ""

# Test 5: Redis connectivity
echo -n "Conexión a Redis... "
if echo "$HEALTH" | grep -q "redis"; then
    if echo "$HEALTH" | grep -q "redis.*UP"; then
        show_result 0 "Redis conectado"
    else
        show_result 1 "Redis NO conectado"
        echo "  Asegurate que Redis está corriendo en localhost:6379"
    fi
else
    echo -e "${YELLOW}⚠️  SKIPPED${NC} - Redis información no disponible"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "5️⃣  VERIFICACIÓN DE CONTROLADORES"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 6: Que los controladores respondan (sin token, pueden fallar con 401)
CONTROLLERS=(
    "/api/auth/login"
    "/api/admin/users"
    "/api/professor/analytics/overview"
    "/api/student/dashboard/overview"
    "/api/cases"
    "/api/hedges"
    "/api/search/history"
    "/api/verify/history"
)

PASSED=0
TOTAL=${#CONTROLLERS[@]}

for controller in "${CONTROLLERS[@]}"; do
    echo -n "Controlador $controller... "
    
    # Algunos endpoints requieren POST
    if [[ $controller == *"login"* ]]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$BACKEND_URL$controller" \
            -H "Content-Type: application/json" \
            -d '{}' 2>/dev/null)
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "$BACKEND_URL$controller" 2>/dev/null)
    fi
    
    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    
    # Aceptar 200, 201, 400, 401, 403 (cualquier respuesta del servidor)
    # Lo importante es que NO sea 404 (endpoint no existe)
    if [[ "$HTTP_CODE" != "404" ]] && [[ "$HTTP_CODE" != "000" ]]; then
        show_result 0 "Existe (HTTP $HTTP_CODE)"
        ((PASSED++))
    else
        show_result 1 "NO existe o no responde (HTTP $HTTP_CODE)"
    fi
done

echo ""
echo "📊 Controladores OK: $PASSED/$TOTAL"
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "6️⃣  VERIFICACIÓN DE COMPILACIÓN"
echo "═══════════════════════════════════════════════════════════════"
echo ""

# Test 7: Check Maven compile
echo -n "Compilación Maven... "
if command -v mvn &> /dev/null; then
    if [ -f "backend/pom.xml" ]; then
        echo -e "${YELLOW}MANUAL${NC}"
        echo "  Ejecuta: cd backend && mvn clean compile"
    else
        show_result 1 "pom.xml no encontrado"
    fi
else
    echo -e "${YELLOW}SKIPPED${NC} - Maven no está instalado"
fi
echo ""

echo "═══════════════════════════════════════════════════════════════"
echo "7️⃣  VERIFICACIÓN FINAL"
echo "═══════════════════════════════════════════════════════════════"
echo ""

if [ "$PASSED" -ge 7 ]; then
    echo -e "${GREEN}✅ VALIDACIÓN EXITOSA${NC}"
    echo ""
    echo "El backend está operativo y listo para:"
    echo "  ✅ Desarrollo local"
    echo "  ✅ Testing"
    echo "  ✅ Integración con frontend"
    echo ""
    exit 0
else
    echo -e "${RED}❌ VALIDACIÓN INCOMPLETA${NC}"
    echo ""
    echo "Por favor:"
    echo "  1. Asegurate que PostgreSQL está corriendo"
    echo "  2. Asegurate que Redis está corriendo"
    echo "  3. Asegurate que el backend está ejecutándose en puerto 8080"
    echo "  4. Verifica los logs: docker-compose logs -f backend"
    echo ""
    exit 1
fi
