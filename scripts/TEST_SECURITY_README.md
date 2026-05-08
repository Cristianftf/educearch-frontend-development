# Script de Testing de Seguridad

Este script verifica que la configuración de CORS e IP Whitelist es correcta.

## Requisitos

- `bash` shell
- `curl` instalado
- Backend ejecutándose

## Uso

### Forma Básica

```bash
chmod +x scripts/test-security-config.sh
./scripts/test-security-config.sh
```

Esto usa valores por defecto:
- Perfil: `dev`
- Backend URL: `http://localhost:8080`

### Especificar Ambiente y URL

```bash
./scripts/test-security-config.sh dev http://localhost:8080
./scripts/test-security-config.sh prod https://api.uci.cu
```

### Con Token de Admin

Para verificar Swagger UI con autenticación:

```bash
export ADMIN_TOKEN="tu-token-jwt-aqui"
./scripts/test-security-config.sh dev http://localhost:8080
```

## Tests Ejecutados

### Test 1: ✅ Conectividad Backend
- Verifica que el backend responde
- Espera: 401 Unauthorized (sin token)

### Test 2: ✅ CORS - Localhost
- Verifica que localhost:3000 tiene acceso CORS
- Verifica header `Access-Control-Allow-Origin`

### Test 3: ✅ CORS - Origen Malicioso
- Verifica que orígenes no autorizados son rechazados
- Espera: Sin header CORS

### Test 4: ✅ Swagger UI Protegido
- Verifica que `/swagger-ui/**` requiere autenticación
- Espera: 401 o 403 Unauthorized

### Test 5: ✅ API Docs Protegido
- Verifica que `/v3/api-docs` requiere autenticación
- Espera: 401 o 403 Unauthorized

### Test 6: ✅ Endpoints Públicos
- Verifica que `/api/auth/login` es públicamente accesible
- Espera: 200, 400, o 401 (dependiendo de datos)

### Test 7: ✅ Security Headers
- Verifica que security headers están presentes
- Busca: X-Content-Type-Options, X-Frame-Options, CSP

### Test 8: ✅ Health Check Protegido
- Verifica que `/api/health` requiere autenticación
- Espera: 401 o 403 Unauthorized

## Interpretación de Resultados

### ✅ PASS - Todo bien
```
✅ PASS: Backend disponible
✅ PASS: CORS permite localhost
```

### ❌ FAIL - Algo está mal
```
❌ FAIL: Swagger UI protegido
  Expected: 401
  Got: 200
```

## Ejemplos de Ejecución

### Desarrollo Local

```bash
$ ./scripts/test-security-config.sh dev http://localhost:8080

[1/8] Verificando conectividad con Backend...
✅ PASS: Backend disponible

[2/8] Verificando CORS para localhost...
✅ PASS: CORS permite localhost

[3/8] Verificando rechazo de CORS para origen malicioso...
✅ PASS: CORS rechaza origen malicioso

[4/8] Verificando protección de Swagger UI...
✅ PASS: Swagger UI protegido (HTTP 403)

[5/8] Verificando protección de API Docs...
✅ PASS: API Docs protegido (HTTP 403)

[6/8] Verificando endpoints públicos...
✅ PASS: Endpoints públicos accesibles (HTTP 400)

[7/8] Verificando Security Headers...
✅ PASS: Security Headers configurados
  Encontrados:
    X-Content-Type-Options: nosniff
    X-Frame-Options: SAMEORIGIN
    Content-Security-Policy: default-src 'self'...

[8/8] Verificando protección de Health Check...
✅ PASS: Health Check protegido (HTTP 403)

========================================
Test Complete
========================================
```

### Producción

```bash
$ ADMIN_TOKEN="eyJhbGciOiJIUzI1NiIs..." \
  ./scripts/test-security-config.sh prod https://api.uci.cu

[1/8] Conectividad con Backend...
✅ PASS: Backend disponible

... (más tests)

Running authenticated tests...

[A] Swagger UI con token ADMIN...
✅ PASS: Swagger UI accesible con token ADMIN
```

## Troubleshooting

### Error: "curl: command not found"
```bash
# Instalar curl
# Ubuntu/Debian
sudo apt-get install curl

# CentOS/RHEL
sudo yum install curl

# macOS
brew install curl
```

### Error: "Connection refused"
```bash
# Verificar que backend está ejecutándose
curl http://localhost:8080/api/health

# Si no funciona, iniciar backend
# cd backend && ./mvnw spring-boot:run
```

### CORS test fallando en producción
```bash
# Verificar que el origen está permitido
# Revisar: docs/PRODUCTION_SECURITY_CONFIG.md
# Y: docs/CORS_AND_IP_WHITELIST_SECURITY.md

# Ejemplo: Si frontend es https://frontend.uci.cu
export ORIGIN="https://frontend.uci.cu"
curl -H "Origin: $ORIGIN" https://api.uci.cu/api/search
```

## Monitoreo Continuo

Para ejecutar tests periódicamente:

```bash
# Cada 5 minutos
*/5 * * * * cd /path/to/project && ./scripts/test-security-config.sh prod https://api.uci.cu >> logs/security-test.log 2>&1

# O usando systemd timer
# (Ver: docs/PRODUCTION_SECURITY_CONFIG.md)
```

## Logs

Por defecto, el script imprime a stdout. Para guardar resultados:

```bash
./scripts/test-security-config.sh dev http://localhost:8080 | tee logs/security-test-$(date +%Y%m%d-%H%M%S).log
```

## Integración CI/CD

### GitHub Actions

```yaml
name: Security Tests

on: [push, pull_request]

jobs:
  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start Backend
        run: cd backend && timeout 30 ./mvnw spring-boot:run &
      - name: Wait for Backend
        run: sleep 10
      - name: Run Security Tests
        run: chmod +x scripts/test-security-config.sh && ./scripts/test-security-config.sh dev http://localhost:8080
```

### GitLab CI

```yaml
security-tests:
  stage: test
  script:
    - cd backend && ./mvnw spring-boot:run &
    - sleep 10
    - chmod +x scripts/test-security-config.sh
    - ./scripts/test-security-config.sh dev http://localhost:8080
```

## Referencias

- [cURL Documentation](https://curl.se/docs/)
- [HTTP Status Codes](https://httpwg.org/specs/rfc7231.html#status.codes)
- [CORS Specification](https://fetch.spec.whatwg.org/#http-cors-protocol)
- [Security Headers](https://securityheaders.com/)
