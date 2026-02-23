# UCI Competencia Informacional - Backend Spring Boot

## ðŸ“š DescripciÃ³n General

Backend de la Plataforma de Competencia Informacional para la Universidad de Ciencias InformÃ¡ticas (UCI), basado en Spring Boot 4.0.2 con Java 21.

Esta es una API REST completa que soporta:
- AutenticaciÃ³n y autorizaciÃ³n basada en roles
- BÃºsqueda de artÃ­culos cientÃ­ficos en PubMed
- VerificaciÃ³n de claims usando Retrieval Augmented Generation (RAG)
- GestiÃ³n de casos de estudio y evaluaciones
- Seguimiento de progreso en competencias informacionales
- AuditorÃ­a completa del sistema

## ðŸ—ï¸ Estructura del Proyecto

```
backend/
â”œâ”€â”€ src/
â”‚   â”œâ”€â”€ main/
â”‚   â”‚   â”œâ”€â”€ java/com/uci/competencia/
â”‚   â”‚   â”‚   â”œâ”€â”€ CompetenciaInformacionalApplication.java
â”‚   â”‚   â”‚   â”œâ”€â”€ config/           # Configuraciones
â”‚   â”‚   â”‚   â”œâ”€â”€ controller/api/   # Controladores REST
â”‚   â”‚   â”‚   â”œâ”€â”€ service/          # Servicios de negocio
â”‚   â”‚   â”‚   â”œâ”€â”€ repository/       # Repositorios JPA
â”‚   â”‚   â”‚   â”œâ”€â”€ model/            # Entidades y DTOs
â”‚   â”‚   â”‚   â”œâ”€â”€ security/         # JWT y seguridad
â”‚   â”‚   â”‚   â”œâ”€â”€ exception/        # Manejo de excepciones
â”‚   â”‚   â”‚   â”œâ”€â”€ aspect/           # Aspectos AOP
â”‚   â”‚   â”‚   â”œâ”€â”€ scheduler/        # Tareas programadas
â”‚   â”‚   â”‚   â””â”€â”€ util/             # Utilidades
â”‚   â”‚   â””â”€â”€ resources/
â”‚   â”‚       â”œâ”€â”€ application.yml
â”‚   â”‚       â””â”€â”€ db/migration/    # Flyway migrations
â”‚   â””â”€â”€ test/                     # Tests unitarios e integraciÃ³n
â”œâ”€â”€ pom.xml                        # Dependencias Maven
â””â”€â”€ README.md                      # Este archivo
```

## ðŸš€ Requisitos Previos

- **Java 21** LTS
- **Maven 3.8.0+**
- **PostgreSQL 13+**
- **Redis 7.0+**
- **Docker** (opcional, para desarrollo con containers)

## ðŸ“¦ InstalaciÃ³n

### 1. Clonar el repositorio

```bash
git clone <repository-url>
cd educearch-frontend-development/backend
```

### 2. Variables de Entorno

Crear archivo `.env` en la raÃ­z del proyecto:

```bash
# Base de Datos
DB_HOST=localhost
DB_PORT=5432
DB_NAME=uci_competencia
DB_USER=postgres
DB_PASSWORD=postgres

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=mySecretKeyThatIsAtLeast32CharactersLongForSigningTokens
JWT_EXPIRATION=86400000
JWT_REFRESH_EXPIRATION=604800000

# PubMed API
PUBMED_API_KEY=<your-api-key>

# LLM API (OpenAI-compatible)
# Opcion gratuita recomendada: Groq
LLM_BASE_URL=https://api.groq.com/openai/v1
GROQ_API_KEY=<your-groq-api-key>
GROQ_MODEL=llama-3.3-70b-versatile

# Google AI Studio (Gemini)
AI_PROVIDER=auto
GOOGLE_AI_API_KEY=<your-google-ai-studio-key>
GOOGLE_AI_MODEL=gemini-2.5-flash

# Fallback local sin costo (Ollama)
LOCAL_LLM_FALLBACK_ENABLED=true
LOCAL_LLM_BASE_URL=http://localhost:11434/v1
LOCAL_LLM_MODEL=llama3.2:3b

# Servidor
SERVER_PORT=8080

# LDAP (opcional)
LDAP_ENABLED=false
LDAP_URL=ldap://ldap.uci.cu:389
LDAP_BASE_DN=dc=uci,dc=cu
```

### 3. Compilar el Proyecto

```bash
mvn clean install
```

### 4. Ejecutar la AplicaciÃ³n

```bash
mvn spring-boot:run
```

O usando Java directamente:

```bash
java -jar target/backend-1.0.0.jar
```

### IA en tiempo real (obligatorio para asistente conectado)

Opcion A (API externa gratuita - Groq):

```bash
set GROQ_API_KEY=tu_key_aqui
set LLM_BASE_URL=https://api.groq.com/openai/v1
set GROQ_MODEL=llama-3.3-70b-versatile
```

Opcion B (modelo local sin key - Ollama):

```bash
ollama pull llama3.2:3b
ollama serve
set LOCAL_LLM_FALLBACK_ENABLED=true
set LOCAL_LLM_BASE_URL=http://localhost:11434/v1
set LOCAL_LLM_MODEL=llama3.2:3b
```

Opcion C (Google AI Studio - Gemini):

```bash
set AI_PROVIDER=gemini
set GOOGLE_AI_API_KEY=tu_key_aqui
set GOOGLE_AI_MODEL=gemini-2.5-flash
```

Si no hay key externa y Ollama no estÃ¡ corriendo, el asistente entra en modo respaldo.

## ðŸ—„ï¸ Base de Datos

El proyecto usa **Flyway** para migraciones automÃ¡ticas de base de datos.

### Crear base de datos PostgreSQL

```bash
createdb uci_competencia -U postgres
```

Las migraciones se ejecutarÃ¡n automÃ¡ticamente al iniciar la aplicaciÃ³n:
- `V1.0__Initial_Schema.sql` - Schema inicial con todas las tablas

## ðŸ”‘ AutenticaciÃ³n

### Login

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"user@uci.cu","password":"Password123!"}'
```

**Respuesta:**
```json
{
  "token": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
  "refreshToken": "eyJhbGciOiJIUzUxMiIsInR5cCI6IkpXVCJ9...",
  "userId": "uuid",
  "username": "user@uci.cu",
  "firstName": "John",
  "lastName": "Doe",
  "role": "STUDENT"
}
```

### Usar Token en Requests

```bash
curl -X GET http://localhost:8080/api/student/dashboard/overview \
  -H "Authorization: Bearer <token>"
```

## ðŸ“¡ Endpoints Principales

### AutenticaciÃ³n (`/api/auth`)
- `POST /login` - Iniciar sesiÃ³n
- `POST /refresh` - Refrescar token
- `POST /logout` - Cerrar sesiÃ³n
- `GET /me` - InformaciÃ³n del usuario actual

### BÃºsqueda (`/api/search`)
- `POST /execute` - Ejecutar bÃºsqueda en PubMed
- `POST /assistant` - Obtener sugerencias IA para optimizar query y filtros
- `GET /mesh/suggestions` - Obtener sugerencias de tÃ©rminos MeSH
- `GET /results/{searchId}/evidence-pyramid` - Obtener pirÃ¡mide de evidencia

### VerificaciÃ³n (`/api/verify`)
- `POST /claim` - Verificar un claim con RAG
- `GET /result/{verificationId}` - Obtener resultado de verificaciÃ³n
- `GET /history` - Historial de verificaciones

### Estudiante (`/api/student`)
- `GET /dashboard/overview` - Dashboard del estudiante
- `GET /progress/detailed` - Progreso detallado
- `GET /search/history` - Historial de bÃºsquedas

### Profesor (`/api/professor`)
- `GET /dashboard/overview` - Dashboard del profesor
- `GET /students` - Lista de estudiantes
- `GET /cases` - Casos de estudio
- `POST /cases` - Crear nuevo caso
- `GET /analytics/class-performance` - AnÃ¡lisis de desempeÃ±o

### Administrador (`/api/admin`)
- `GET /users` - Lista de usuarios
- `POST /users/batch` - Importar usuarios en lote
- `GET /audit/logs` - Registros de auditorÃ­a
- `GET /system/health` - Estado del sistema
- `GET /settings` - ConfiguraciÃ³n del sistema

### Sistema (`/api/system`)
- `GET /health` - Health check del sistema
- `GET /metrics/prometheus` - MÃ©tricas para Prometheus

## ðŸ” DocumentaciÃ³n API

Swagger/OpenAPI disponible en:
```
http://localhost:8080/swagger-ui.html
```

O ver JSON de OpenAPI:
```
http://localhost:8080/v3/api-docs
```

## ðŸ¥ Monitoreo

### Health Check

```bash
curl http://localhost:8080/api/system/health
```

### Actuator Endpoints

```bash
curl http://localhost:8080/actuator/health
curl http://localhost:8080/actuator/metrics
```

### Prometheus Metrics

```bash
curl http://localhost:8080/api/system/metrics/prometheus
```

## ðŸ§ª Testing

Ejecutar tests:

```bash
mvn test
```

Con cobertura:

```bash
mvn test jacoco:report
```

## ðŸ³ Docker

### Build Docker Image

```bash
docker build -t uci-competencia-backend:latest .
```

### Ejecutar con Docker Compose

```bash
docker-compose up -d
```

Ver logs:

```bash
docker-compose logs -f backend
```

Detener:

```bash
docker-compose down
```

## ðŸ› ï¸ Desarrollo

### Hot Reload

El proyecto tiene `spring-boot-devtools` habilitado para desarrollo con hot reload:

```bash
mvn spring-boot:run
```

### Estructura de Paquetes

```
com.uci.competencia
â”œâ”€â”€ config/              # Configuraciones de Spring
â”œâ”€â”€ controller/api/      # Controladores REST
â”œâ”€â”€ service/             # Interfaces de servicios
â”‚   â”œâ”€â”€ impl/           # Implementaciones
â”‚   â””â”€â”€ external/       # Servicios externos
â”œâ”€â”€ repository/          # Repositorios JPA
â”œâ”€â”€ model/
â”‚   â”œâ”€â”€ entity/         # Entidades JPA
â”‚   â”œâ”€â”€ dto/            # Data Transfer Objects
â”‚   â””â”€â”€ enums/          # Enumeraciones
â”œâ”€â”€ security/            # JWT, autenticaciÃ³n
â”œâ”€â”€ exception/           # Excepciones personalizadas
â”œâ”€â”€ aspect/              # Aspectos AOP (logging, auditorÃ­a)
â”œâ”€â”€ scheduler/           # Tareas programadas
â””â”€â”€ util/                # Utilidades
```

## ðŸ“‹ CaracterÃ­sticas Implementadas

### âœ… Completado

- [x] Estructura Spring Boot completa
- [x] AutenticaciÃ³n con JWT
- [x] Role-Based Access Control (RBAC)
- [x] Entidades y repositorios
- [x] Servicios base
- [x] Controladores REST
- [x] ConfiguraciÃ³n de seguridad
- [x] ConfiguraciÃ³n de CORS
- [x] Redis para cachÃ©
- [x] WebSocket para comunicaciÃ³n en tiempo real
- [x] Manejo centralizado de excepciones
- [x] Logging y auditorÃ­a
- [x] Migrations de base de datos con Flyway
- [x] OpenAPI/Swagger
- [x] Health checks
- [x] Prometheus metrics

### ðŸ”„ En Desarrollo

- [ ] IntegraciÃ³n completa con PubMed API
- [x] ImplementaciÃ³n base del motor RAG (verificaciÃ³n y generaciÃ³n asistida)
- [ ] IntegraciÃ³n con LDAP de UCI
- [ ] EnvÃ­o de emails
- [ ] Vector database (Weaviate) para embeddings
- [ ] CÃ¡lculos complejos de competencias

### ðŸ“… PrÃ³ximas Fases

- [ ] Tests unitarios e integraciÃ³n
- [ ] Performance tuning
- [ ] Caching estratÃ©gico
- [ ] DocumentaciÃ³n avanzada
- [ ] Deployment en producciÃ³n

## ðŸ¤ Contribuir

1. Crear una rama feature: `git checkout -b feature/nueva-funcionalidad`
2. Hacer cambios y commits: `git commit -am 'Agregar nueva funcionalidad'`
3. Push a la rama: `git push origin feature/nueva-funcionalidad`
4. Abrir Pull Request

## ðŸ“ Convenciones de CÃ³digo

- **Nombres de clases:** PascalCase (ej: `UserService`)
- **Nombres de mÃ©todos:** camelCase (ej: `getUserById()`)
- **Nombres de variables:** camelCase (ej: `userId`)
- **Constantes:** UPPER_SNAKE_CASE (ej: `MAX_USERS`)

## ðŸ” Seguridad

- Todas las contraseÃ±as se hashean con BCrypt
- JWT tokens con expiraciÃ³n configurable
- CORS configurado para dominios especÃ­ficos
- ValidaciÃ³n de entrada en DTOs
- Manejo de excepciones seguro
- AuditorÃ­a completa de acciones

## ðŸ“Š Logging

Los logs se guardan en:
```
logs/application.log
```

Niveles configurables por paquete en `application.yml`

## ðŸš¨ Troubleshooting

### Error de conexiÃ³n a PostgreSQL
```
Verificar que PostgreSQL estÃ¡ ejecutÃ¡ndose
psql -U postgres -c "SELECT 1"
```

### Error de conexiÃ³n a Redis
```
Verificar que Redis estÃ¡ ejecutÃ¡ndose
redis-cli ping
```

### Error de compilaciÃ³n Java
```
Limpiar Maven cache:
mvn clean install -DskipTests
```

## ðŸ“ž Soporte

Para reportar bugs o sugerencias, contactar al equipo de desarrollo.

## ðŸ“„ Licencia

Este proyecto es propiedad de la Universidad de Ciencias InformÃ¡ticas (UCI).

---

**Ãšltima actualizaciÃ³n:** Enero 2026
**VersiÃ³n:** 1.0.0
**Estado:** EN DESARROLLO

