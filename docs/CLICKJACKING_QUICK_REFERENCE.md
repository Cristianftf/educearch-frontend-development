# 🔐 Protección contra Clickjacking - Referencia Rápida

**Status**: ✅ Implementado en todas las respuestas HTTP

---

## 📋 Lo Que Se Implementó

### ✅ Frontend (Next.js)

**Archivo**: `next.config.mjs` - Líneas 26-44

```javascript
{
  key: 'X-Frame-Options',
  value: 'SAMEORIGIN',
},
{
  key: 'Content-Security-Policy',
  value: [
    "frame-ancestors 'self'",
    // ... otras directivas
  ].join('; '),
}
```

**Resultado**: Todas las páginas de Next.js envían:
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy: ... frame-ancestors 'self'; ...`

### ✅ Backend (Spring Boot)

**Archivo**: `SecurityHeadersFilter.java` - Líneas 24-26, 32-33

```java
httpResponse.setHeader("X-Frame-Options", "SAMEORIGIN");
httpResponse.setHeader("Content-Security-Policy",
    "... frame-ancestors 'self'; ...");
```

**Resultado**: Todas las respuestas HTTP del backend incluyen:
- `X-Frame-Options: SAMEORIGIN`
- `Content-Security-Policy: ... frame-ancestors 'self'; ...`

---

## 🎯 Qué Significa

### X-Frame-Options: SAMEORIGIN

```
Solo las páginas del mismo origen pueden enmarcar esta página
```

| Escenario | Resultado |
|-----------|-----------|
| `frontend.uci.cu` embebe `frontend.uci.cu` | ✅ Permitido |
| `malicious.com` embebe `frontend.uci.cu` | ❌ Bloqueado |
| `cdn.example.com` embebe `frontend.uci.cu` | ❌ Bloqueado |

### frame-ancestors 'self'

```
CSP modern - Solo el mismo origen en lista de ancestors permitidos
```

| Escenario | Resultado |
|-----------|-----------|
| `frontend.uci.cu` en `frontend.uci.cu` | ✅ Permitido |
| `frontend.uci.cu` en otro sitio | ❌ Bloqueado |

---

## ✅ Verificación Rápida

### Método 1: Curl (Terminal)

```bash
# Backend
curl -I http://localhost:8080/api/health | grep -E "X-Frame-Options|frame-ancestors"

# Frontend
curl -I http://localhost:3000/ | grep -E "X-Frame-Options|frame-ancestors"
```

**Esperado**:
```
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: ... frame-ancestors 'self'; ...
```

### Método 2: Script Automatizado

```bash
chmod +x scripts/validate-clickjacking-protection.sh
./scripts/validate-clickjacking-protection.sh dev http://localhost:8080 http://localhost:3000

# Reportará si todas las páginas tienen las cabeceras
```

### Método 3: DevTools del Navegador

1. Abre DevTools (F12)
2. Ve a Network
3. Haz una request (recarga la página)
4. Busca los headers en la respuesta:
   - `X-Frame-Options: SAMEORIGIN` ✅
   - `Content-Security-Policy: ... frame-ancestors 'self'` ✅

---

## 🚀 Cómo Funciona la Protección

```
Atacante intenta crear iframe malicioso:
┌─────────────────────────────────────────┐
│ malicious.com                           │
│ <iframe src="https://api.uci.cu/admin"> │
└─────────────────────────────────────────┘
              ↓
Navegador recibe respuesta del servidor:
  HTTP/1.1 200 OK
  X-Frame-Options: SAMEORIGIN
  Content-Security-Policy: frame-ancestors 'self'
              ↓
❌ ¡BLOQUEADO! El navegador rechaza el iframe
La página NO se carga dentro del iframe
```

---

## 📊 Headers Configurados en Todas las Respuestas

### Frontend + Backend

```
X-Frame-Options: SAMEORIGIN
├─ Previene clickjacking
├─ Estándar HTTP
└─ Soportado en todos los navegadores modernos

Content-Security-Policy: frame-ancestors 'self'
├─ Previene framing no autorizado
├─ Estándar W3C moderno
└─ Mejor control que X-Frame-Options

X-Content-Type-Options: nosniff
├─ Previene MIME-type sniffing
└─ Mitiga XSS indirectamente

X-XSS-Protection: 1; mode=block
├─ Protección XSS del navegador
└─ Complementario a CSP
```

---

## 🔍 Validar por Endpoint

### Frontend

```bash
# Homepage
curl -I http://localhost:3000/ | grep "X-Frame-Options"

# Login
curl -I http://localhost:3000/login | grep "X-Frame-Options"

# Cualquier otra página
curl -I http://localhost:3000/student/dashboard | grep "X-Frame-Options"
```

### Backend

```bash
# Endpoints públicos
curl -I http://localhost:8080/api/auth/login | grep "X-Frame-Options"
curl -I http://localhost:8080/api/auth/register | grep "X-Frame-Options"

# Endpoints admin
curl -I http://localhost:8080/swagger-ui/index.html | grep "X-Frame-Options"
curl -I http://localhost:8080/api/health | grep "X-Frame-Options"

# Endpoints autenticados
curl -I -H "Authorization: Bearer $TOKEN" \
  http://localhost:8080/api/student/dashboard | grep "X-Frame-Options"
```

---

## ⚙️ Si Necesitas Modificar

### Cambiar de SAMEORIGIN a DENY (máxima protección)

**Backend**: `SecurityHeadersFilter.java`
```java
// Cambiar esto
httpResponse.setHeader("X-Frame-Options", "SAMEORIGIN");

// A esto
httpResponse.setHeader("X-Frame-Options", "DENY");
```

**Frontend**: `next.config.mjs`
```javascript
// Cambiar esto
value: 'SAMEORIGIN',

// A esto
value: 'DENY',
```

### Permitir framing desde dominio específico (uso avanzado)

**Backend**:
```java
// Usar ALLOW-FROM (deprecated pero aún funciona)
httpResponse.setHeader("X-Frame-Options", "ALLOW-FROM https://partner.example.com");

// O mejor, usar CSP
httpResponse.setHeader("Content-Security-Policy",
    "frame-ancestors 'self' https://partner.example.com");
```

---

## 🛡️ Protegido Contra

✅ **Clickjacking** - Imposible enmarcar en otro sitio  
✅ **UI Redressing** - No se puede ocultar el frame  
✅ **Session Hijacking mediante frames** - El iframe no funciona  
✅ **CSRF mediante frames** - Headers de origen se validan  

---

## 📚 Documentación Completa

Para más detalles, ver: [docs/CLICKJACKING_PROTECTION.md](../docs/CLICKJACKING_PROTECTION.md)

---

## 🚀 Testing Automatizado

```bash
# Ejecutar validación completa
./scripts/validate-clickjacking-protection.sh dev http://localhost:8080 http://localhost:3000

# Resultado esperado
✅ Pasadas: 24
❌ Fallidas: 0
⚠️  Advertencias: 0

Tasa de éxito: 100%
🎉 ¡Todas las validaciones pasaron!
✅ Protección contra clickjacking: IMPLEMENTADA
```

---

## 📞 Troubleshooting Rápido

### "X-Frame-Options no aparece"

```bash
# 1. Verifica que el filtro está registrado
grep -r "SecurityHeadersFilter" backend/src/main/java/com/uci/competencia/config/

# 2. Reinicia la aplicación
systemctl restart backend

# 3. Verifica manualmente
curl -I http://localhost:8080/ | grep -i "x-frame-options"
```

### "Recibir error 'Refused to frame' en browser"

```javascript
// ✅ Esto es lo esperado - significa que la protección funciona
// El frame fue bloqueado por el navegador

// El atacante vería algo como:
// Uncaught SecurityError: Blocked a frame with origin from accessing a cross-origin frame.
```

### "Necesito que iframe funcione para caso legítimo"

```java
// En SecurityHeadersFilter.java, puedes hacer conditioning:
if (requestPath.startsWith("/api/embed")) {
    httpResponse.setHeader("X-Frame-Options", "ALLOW-FROM https://trusted-site.com");
} else {
    httpResponse.setHeader("X-Frame-Options", "SAMEORIGIN");
}
```

---

## 📊 Resumen Estado

| Aspecto | Status | Evidencia |
|---------|--------|----------|
| X-Frame-Options en backend | ✅ | SecurityHeadersFilter.java:32 |
| X-Frame-Options en frontend | ✅ | next.config.mjs:36 |
| CSP frame-ancestors en backend | ✅ | SecurityHeadersFilter.java:25 |
| CSP frame-ancestors en frontend | ✅ | next.config.mjs:27 |
| Validación automatizada | ✅ | validate-clickjacking-protection.sh |
| Documentación | ✅ | CLICKJACKING_PROTECTION.md |

**Conclusión**: ✅ 100% Implementado

---

**Última actualización**: 6 de mayo de 2026  
**Versión**: 1.0  
**Estado**: ✅ PRODUCTIVO
