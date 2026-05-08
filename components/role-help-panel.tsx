'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { usePathname } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  BookOpenCheck,
  CircleHelp,
  Lightbulb,
  ListChecks,
  Route,
  ShieldAlert,
} from 'lucide-react'

type PlatformRole = 'student' | 'professor' | 'admin'

type HelpModule = {
  key: string
  title: string
  badge: string
  matchers: string[]
  objective: string
  workflow: string[]
  recommendations: string[]
  commonMistakes: string[]
  quickLinks: Array<{ label: string; href: string }>
}

type RoleHelpConfig = {
  roleLabel: string
  modules: HelpModule[]
}

const STUDENT_MODULES: HelpModule[] = [
  {
    key: 'student-dashboard',
    title: 'Dashboard del estudiante',
    badge: 'Estudiante · Dashboard',
    matchers: ['/student'],
    objective:
      'Monitorear tu progreso por competencias y decidir en que funcionalidad debes practicar primero.',
    workflow: [
      'Revisa indicadores globales de búsquedas, verificaciones y bibliografías.',
      'Analiza cada tarjeta de competencia (acceso, procesamiento y comunicación).',
      'Consulta actividad reciente para identificar hábitos y brechas.',
      'Usa los accesos directos de acción para entrar al módulo que debes reforzar.',
    ],
    recommendations: [
      'Empieza y termina tu sesión revisando este panel para medir avance real.',
      'Prioriza la competencia con menor puntaje semanal.',
      'Combina frecuencia de uso con calidad de evidencia.',
    ],
    commonMistakes: [
      'Interpretar progreso solo por cantidad de acciones.',
      'No relacionar la actividad reciente con objetivos de aprendizaje.',
    ],
    quickLinks: [
      { label: 'Búsqueda avanzada', href: '/student/search' },
      { label: 'Verificación', href: '/student/verify' },
    ],
  },
  {
    key: 'student-search',
    title: 'Búsqueda avanzada',
    badge: 'Estudiante · Búsqueda',
    matchers: ['/student/search'],
    objective:
      'Construir consultas clínicas precisas usando MeSH, operadores booleanos y filtros metodológicos.',
    workflow: [
      'Formula una pregunta concreta y extrae términos clave.',
      'Agrega términos MeSH en constructor visual o modo avanzado.',
      'Relaciona términos con AND, OR y NOT según la lógica de la pregunta.',
      'Aplica filtros (año, tipo de estudio, tamaño muestral).',
      'Evalúa resultados por nivel de evidencia, conflicto de interés y pertinencia.',
      'Selecciona artículos y exporta a bibliografía.',
    ],
    recommendations: [
      'Refina en iteraciones: consulta amplia, luego precisión.',
      'Favorece estudios de alto nivel cuando respondan tu pregunta.',
      'Guarda consultas útiles para reutilizarlas.',
    ],
    commonMistakes: [
      'Consultar términos muy generales sin filtros.',
      'Elegir artículos por título sin validar resumen ni metadatos.',
    ],
    quickLinks: [
      { label: 'Pirámide de evidencia', href: '/student/pyramid' },
      { label: 'Crear bibliografía', href: '/student/bibliography' },
    ],
  },
  {
    key: 'student-verify',
    title: 'Verificación de claims',
    badge: 'Estudiante · Verificación',
    matchers: ['/student/verify'],
    objective:
      'Contrastar afirmaciones de salud con evidencia científica y obtener una conclusión argumentada.',
    workflow: [
      'Ingresa un claim en texto o una URL verificable.',
      'Ejecuta la verificación y espera resultado con score.',
      'Compara evidencia a favor y en contra.',
      'Interpreta explicación y recomendaciones para profundizar.',
      'Si hay conflicto, vuelve a búsqueda avanzada para ampliar contraste.',
    ],
    recommendations: [
      'Formula claims concretos y medibles.',
      'Revisa el detalle de evidencia, no solo el score final.',
      'Documenta por que aceptas o rechazas la afirmacion.',
    ],
    commonMistakes: [
      'Verificar afirmaciones ambiguas o con múltiples ideas.',
      'Tomar el resultado sin juicio crítico.',
    ],
    quickLinks: [
      { label: 'Búsqueda avanzada', href: '/student/search' },
      { label: 'Pirámide de evidencia', href: '/student/pyramid' },
    ],
  },
  {
    key: 'student-bibliography',
    title: 'Generador de bibliografías',
    badge: 'Estudiante · Bibliografías',
    matchers: ['/student/bibliography'],
    objective:
      'Crear referencias académicas consistentes a partir de artículos seleccionados.',
    workflow: [
      'Carga artículos desde búsqueda o pirámide, o realiza búsqueda interna.',
      'Selecciona solo estudios pertinentes a tu objetivo.',
      'Define formato (APA, Vancouver, BibTeX o XML).',
      'Asigna nombre descriptivo y genera la bibliografía.',
      'Revisa contenido final y descarga/copia para tu entrega.',
    ],
    recommendations: [
      'Mantener bibliografías por tema mejora trazabilidad.',
      'Valida autores, año, revista y DOI antes de exportar.',
      'Reutiliza el historial para ahorrar tiempo.',
    ],
    commonMistakes: [
      'Mezclar artículos de temas distintos en una sola bibliografía.',
      'No verificar formato solicitado por la asignatura.',
    ],
    quickLinks: [
      { label: 'Buscar artículos', href: '/student/search' },
      { label: 'Ver casos', href: '/student/cases' },
    ],
  },
  {
    key: 'student-cases',
    title: 'Casos asignados',
    badge: 'Estudiante · Casos',
    matchers: ['/student/cases'],
    objective:
      'Aplicar evidencia a escenarios clínicos y entregar análisis estructurado con criterio académico.',
    workflow: [
      'Abre el caso y revisa escenario, fecha, preguntas guía y rúbrica.',
      'Identifica artículos requeridos y complementarios.',
      'Elabora respuesta argumentada con evidencia relevante.',
      'Redacta conclusión alineada con criterios de evaluación.',
      'Envia entrega y da seguimiento al estado.',
    ],
    recommendations: [
      'Estructura respuesta: problema, evidencia, interpretacion, decision.',
      'Relaciona cada argumento con la rúbrica.',
      'Explica incertidumbre si la evidencia es conflictiva.',
    ],
    commonMistakes: [
      'Responder sin referenciar evidencia de soporte.',
      'Entregar fuera de plazo por no gestionar tiempo.',
    ],
    quickLinks: [
      { label: 'Búsqueda avanzada', href: '/student/search' },
      { label: 'Bibliografías', href: '/student/bibliography' },
    ],
  },
  {
    key: 'student-pyramid',
    title: 'Pirámide de evidencia',
    badge: 'Estudiante · Pirámide',
    matchers: ['/student/pyramid'],
    objective:
      'Priorizar estudios por calidad metodológica y seleccionar evidencia más sólida.',
    workflow: [
      'Busca un tema clínico para cargar estudios.',
      'Filtra por nivel de evidencia y compara calidad.',
      'Selecciona estudios pertinentes.',
      'Envia seleccion al módulo de bibliografías.',
    ],
    recommendations: [
      'Combina nivel de evidencia con pertinencia clínica.',
      'Justifica por que priorizas ciertos estudios.',
    ],
    commonMistakes: [
      'Elegir por nivel sin revisar contexto del estudio.',
      'Asumir que un estudio reciente siempre es mejor.',
    ],
    quickLinks: [
      { label: 'Bibliografías', href: '/student/bibliography' },
      { label: 'Verificación', href: '/student/verify' },
    ],
  },
]

const PROFESSOR_MODULES: HelpModule[] = [
  {
    key: 'prof-dashboard',
    title: 'Dashboard del profesor',
    badge: 'Profesor · Dashboard',
    matchers: ['/professor'],
    objective:
      'Tener una vista ejecutiva del rendimiento de estudiantes y del estado de actividades docentes.',
    workflow: [
      'Revisa indicadores globales de progreso y actividad.',
      'Detecta estudiantes o competencias con riesgo.',
      'Define acciones: crear caso, evaluar entregas o ajustar estrategias de búsqueda.',
    ],
    recommendations: [
      'Monitorea tendencias semanales, no solo valores puntuales.',
      'Cruza métricas con calidad de entregas para intervenciones precisas.',
    ],
    commonMistakes: [
      'Tomar decisiones con una sola métrica aislada.',
      'No transformar hallazgos del dashboard en acciones concretas.',
    ],
    quickLinks: [
      { label: 'Casos de estudio', href: '/professor/cases' },
      { label: 'Analíticas', href: '/professor/analytics' },
    ],
  },
  {
    key: 'prof-cases',
    title: 'Gestion de casos de estudio',
    badge: 'Profesor · Casos',
    matchers: ['/professor/cases'],
    objective:
      'Diseñar, asignar y dar seguimiento a casos orientados al desarrollo de competencias informacionales.',
    workflow: [
      'Crea caso con escenario clínico, dificultad y rúbrica.',
      'Define preguntas guía y evidencia requerida.',
      'Asigna estudiantes y establece fecha límite.',
      'Monitorea estado de entregas y calidad de respuestas.',
      'Ajusta casos según resultados observados.',
    ],
    recommendations: [
      'Redacta escenarios realistas y evaluables.',
      'Mantener coherencia entre preguntas guía y rúbrica.',
      'Escalar dificultad progresivamente.',
    ],
    commonMistakes: [
      'Crear rúbricas ambiguas con criterios no medibles.',
      'Asignar casos sin verificar carga total de estudiantes.',
    ],
    quickLinks: [
      { label: 'Nuevo caso', href: '/professor/cases/new' },
      { label: 'Evaluaciones', href: '/professor/evaluations' },
    ],
  },
  {
    key: 'prof-evaluations',
    title: 'Evaluaciones',
    badge: 'Profesor · Evaluaciones',
    matchers: ['/professor/evaluations'],
    objective:
      'Calificar entregas de forma consistente, trazable y alineada con competencias.',
    workflow: [
      'Abre entregas pendientes y revisa contenido completo.',
      'Asigna puntuaciones por competencia según rúbrica.',
      'Registra comentarios accionables y retroalimentación final.',
      'Publica evaluación y da seguimiento a mejoras.',
    ],
    recommendations: [
      'Usa criterios homogéneos para todo el grupo.',
      'Ofrece retroalimentación específica, no generalista.',
      'Identifica patrones para retroalimentación colectiva.',
    ],
    commonMistakes: [
      'Evaluar sin referencia explícita a rúbrica.',
      'Comentarios demasiado breves que no orientan mejora.',
    ],
    quickLinks: [
      { label: 'Casos', href: '/professor/cases' },
      { label: 'Estudiantes', href: '/professor/students' },
    ],
  },
  {
    key: 'prof-hedges',
    title: 'Search hedges',
    badge: 'Profesor · Hedges',
    matchers: ['/professor/hedges'],
    objective:
      'Gestionar estrategias de búsqueda preconfiguradas para mejorar precisión y cobertura temática.',
    workflow: [
      'Crea o edita hedges por categoría o tipo de estudio.',
      'Prueba hedge en escenarios de consulta reales.',
      'Ajusta términos/operadores según precisión obtenida.',
      'Publica plantillas para uso recurrente de estudiantes.',
    ],
    recommendations: [
      'Documenta claramente cuando usar cada hedge.',
      'Mide precisión y recall antes de consolidar una plantilla.',
    ],
    commonMistakes: [
      'Construir hedges demasiado complejos para usuarios novatos.',
      'No versionar cambios en estrategias críticas.',
    ],
    quickLinks: [
      { label: 'Búsqueda profesor', href: '/professor/search' },
      { label: 'Analíticas', href: '/professor/analytics' },
    ],
  },
  {
    key: 'prof-students',
    title: 'Seguimiento de estudiantes',
    badge: 'Profesor · Estudiantes',
    matchers: ['/professor/students'],
    objective:
      'Monitorear progreso individual y grupal para orientar intervenciones pedagógicas.',
    workflow: [
      'Revisa listado de estudiantes y su avance por competencia.',
      'Detecta bajo rendimiento o estancamiento.',
      'Asigna prácticas o casos focalizados según necesidad.',
      'Verifica mejora tras cada ciclo de evaluación.',
    ],
    recommendations: [
      'Combina datos cuantitativos con observación cualitativa.',
      'Prioriza acompañamiento temprano en estudiantes con riesgo.',
    ],
    commonMistakes: [
      'Comparar estudiantes sin considerar nivel de partida.',
      'Tomar decisiones sin revisar evidencias de actividad.',
    ],
    quickLinks: [
      { label: 'Analíticas', href: '/professor/analytics' },
      { label: 'Casos', href: '/professor/cases' },
    ],
  },
  {
    key: 'prof-analytics',
    title: 'Analíticas docentes',
    badge: 'Profesor · Analíticas',
    matchers: ['/professor/analytics'],
    objective:
      'Interpretar tendencias de aprendizaje y efectividad de estrategias didácticas.',
    workflow: [
      'Revisa indicadores por competencia y cohorte.',
      'Identifica brechas recurrentes y niveles de logro.',
      'Relaciona resultados con actividades aplicadas.',
      'Define ajustes curriculares o de evaluación.',
    ],
    recommendations: [
      'Analiza series temporales para evitar sesgos de corto plazo.',
      'Comparte hallazgos clave con tu equipo docente.',
    ],
    commonMistakes: [
      'Sobregeneralizar con muestras pequeñas.',
      'No cerrar el ciclo entre análisis y mejora instruccional.',
    ],
    quickLinks: [
      { label: 'Dashboard profesor', href: '/professor' },
      { label: 'Estudiantes', href: '/professor/students' },
    ],
  },
  {
    key: 'prof-search',
    title: 'Búsqueda académica del profesor',
    badge: 'Profesor · Búsqueda',
    matchers: ['/professor/search'],
    objective:
      'Explorar evidencia para docencia, casos y actualización de contenidos académicos.',
    workflow: [
      'Define necesidad informacional (tema, intervención, población).',
      'Construye consulta con términos estructurados.',
      'Filtra por calidad y actualidad metodológica.',
      'Selecciona estudios para clase o para casos.',
    ],
    recommendations: [
      'Usa hedges para estandarizar la calidad de la consulta.',
      'Conserva consultas base para reutilizacion por curso.',
    ],
    commonMistakes: [
      'No separar búsqueda docente de búsqueda exploratoria.',
      'Publicar material sin validar consistencia de fuentes.',
    ],
    quickLinks: [
      { label: 'Search hedges', href: '/professor/hedges' },
      { label: 'Casos', href: '/professor/cases' },
    ],
  },
]

const ADMIN_MODULES: HelpModule[] = [
  {
    key: 'admin-dashboard',
    title: 'Dashboard administrativo',
    badge: 'Admin · Dashboard',
    matchers: ['/admin'],
    objective:
      'Supervisar estado global de la plataforma, alertas y actividad operativa.',
    workflow: [
      'Revisa indicadores de usuarios, actividad y estado de servicios.',
      'Detecta alertas prioritarias y deriva acción inmediata.',
      'Valida estabilidad antes de cambios de configuración.',
    ],
    recommendations: [
      'Revisar dashboard al inicio de cada jornada operativa.',
      'Escalar rápidamente alertas críticas de disponibilidad.',
    ],
    commonMistakes: [
      'Ignorar tendencias de degradación progresiva.',
      'Postergar tratamiento de alertas recurrentes.',
    ],
    quickLinks: [
      { label: 'Salud del sistema', href: '/admin/health' },
      { label: 'Auditoría', href: '/admin/audit' },
    ],
  },
  {
    key: 'admin-users',
    title: 'Gestion de usuarios',
    badge: 'Admin · Usuarios',
    matchers: ['/admin/users'],
    objective:
      'Administrar altas, bajas, roles y estado de cuentas con trazabilidad completa.',
    workflow: [
      'Consulta listado y filtra por rol/estado.',
      'Crea, edita o desactiva cuentas según política institucional.',
      'Asigna roles correctos (student/professor/admin).',
      'Verifica historial de cambios y resultado de importaciones.',
    ],
    recommendations: [
      'Aplicar principio de mínimo privilegio en asignación de roles.',
      'Validar datos antes de importaciones masivas.',
    ],
    commonMistakes: [
      'Modificar roles sin revisar impacto operativo.',
      'Desactivar cuentas sin registrar contexto de la acción.',
    ],
    quickLinks: [
      { label: 'Auditoría', href: '/admin/audit' },
      { label: 'Configuración', href: '/admin/settings' },
    ],
  },
  {
    key: 'admin-audit',
    title: 'Auditoría y trazabilidad',
    badge: 'Admin · Auditoría',
    matchers: ['/admin/audit'],
    objective:
      'Investigar eventos del sistema y mantener cumplimiento mediante registro verificable.',
    workflow: [
      'Filtra logs por usuario, acción, fecha y severidad.',
      'Inspecciona eventos sensibles (roles, accesos, cambios de config).',
      'Exporta evidencia para revisión interna o cumplimiento.',
      'Documenta hallazgos y medidas correctivas.',
    ],
    recommendations: [
      'Mantener revisiones periódicas de logs críticos.',
      'Cruzar auditoría con alertas de sistema para análisis causal.',
    ],
    commonMistakes: [
      'Analizar eventos aislados sin contexto temporal.',
      'No preservar evidencia exportada ante incidentes.',
    ],
    quickLinks: [
      { label: 'Salud del sistema', href: '/admin/health' },
      { label: 'Sistema', href: '/admin/system' },
    ],
  },
  {
    key: 'admin-system',
    title: 'Operacion del sistema',
    badge: 'Admin · Sistema',
    matchers: ['/admin/system'],
    objective:
      'Administrar mantenimiento técnico, servicios internos y acciones operativas avanzadas.',
    workflow: [
      'Revisa estado de servicios internos y recursos.',
      'Ejecuta acciones permitidas (reindex, limpieza, cache) con criterio.',
      'Valida resultado después de cada acción operacional.',
      'Registra cambios para continuidad operativa.',
    ],
    recommendations: [
      'Ejecutar acciones de mantenimiento fuera de picos de uso.',
      'Aplicar cambios de forma incremental y validada.',
    ],
    commonMistakes: [
      'Aplicar múltiples acciones sin validar impacto intermedio.',
      'No dejar trazabilidad de decisiones operativas.',
    ],
    quickLinks: [
      { label: 'Salud', href: '/admin/health' },
      { label: 'Configuración', href: '/admin/settings' },
    ],
  },
  {
    key: 'admin-health',
    title: 'Salud del sistema',
    badge: 'Admin · Salud',
    matchers: ['/admin/health'],
    objective:
      'Monitorear disponibilidad, latencia y consumo de recursos para prevenir incidentes.',
    workflow: [
      'Revisa estado general y métricas de CPU, memoria, conexiones y latencias.',
      'Identifica desviaciones respecto a umbrales esperados.',
      'Escala incidencias y ejecuta plan de contención.',
      'Confirma recuperación posterior al incidente.',
    ],
    recommendations: [
      'Configura umbrales claros para warning/critical.',
      'Prioriza indicadores que impactan experiencia de usuario.',
    ],
    commonMistakes: [
      'Aceptar degradaciones leves repetidas como normales.',
      'No correlacionar latencia API con uso de recursos.',
    ],
    quickLinks: [
      { label: 'Dashboard admin', href: '/admin' },
      { label: 'Auditoría', href: '/admin/audit' },
    ],
  },
  {
    key: 'admin-settings',
    title: 'Configuración de plataforma',
    badge: 'Admin · Configuración',
    matchers: ['/admin/settings'],
    objective:
      'Gestionar parámetros funcionales, seguridad e integraciones externas de forma segura.',
    workflow: [
      'Revisa configuraciones actuales y válida dependencias.',
      'Aplica cambios puntuales en seguridad, IA, límites y parámetros pedagógicos.',
      'Guarda, verifica impacto y válida comportamiento post-cambio.',
      'Registra ajustes para auditoría y rollback.',
    ],
    recommendations: [
      'Cambiar una variable a la vez cuando el entorno sea sensible.',
      'Probar cambios en flujo real de usuarios después de guardar.',
    ],
    commonMistakes: [
      'Modificar configuraciones sin ventana de control.',
      'No validar compatibilidad de nuevas políticas con procesos vigentes.',
    ],
    quickLinks: [
      { label: 'Sistema', href: '/admin/system' },
      { label: 'Usuarios', href: '/admin/users' },
    ],
  },
]

const ROLE_HELP: Record<PlatformRole, RoleHelpConfig> = {
  student: {
    roleLabel: 'Estudiante',
    modules: STUDENT_MODULES,
  },
  professor: {
    roleLabel: 'Profesor',
    modules: PROFESSOR_MODULES,
  },
  admin: {
    roleLabel: 'Administrador',
    modules: ADMIN_MODULES,
  },
}

function matchesRoute(pathname: string, matcher: string): boolean {
  if (pathname === matcher) return true
  return pathname.startsWith(`${matcher}/`)
}

function resolveModule(pathname: string, modules: HelpModule[]): HelpModule {
  let bestModule: HelpModule | null = null
  let bestMatcherLength = -1

  for (const module of modules) {
    for (const matcher of module.matchers) {
      if (!matchesRoute(pathname, matcher)) continue
      if (matcher.length > bestMatcherLength) {
        bestModule = module
        bestMatcherLength = matcher.length
      }
    }
  }

  return bestModule ?? modules[0]
}

function HelpSection({ module }: { module: HelpModule }) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Badge variant="secondary">{module.badge}</Badge>
        <h3 className="text-lg font-semibold">{module.title}</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">{module.objective}</p>
      </div>

      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Route className="h-4 w-4 text-primary" />
          Cómo utilizar esta funcionalidad
        </h4>
        <ol className="space-y-2">
          {module.workflow.map((step, index) => (
            <li key={`${module.key}-step-${index}`} className="text-sm leading-relaxed flex gap-2">
              <span className="font-semibold text-primary min-w-5">{index + 1}.</span>
              <span>{step}</span>
            </li>
          ))}
        </ol>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-primary" />
          Recomendaciones profesionales
        </h4>
        <ul className="space-y-2">
          {module.recommendations.map((tip, index) => (
            <li key={`${module.key}-tip-${index}`} className="text-sm leading-relaxed flex gap-2">
              <span className="font-semibold text-primary">-</span>
              <span>{tip}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-warning" />
          Errores frecuentes
        </h4>
        <ul className="space-y-2">
          {module.commonMistakes.map((item, index) => (
            <li key={`${module.key}-mistake-${index}`} className="text-sm leading-relaxed flex gap-2">
              <span className="font-semibold text-warning">-</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      <Separator />

      <div className="space-y-3">
        <h4 className="text-sm font-semibold flex items-center gap-2">
          <BookOpenCheck className="h-4 w-4 text-primary" />
          Accesos directos
        </h4>
        <div className="flex flex-wrap gap-2">
          {module.quickLinks.map((link) => (
            <Button key={`${module.key}-${link.href}`} variant="outline" size="sm" asChild>
              <Link href={link.href}>{link.label}</Link>
            </Button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function RoleHelpPanel({ role }: { role: PlatformRole }) {
  const pathname = usePathname()
  const config = ROLE_HELP[role]
  const currentModule = useMemo(() => resolveModule(pathname, config.modules), [pathname, config.modules])

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button
          className="fixed right-4 bottom-4 sm:right-6 sm:bottom-6 z-40 shadow-lg"
          size="lg"
        >
          <CircleHelp className="h-4 w-4 mr-2" />
          Ayuda
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-2xl p-0">
        <SheetHeader className="border-b">
          <SheetTitle className="flex items-center gap-2">
            <CircleHelp className="h-5 w-5 text-primary" />
            Centro de ayuda · {config.roleLabel}
          </SheetTitle>
          <SheetDescription>
            Guía funcional completa para usar correctamente cada módulo de la plataforma.
          </SheetDescription>
        </SheetHeader>

        <Tabs defaultValue="contexto" className="h-full flex flex-col">
          <div className="px-4 pt-3">
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="contexto" className="gap-2">
                <ListChecks className="h-4 w-4" />
                Esta pagina
              </TabsTrigger>
              <TabsTrigger value="manual" className="gap-2">
                <BookOpenCheck className="h-4 w-4" />
                Manual del rol
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="contexto" className="flex-1 mt-0 px-4 pb-4">
            <ScrollArea className="h-[calc(100vh-180px)] pr-4">
              <HelpSection module={currentModule} />
            </ScrollArea>
          </TabsContent>

          <TabsContent value="manual" className="flex-1 mt-0 px-4 pb-4">
            <ScrollArea className="h-[calc(100vh-180px)] pr-4">
              <Accordion type="single" collapsible defaultValue={currentModule.key} className="w-full">
                {config.modules.map((module) => (
                  <AccordionItem key={module.key} value={module.key}>
                    <AccordionTrigger>{module.title}</AccordionTrigger>
                    <AccordionContent>
                      <HelpSection module={module} />
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </SheetContent>
    </Sheet>
  )
}
