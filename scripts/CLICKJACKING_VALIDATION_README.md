# 🎯 Script de Validación - Protección contra Clickjacking

Script bash para validar que todas las respuestas HTTP incluyen las cabeceras de protección contra clickjacking en frontend y backend.

---

## 📋 Requisitos

- `bash` shell
- `curl` instalado
- Servidor(es) ejecutándose

---

## 🚀 Uso

### Forma Básica

```bash
chmod +x scripts/validate-clickjacking-protection.sh
./scripts/validate-clickjacking-protection.sh
```

Usa valores por defecto:
- Ambiente: `dev`
- Backend: `http://localhost:8080`
- Frontend: `http://localhost:3000`

### Con Parámetros Personalizados

```bash
# Frontend y backend local
./scripts/validate-clickjacking-protection.sh dev \
  http://localhost:8080 \
  http://localhost:3000

# Producción
./scripts/validate-clickjacking-protection.sh prod \
  https://api.uci.cu \
  https://frontend.uci.cu

# Solo backend (sin validar frontend)
./scripts/validate-clickjacking-protection.sh dev \
  http://localhost:8080 \
  disabled
```

---

## ✅ Tests Ejecutados

### Backend (Spring Boot)

#### Endpoints Públicos
- ✅ `POST /api/auth/login`
- ✅ `POST /api/auth/register`
- ✅ `POST /api/auth/refresh-token`
- ✅ `GET /error`

#### Endpoints Admin (Sensibles)
- ✅ `GET /swagger-ui/index.html`
- ✅ `GET /v3/api-docs`
- ✅ `GET /api/health`
- ✅ `GET /actuator`

### Frontend (Next.js)

#### Páginas
- ✅ `/ (homepage)`
- ✅ `/login`
- ✅ `/register`
- ✅ `/_next/image (assets)`

---

## 📊 Validaciones

Para cada endpoint se verifica:

### 1. X-Frame-Options Header

```
X-Frame-Options: SAMEORIGIN
```

✅ **PASS**: Header presente con valor correcto  
⚠️ **WARN**: Header presente pero valor inesperado  
❌ **FAIL**: Header no presente

### 2. Content-Security-Policy - frame-ancestors

```
Content-Security-Policy: ... frame-ancestors 'self'; ...
```

✅ **PASS**: Directiva `frame-ancestors` presente  
❌ **FAIL**: Directiva `frame-ancestors` no presente

---

## 📈 Interpretación de Resultados

### ✅ Todo Verde - Éxito Completo

```
✅ Pasadas: 24
❌ Fallidas: 0
⚠️  Advertencias: 0

Tasa de éxito: 100%

🎉 ¡Todas las validaciones pasaron!
✅ Protección contra clickjacking: IMPLEMENTADA
```

**Significa**: Todas las respuestas tienen las cabeceras correctamente configuradas.

### ⚠️ Algunos Avisos

```
✅ Pasadas: 20
❌ Fallidas: 0
⚠️  Advertencias: 4

Tasa de éxito: 83%
```

**Significa**: Algunos headers están presentes pero con valores inesperados. Revisar.

### ❌ Errores Encontrados

```
✅ Pasadas: 16
❌ Fallidas: 8
⚠️  Advertencias: 0

Tasa de éxito: 67%
```

**Significa**: Hay endpoints sin las cabeceras requeridas. Acción inmediata.

---

## 🔍 Ejemplos de Ejecución

### Desarrollo Local

```bash
$ ./scripts/validate-clickjacking-protection.sh dev \
  http://localhost:8080 \
  http://localhost:3000

========================================
Clickjacking Protection Validation
Environment: dev
Backend: http://localhost:8080
Frontend: http://localhost:3000
========================================

──────────────────────────────────────
Grupo: Endpoints Públicos
──────────────────────────────────────

/api/auth/login
  ✅ X-Frame-Options: SAMEORIGIN
  ✅ CSP frame-ancestors configured

/api/auth/register
  ✅ X-Frame-Options: SAMEORIGIN
  ✅ CSP frame-ancestors configured

... (más endpoints)

════════════════════════════════════
Resumen de Validación
════════════════════════════════════

Total de validaciones:
  ✅ Pasadas: 24
  ❌ Fallidas: 0
  ⚠️  Advertencias: 0

Tasa de éxito: 100%

Verificaciones Clave:

¿X-Frame-Options: SAMEORIGIN en todas las respuestas? ✅
¿CSP frame-ancestors 'self' en todas las respuestas? ✅

🎉 ¡Todas las validaciones pasaron!
✅ Protección contra clickjacking: IMPLEMENTADA
```

### Producción

```bash
$ ./scripts/validate-clickjacking-protection.sh prod \
  https://api.uci.cu \
  https://frontend.uci.cu

# Mismo formato, pero con URLs de producción
# Verificará que ambos entornos tienen protección contra clickjacking
```

---

## 🛠️ Troubleshooting

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
# Verificar que servidores están ejecutándose
curl http://localhost:8080/api/health
curl http://localhost:3000/

# Si backend no responde:
cd backend && ./mvnw spring-boot:run

# Si frontend no responde:
cd app && npm run dev
```

### X-Frame-Options missing en algunos endpoints

```bash
# Verificar manualmente
curl -I http://localhost:8080/api/auth/login | grep -i "x-frame-options"

# Debería mostrar:
# X-Frame-Options: SAMEORIGIN

# Si no aparece, revisar:
# 1. SecurityHeadersFilter.java - está registrado?
# 2. ¿Hay algún filtro que lo sobrescribe?
# 3. ¿Headers se están compilando correctamente?
```

### CSP frame-ancestors missing

```bash
# Verificar configuración CSP
curl -I http://localhost:8080/api/health | grep -i "content-security-policy"

# Debe incluir "frame-ancestors 'self'"

# Si no aparece:
# 1. Revisar SecurityHeadersFilter.java
# 2. Revisar next.config.mjs
# 3. Reiniciar aplicaciones
```

### Frontend no responde

```bash
# Si Frontend está deshabilitado propositalmente
./scripts/validate-clickjacking-protection.sh dev \
  http://localhost:8080 \
  disabled

# Validará solo el backend
```

---

## 🔐 Verificación Manual (sin script)

### Backend

```bash
# Verificar X-Frame-Options
curl -I http://localhost:8080/api/health | grep "X-Frame-Options"

# Verificar CSP
curl -I http://localhost:8080/api/health | grep "Content-Security-Policy"

# Verificar ambos
curl -I http://localhost:8080/api/health | grep -E "X-Frame-Options|Content-Security-Policy"
```

### Frontend

```bash
# Con CURL
curl -I http://localhost:3000/ | grep -E "X-Frame-Options|Content-Security-Policy"

# En navegador (DevTools)
# F12 → Network → Hacer request → Response Headers
```

---

## 📊 Integración CI/CD

### GitHub Actions

```yaml
name: Clickjacking Protection Tests

on: [push, pull_request]

jobs:
  clickjacking-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Start Backend
        run: cd backend && timeout 30 ./mvnw spring-boot:run &
      - name: Wait for Backend
        run: sleep 10
      - name: Validate Clickjacking Protection
        run: chmod +x scripts/validate-clickjacking-protection.sh && \
             ./scripts/validate-clickjacking-protection.sh dev http://localhost:8080 disabled
```

### GitLab CI

```yaml
validate-clickjacking:
  stage: security
  script:
    - cd backend && ./mvnw spring-boot:run &
    - sleep 10
    - chmod +x scripts/validate-clickjacking-protection.sh
    - ./scripts/validate-clickjacking-protection.sh dev http://localhost:8080 disabled
  after_script:
    - pkill -f spring-boot:run
```

---

## 📝 Matriz de Headers Esperados

| Endpoint | X-Frame-Options | frame-ancestors | Versión Min |
|----------|-------------|-----------------|------------|
| `/api/auth/**` | SAMEORIGIN | 'self' | HTTP/1.1 |
| `/api/search/**` | SAMEORIGIN | 'self' | HTTP/1.1 |
| `/api/admin/**` | SAMEORIGIN | 'self' | HTTP/1.1 |
| `/swagger-ui/**` | SAMEORIGIN | 'self' | HTTP/1.1 |
| `/api/health` | SAMEORIGIN | 'self' | HTTP/1.1 |
| Frontend `/` | SAMEORIGIN | 'self' | HTTP/1.1 |

---

## 🎯 Recomendaciones

### Ejecución Regular

```bash
# Cada vez que desplegues
./scripts/validate-clickjacking-protection.sh prod https://api.uci.cu https://frontend.uci.cu

# En cron para monitoreo continuo
0 * * * * cd /home/deploy/app && ./scripts/validate-clickjacking-protection.sh prod https://api.uci.cu >> logs/clickjacking-test.log 2>&1
```

### Automatización

```bash
# En pre-commit hook
# .git/hooks/pre-commit
#!/bin/bash
./scripts/validate-clickjacking-protection.sh dev http://localhost:8080 http://localhost:3000 || exit 1
```

### Alertas

```bash
# Si falla, alertar
if ! ./scripts/validate-clickjacking-protection.sh prod https://api.uci.cu; then
  echo "❌ Clickjacking protection validation failed!" | mail -s "ALERT" ops@uci.cu
  exit 1
fi
```

---

## 📞 Referencias

- [MDN: X-Frame-Options](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/X-Frame-Options)
- [MDN: frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Content-Security-Policy/frame-ancestors)
- [OWASP: Clickjacking](https://owasp.org/www-community/attacks/Clickjacking)
- [W3C: CSP](https://w3c.github.io/webappsec-csp/)

---

## ✅ Checklist

- [ ] Script tiene permisos de ejecución (`chmod +x`)
- [ ] Backend está ejecutándose en puerto correcto
- [ ] Frontend está ejecutándose (opcional)
- [ ] curl está instalado
- [ ] Script se ejecuta sin errores
- [ ] Todos los tests pasan
- [ ] Se incluye en CI/CD pipeline
- [ ] Se ejecuta regularmente en monitoreo

---

**Última actualización**: 6 de mayo de 2026  
**Versión**: 1.0  
**Mantenido por**: Equipo de Seguridad
