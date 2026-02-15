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
      'Revisa indicadores globales de busquedas, verificaciones y bibliografias.',
      'Analiza cada tarjeta de competencia (acceso, procesamiento y comunicacion).',
      'Consulta actividad reciente para identificar habitos y brechas.',
      'Usa los accesos directos de accion para entrar al modulo que debes reforzar.',
    ],
    recommendations: [
      'Empieza y termina tu sesion revisando este panel para medir avance real.',
      'Prioriza la competencia con menor puntaje semanal.',
      'Combina frecuencia de uso con calidad de evidencia.',
    ],
    commonMistakes: [
      'Interpretar progreso solo por cantidad de acciones.',
      'No relacionar la actividad reciente con objetivos de aprendizaje.',
    ],
    quickLinks: [
      { label: 'Busqueda avanzada', href: '/student/search' },
      { label: 'Verificacion', href: '/student/verify' },
    ],
  },
  {
    key: 'student-search',
    title: 'Busqueda avanzada',
    badge: 'Estudiante · Busqueda',
    matchers: ['/student/search'],
    objective:
      'Construir consultas clinicas precisas usando MeSH, operadores booleanos y filtros metodologicos.',
    workflow: [
      'Formula una pregunta concreta y extrae terminos clave.',
      'Agrega terminos MeSH en constructor visual o modo avanzado.',
      'Relaciona terminos con AND, OR y NOT segun la logica de la pregunta.',
      'Aplica filtros (ano, tipo de estudio, tamano muestral).',
      'Evalua resultados por nivel de evidencia, conflicto de interes y pertinencia.',
      'Selecciona articulos y exporta a bibliografia.',
    ],
    recommendations: [
      'Refina en iteraciones: consulta amplia, luego precision.',
      'Favorece estudios de alto nivel cuando respondan tu pregunta.',
      'Guarda consultas utiles para reutilizarlas.',
    ],
    commonMistakes: [
      'Consultar terminos muy generales sin filtros.',
      'Elegir articulos por titulo sin validar resumen ni metadatos.',
    ],
    quickLinks: [
      { label: 'Piramide de evidencia', href: '/student/pyramid' },
      { label: 'Crear bibliografia', href: '/student/bibliography' },
    ],
  },
  {
    key: 'student-verify',
    title: 'Verificacion de claims',
    badge: 'Estudiante · Verificacion',
    matchers: ['/student/verify'],
    objective:
      'Contrastar afirmaciones de salud con evidencia cientifica y obtener una conclusion argumentada.',
    workflow: [
      'Ingresa un claim en texto o una URL verificable.',
      'Ejecuta la verificacion y espera resultado con score.',
      'Compara evidencia a favor y en contra.',
      'Interpreta explicacion y recomendaciones para profundizar.',
      'Si hay conflicto, vuelve a busqueda avanzada para ampliar contraste.',
    ],
    recommendations: [
      'Formula claims concretos y medibles.',
      'Revisa el detalle de evidencia, no solo el score final.',
      'Documenta por que aceptas o rechazas la afirmacion.',
    ],
    commonMistakes: [
      'Verificar afirmaciones ambiguas o con multiples ideas.',
      'Tomar el resultado sin juicio critico.',
    ],
    quickLinks: [
      { label: 'Busqueda avanzada', href: '/student/search' },
      { label: 'Piramide de evidencia', href: '/student/pyramid' },
    ],
  },
  {
    key: 'student-bibliography',
    title: 'Generador de bibliografias',
    badge: 'Estudiante · Bibliografias',
    matchers: ['/student/bibliography'],
    objective:
      'Crear referencias academicas consistentes a partir de articulos seleccionados.',
    workflow: [
      'Carga articulos desde busqueda o piramide, o realiza busqueda interna.',
      'Selecciona solo estudios pertinentes a tu objetivo.',
      'Define formato (APA, Vancouver, BibTeX o XML).',
      'Asigna nombre descriptivo y genera la bibliografia.',
      'Revisa contenido final y descarga/copia para tu entrega.',
    ],
    recommendations: [
      'Mantener bibliografias por tema mejora trazabilidad.',
      'Valida autores, ano, revista y DOI antes de exportar.',
      'Reutiliza el historial para ahorrar tiempo.',
    ],
    commonMistakes: [
      'Mezclar articulos de temas distintos en una sola bibliografia.',
      'No verificar formato solicitado por la asignatura.',
    ],
    quickLinks: [
      { label: 'Buscar articulos', href: '/student/search' },
      { label: 'Ver casos', href: '/student/cases' },
    ],
  },
  {
    key: 'student-cases',
    title: 'Casos asignados',
    badge: 'Estudiante · Casos',
    matchers: ['/student/cases'],
    objective:
      'Aplicar evidencia a escenarios clinicos y entregar analisis estructurado con criterio academico.',
    workflow: [
      'Abre el caso y revisa escenario, fecha, preguntas guia y rubrica.',
      'Identifica articulos requeridos y complementarios.',
      'Elabora respuesta argumentada con evidencia relevante.',
      'Redacta conclusion alineada con criterios de evaluacion.',
      'Envia entrega y da seguimiento al estado.',
    ],
    recommendations: [
      'Estructura respuesta: problema, evidencia, interpretacion, decision.',
      'Relaciona cada argumento con la rubrica.',
      'Explica incertidumbre si la evidencia es conflictiva.',
    ],
    commonMistakes: [
      'Responder sin referenciar evidencia de soporte.',
      'Entregar fuera de plazo por no gestionar tiempo.',
    ],
    quickLinks: [
      { label: 'Busqueda avanzada', href: '/student/search' },
      { label: 'Bibliografias', href: '/student/bibliography' },
    ],
  },
  {
    key: 'student-pyramid',
    title: 'Piramide de evidencia',
    badge: 'Estudiante · Piramide',
    matchers: ['/student/pyramid'],
    objective:
      'Priorizar estudios por calidad metodologica y seleccionar evidencia mas solida.',
    workflow: [
      'Busca un tema clinico para cargar estudios.',
      'Filtra por nivel de evidencia y compara calidad.',
      'Selecciona estudios pertinentes.',
      'Envia seleccion al modulo de bibliografias.',
    ],
    recommendations: [
      'Combina nivel de evidencia con pertinencia clinica.',
      'Justifica por que priorizas ciertos estudios.',
    ],
    commonMistakes: [
      'Elegir por nivel sin revisar contexto del estudio.',
      'Asumir que un estudio reciente siempre es mejor.',
    ],
    quickLinks: [
      { label: 'Bibliografias', href: '/student/bibliography' },
      { label: 'Verificacion', href: '/student/verify' },
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
      'Define acciones: crear caso, evaluar entregas o ajustar estrategias de busqueda.',
    ],
    recommendations: [
      'Monitorea tendencias semanales, no solo valores puntuales.',
      'Cruza metricas con calidad de entregas para intervenciones precisas.',
    ],
    commonMistakes: [
      'Tomar decisiones con una sola metrica aislada.',
      'No transformar hallazgos del dashboard en acciones concretas.',
    ],
    quickLinks: [
      { label: 'Casos de estudio', href: '/professor/cases' },
      { label: 'Analiticas', href: '/professor/analytics' },
    ],
  },
  {
    key: 'prof-cases',
    title: 'Gestion de casos de estudio',
    badge: 'Profesor · Casos',
    matchers: ['/professor/cases'],
    objective:
      'Disenar, asignar y dar seguimiento a casos orientados al desarrollo de competencias informacionales.',
    workflow: [
      'Crea caso con escenario clinico, dificultad y rubrica.',
      'Define preguntas guia y evidencia requerida.',
      'Asigna estudiantes y establece fecha limite.',
      'Monitorea estado de entregas y calidad de respuestas.',
      'Ajusta casos segun resultados observados.',
    ],
    recommendations: [
      'Redacta escenarios realistas y evaluables.',
      'Mantener coherencia entre preguntas guia y rubrica.',
      'Escalar dificultad progresivamente.',
    ],
    commonMistakes: [
      'Crear rubricas ambiguas con criterios no medibles.',
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
      'Asigna puntuaciones por competencia segun rubrica.',
      'Registra comentarios accionables y retroalimentacion final.',
      'Publica evaluacion y da seguimiento a mejoras.',
    ],
    recommendations: [
      'Usa criterios homogeneos para todo el grupo.',
      'Ofrece retroalimentacion especifica, no generalista.',
      'Identifica patrones para retroalimentacion colectiva.',
    ],
    commonMistakes: [
      'Evaluar sin referencia explicita a rubrica.',
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
      'Gestionar estrategias de busqueda preconfiguradas para mejorar precision y cobertura tematica.',
    workflow: [
      'Crea o edita hedges por categoria o tipo de estudio.',
      'Prueba hedge en escenarios de consulta reales.',
      'Ajusta terminos/operadores segun precision obtenida.',
      'Publica plantillas para uso recurrente de estudiantes.',
    ],
    recommendations: [
      'Documenta claramente cuando usar cada hedge.',
      'Mide precision y recall antes de consolidar una plantilla.',
    ],
    commonMistakes: [
      'Construir hedges demasiado complejos para usuarios novatos.',
      'No versionar cambios en estrategias criticas.',
    ],
    quickLinks: [
      { label: 'Busqueda profesor', href: '/professor/search' },
      { label: 'Analiticas', href: '/professor/analytics' },
    ],
  },
  {
    key: 'prof-students',
    title: 'Seguimiento de estudiantes',
    badge: 'Profesor · Estudiantes',
    matchers: ['/professor/students'],
    objective:
      'Monitorear progreso individual y grupal para orientar intervenciones pedagogicas.',
    workflow: [
      'Revisa listado de estudiantes y su avance por competencia.',
      'Detecta bajo rendimiento o estancamiento.',
      'Asigna practicas o casos focalizados segun necesidad.',
      'Verifica mejora tras cada ciclo de evaluacion.',
    ],
    recommendations: [
      'Combina datos cuantitativos con observacion cualitativa.',
      'Prioriza acompanamiento temprano en estudiantes con riesgo.',
    ],
    commonMistakes: [
      'Comparar estudiantes sin considerar nivel de partida.',
      'Tomar decisiones sin revisar evidencias de actividad.',
    ],
    quickLinks: [
      { label: 'Analiticas', href: '/professor/analytics' },
      { label: 'Casos', href: '/professor/cases' },
    ],
  },
  {
    key: 'prof-analytics',
    title: 'Analiticas docentes',
    badge: 'Profesor · Analiticas',
    matchers: ['/professor/analytics'],
    objective:
      'Interpretar tendencias de aprendizaje y efectividad de estrategias didacticas.',
    workflow: [
      'Revisa indicadores por competencia y cohorte.',
      'Identifica brechas recurrentes y niveles de logro.',
      'Relaciona resultados con actividades aplicadas.',
      'Define ajustes curriculares o de evaluacion.',
    ],
    recommendations: [
      'Analiza series temporales para evitar sesgos de corto plazo.',
      'Comparte hallazgos clave con tu equipo docente.',
    ],
    commonMistakes: [
      'Sobregeneralizar con muestras pequenas.',
      'No cerrar el ciclo entre analisis y mejora instruccional.',
    ],
    quickLinks: [
      { label: 'Dashboard profesor', href: '/professor' },
      { label: 'Estudiantes', href: '/professor/students' },
    ],
  },
  {
    key: 'prof-search',
    title: 'Busqueda academica del profesor',
    badge: 'Profesor · Busqueda',
    matchers: ['/professor/search'],
    objective:
      'Explorar evidencia para docencia, casos y actualizacion de contenidos academicos.',
    workflow: [
      'Define necesidad informacional (tema, intervencion, poblacion).',
      'Construye consulta con terminos estructurados.',
      'Filtra por calidad y actualidad metodologica.',
      'Selecciona estudios para clase o para casos.',
    ],
    recommendations: [
      'Usa hedges para estandarizar calidad de consulta.',
      'Conserva consultas base para reutilizacion por curso.',
    ],
    commonMistakes: [
      'No separar busqueda docente de busqueda exploratoria.',
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
      'Detecta alertas prioritarias y deriva accion inmediata.',
      'Valida estabilidad antes de cambios de configuracion.',
    ],
    recommendations: [
      'Revisar dashboard al inicio de cada jornada operativa.',
      'Escalar rapidamente alertas criticas de disponibilidad.',
    ],
    commonMistakes: [
      'Ignorar tendencias de degradacion progresiva.',
      'Postergar tratamiento de alertas recurrentes.',
    ],
    quickLinks: [
      { label: 'Salud del sistema', href: '/admin/health' },
      { label: 'Auditoria', href: '/admin/audit' },
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
      'Crea, edita o desactiva cuentas segun politica institucional.',
      'Asigna roles correctos (student/professor/admin).',
      'Verifica historial de cambios y resultado de importaciones.',
    ],
    recommendations: [
      'Aplicar principio de minimo privilegio en asignacion de roles.',
      'Validar datos antes de importaciones masivas.',
    ],
    commonMistakes: [
      'Modificar roles sin revisar impacto operativo.',
      'Desactivar cuentas sin registrar contexto de la accion.',
    ],
    quickLinks: [
      { label: 'Auditoria', href: '/admin/audit' },
      { label: 'Configuracion', href: '/admin/settings' },
    ],
  },
  {
    key: 'admin-audit',
    title: 'Auditoria y trazabilidad',
    badge: 'Admin · Auditoria',
    matchers: ['/admin/audit'],
    objective:
      'Investigar eventos del sistema y mantener cumplimiento mediante registro verificable.',
    workflow: [
      'Filtra logs por usuario, accion, fecha y severidad.',
      'Inspecciona eventos sensibles (roles, accesos, cambios de config).',
      'Exporta evidencia para revision interna o cumplimiento.',
      'Documenta hallazgos y medidas correctivas.',
    ],
    recommendations: [
      'Mantener revisiones periodicas de logs criticos.',
      'Cruzar auditoria con alertas de sistema para analisis causal.',
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
      'Administrar mantenimiento tecnico, servicios internos y acciones operativas avanzadas.',
    workflow: [
      'Revisa estado de servicios internos y recursos.',
      'Ejecuta acciones permitidas (reindex, limpieza, cache) con criterio.',
      'Valida resultado despues de cada accion operacional.',
      'Registra cambios para continuidad operativa.',
    ],
    recommendations: [
      'Ejecutar acciones de mantenimiento fuera de picos de uso.',
      'Aplicar cambios de forma incremental y validada.',
    ],
    commonMistakes: [
      'Aplicar multiples acciones sin validar impacto intermedio.',
      'No dejar trazabilidad de decisiones operativas.',
    ],
    quickLinks: [
      { label: 'Salud', href: '/admin/health' },
      { label: 'Configuracion', href: '/admin/settings' },
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
      'Revisa estado general y metricas de CPU, memoria, conexiones y latencias.',
      'Identifica desviaciones respecto a umbrales esperados.',
      'Escala incidencias y ejecuta plan de contencion.',
      'Confirma recuperacion posterior al incidente.',
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
      { label: 'Auditoria', href: '/admin/audit' },
    ],
  },
  {
    key: 'admin-settings',
    title: 'Configuracion de plataforma',
    badge: 'Admin · Configuracion',
    matchers: ['/admin/settings'],
    objective:
      'Gestionar parametros funcionales, seguridad e integraciones externas de forma segura.',
    workflow: [
      'Revisa configuraciones actuales y valida dependencias.',
      'Aplica cambios puntuales en seguridad, IA, limites y parametros pedagogicos.',
      'Guarda, verifica impacto y valida comportamiento post-cambio.',
      'Registra ajustes para auditoria y rollback.',
    ],
    recommendations: [
      'Cambiar una variable a la vez cuando el entorno sea sensible.',
      'Probar cambios en flujo real de usuarios despues de guardar.',
    ],
    commonMistakes: [
      'Modificar configuraciones sin ventana de control.',
      'No validar compatibilidad de nuevas politicas con procesos vigentes.',
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
          Como utilizar esta funcionalidad
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
            Guia funcional completa para usar correctamente cada modulo de la plataforma.
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
