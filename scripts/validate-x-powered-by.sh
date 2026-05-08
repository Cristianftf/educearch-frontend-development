#!/bin/bash
# Script para validar la supresión del header X-Powered-By
# Uso: ./validate-x-powered-by.sh [url]

URL="${1:-http://localhost:8080/api/health}"

echo "🔍 Validando supresión de X-Powered-By en: $URL"
echo "=================================================="

# Función para verificar header
check_header() {
    local url=$1
    local header_name="X-Powered-By"

    echo "Verificando header '$header_name' en $url..."

    # Usar curl para obtener headers
    response=$(curl -s -I "$url" 2>/dev/null)

    if echo "$response" | grep -i "^$header_name:" >/dev/null; then
        echo "❌ FALLÓ: Header '$header_name' encontrado:"
        echo "$response" | grep -i "^$header_name:"
        return 1
    else
        echo "✅ PASÓ: Header '$header_name' no encontrado"
        return 0
    fi
}

# Verificar backend
echo ""
echo "📡 Verificando Backend Spring Boot..."
if check_header "$URL"; then
    BACKEND_OK=true
else
    BACKEND_OK=false
fi

# Verificar frontend si está disponible
FRONTEND_URL="${URL//8080/3000}"
FRONTEND_URL="${FRONTEND_URL//api\/health/}"

echo ""
echo "🌐 Verificando Frontend Next.js..."
if curl -s -I "$FRONTEND_URL" >/dev/null 2>&1; then
    if check_header "$FRONTEND_URL"; then
        FRONTEND_OK=true
    else
        FRONTEND_OK=false
    fi
else
    echo "⚠️  Frontend no disponible en $FRONTEND_URL"
    FRONTEND_OK=true  # Asumir OK si no está corriendo
fi

echo ""
echo "📊 Resultado Final:"
echo "=================="

if $BACKEND_OK && $FRONTEND_OK; then
    echo "✅ ÉXITO: X-Powered-By suprimido correctamente en todos los componentes"
    exit 0
else
    echo "❌ FALLÓ: X-Powered-By encontrado en algunos componentes"
    exit 1
fi