# Hierro · Auditoría UI/UX

**14 de septiembre de 2026 · Beta 3.5.1 · revisión `4d96f2f`**

Abre [el informe visual](index.html). Funciona localmente y sin conexión; incluye capturas, filtros de prioridad, tres bocetos de estructura y criterios de aceptación. Esta entrega contiene análisis y propuestas. Los archivos de producción y los datos personales no se modificaron.

## Diagnóstico

Hierro tiene una identidad reconocible, tres destinos principales claros y buenas decisiones para entrenar: notas visibles, montaje de la carga, calentamiento previo, confirmación manual y celebración final. El siguiente avance consiste en **hacer que cada estado responda una pregunta concreta y mantenga el trabajo y el contexto de la persona**.

Durante la sesión, la prioridad es peso → montaje → nota → registro → próximo paso. En preparación y evolución hay espacio para explorar y disfrutar. Actualmente algunas cabeceras y bloques de explicación desplazan lo que se busca, mientras acciones frecuentes quedan fuera de la pantalla. También hay errores silenciosos que se pueden confundir con botones trabados.

## Hallazgos destacados

1. **La confirmación queda fuera de pantalla en casos reales.** A 320 × 740, Registrar serie está en y=762–818. A 390 × 844 con nombre y nota largos pasa a y=973–1029. El botón de calentamiento empieza en y=839. Propuesta: confirmación inferior estable, con espacio para campos, teclado y áreas seguras; conservar notas legibles. [Evidencia](captures/11-work-320.jpg).
2. **El día tarda en mostrar lo que viene.** A 390 × 844, el primer ejercicio de Full body comienza en y=920; cinco ejercicios ocupan cerca de 4 000 px. Propuesta: cabecera compacta, resumen de avances y primeras propuestas visibles. [Evidencia](captures/03-day-390.jpg).
3. **El error de clave de sincronización aparece detrás del diálogo.** Hay dos elementos `#sync-error`; el mensaje se escribe en el primero, dentro del fondo inerte. La persona ve que Buscar no hace nada. Reproducido sin conectar una cuenta. [Evidencia](captures/42-sync-invalid-key-390.jpg).
4. **Cancelar y Cerrar tienen destinos diferentes en Nuevo gimnasio.** Cancelar abre el selector; Cerrar vuelve a la administración. Un nombre vacío tampoco presenta error. Propuesta: una salida al contexto de origen y validación junto al campo. [Evidencia](captures/25-new-gym-modal-400.jpg).
5. **Navegación y foco pierden continuidad.** Salir de la búsqueda de ejercicios y volver abre Panorama. Algunos ajustes heredan el desplazamiento de otra sección. Elegir RIR deja el foco en `BODY`. [Comprobación de navegación](navigation-check.txt), [foco](focus-check.json).
6. **Un toque exterior descarta la medición de tiempo.** Con el reloj en 22, cerrar tocando el fondo y reabrir reinicia la preparación de 3 segundos. Eliminar una serie confirmada tampoco ofrece deshacer. [Comprobación](timer-dismiss-check.json).
7. **La nota de asiento es global.** La simulación confirma que editar «Asiento 7 en B» también cambia lo leído en A, aunque unidad y torre sí pertenezcan a cada gimnasio. Propuesta: nota técnica general y ajuste propio del lugar, visibles juntos cuando corresponda.
8. **El progreso destaca una estimación antes que lo realizado.** La ficha muestra 85,1 lb de 1RM estimado cuando la serie real era 63,85 lb × 10. Propuesta: peso y reps reales primero; estimación claramente seleccionable. Las cantidades de prueba no representan un perfil real. [Evidencia](captures/04-exercise-progress-390.jpg).
9. **Hay microtexto y contraste claro mejorable.** Se midieron etiquetas de 8–9 px. El texto secundario claro `#6b756c` sobre `#f4f3ec` da 4,30:1; el umbral WCAG de texto normal es 4,5:1. El inicio oscuro estable no repitió ese fallo. [Captura estable clara](captures/60-home-light-settled-390.jpg), [oscura](captures/61-home-dark-settled-390.jpg).
10. **La confianza del guardado necesita protección.** Al simular un fallo de escritura, el cierre puede sustituir el aviso por una celebración de sesión guardada aunque la escritura no haya ocurrido. También se reprodujeron efectos de editar otro plan sobre una sesión abierta. Son pruebas del código con almacenamiento en memoria; no se provocaron fallos en datos personales.

Los [19 grupos del informe](index.html#prioridades) incluyen inventario, creación por tiempo, resumen parcial, mapa corporal, notificaciones y lenguaje. El [apéndice de recorridos](workflow-appendix.md) conserva los casos adicionales de importación, historial, sincronización y cálculo.

## Dirección de diseño

- **Consultar un día:** nombre, gimnasio y avance, seguidos inmediatamente de las propuestas. Mantener la consulta de todos los días y sus razones de progresión.
- **Hacer una serie:** carga física fácil de interpretar, nota próxima, campos y confirmación estable. Las convenciones «ambas mancuernas», «sin barra» y unidad deben ser visibles y accesibles.
- **Descansar:** reloj y próxima carga/montaje; ampliar o saltar como acciones secundarias. Una acción coherente para continuar al terminar, respetando los calentamientos necesarios.
- **Revisar progreso:** registro real antes que estimación; detalle integrado en la gráfica; comparaciones que identifiquen las sesiones parciales.
- **Organizar desde computadora:** listas más compactas, edición de varios elementos y retorno al origen.
- **Sistema visual:** conservar verde, superficies cálidas y fuente del sistema. Unificar espaciado, estados, nombres y zonas táctiles. Afinar los SVG existentes antes de incorporar otra colección.

Los tres esquemas del informe son propuestas en HTML con datos ilustrativos, todavía sin implementar. El calentamiento obligatorio cuando corresponde es un requisito explícito y se conserva.

## Método y alcance

- Copia aislada de los archivos actuales, clave de almacenamiento de prueba y datos sintéticos: dos gimnasios, dos planes, 36 sesiones históricas iniciales y ejercicios de carga y tiempo.
- Recorridos de inicio, días, planes, ejercicios, calentamiento, trabajo, descanso, cierre, panorama, cuerpo, diario, gimnasios, equipo, ajustes, respaldo, vinculación y avisos.
- 64 estados medidos, de los cuales **62 se incluyen como evidencia válida**, más una imagen inicial de bienvenida sin registro geométrico. Las capturas 09 y 56 están excluidas: estado alterado por siembra sobre un mismo origen y captura transitoria al cambiar orientación, respectivamente. La vista horizontal se repitió en la 65.
- Ventanas de 320 × 740, 390 × 844, 400 × 907, 820 × 1180, 844 × 390 y 1280 × 900 CSS px. Se revisaron temas claro y oscuro; no todas las combinaciones de pantalla y tema.
- Capturas, rectángulos DOM, texto, tamaños de controles, foco, nombres accesibles y revisión estática. No se observó desbordamiento horizontal en los estados medidos; sí exceso de altura y acciones debajo del primer viewport.
- axe-core 4.13.0 se instaló en un directorio temporal aislado. No se instalaron paquetes globales ni se añadió analítica a la app.
- Los escaneos iniciales se conservan como exploratorios. Algunos captaron la entrada animada con opacidad reducida y arrojaron falsos positivos. Las conclusiones de contraste del inicio se basan en los estados estables 60 y 61. No se suman las ocurrencias como defectos únicos ni se calcula una puntuación de accesibilidad.
- Simulaciones Node VM con funciones del código actual: almacenamiento y reloj controlados, sin red ni credenciales. **21 escenarios ejecutados: 19 comportamientos reproducidos, 1 no reproducido y 1 con control inválido.** Los últimos dos no sustentan fallos confirmados. Los controles globales verificaron aislamiento y que los siete archivos de aplicación conservaran sus hashes.

No se hizo seguimiento ocular ni se recopilaron clics de usuarios. Lighthouse de Google es una auditoría técnica, no una medición de la mirada. La jerarquía propuesta debe validarse con personas: mostrar una pantalla brevemente, pedir que identifiquen peso/placa/nota y observar confusiones.

**Pendiente en iPhone físico:** teclado, VoiceOver, texto ampliado, áreas seguras, alcance con ambas manos, suspensión y entrega push. El navegador de escritorio con viewport móvil no acredita esos comportamientos. Se verificó consulta integrada por clic de la gráfica; no se simuló una entrega real de notificación ni una sesión real entre dos dispositivos.

## Reproducir las comprobaciones de lógica

Desde la raíz de este repositorio, con Node disponible:

```powershell
node docs/ui-audit-2026-09-14/logic-repro.cjs --summary --out mi-comprobacion-nueva.json
```

El nombre de salida debe ser nuevo: el script se niega a sobrescribirlo. Solo lee los scripts de la aplicación y escribe ese JSON dentro de la carpeta del informe. No accede al perfil del navegador ni a una cuenta.

`reproduced` significa que se reprodujo el comportamiento auditado, **no que la aplicación haya superado una prueba de corrección**. La ejecución guardada devuelve código 1 porque F06 tiene un control inválido y F12 no se reprodujo completamente. Se mantienen como pendientes, sin modificar el harness para forzar una conclusión.

Resultados: [primera ejecución](logic-results.json), [ejecución independiente](logic-results-verified.json), [detalle del harness](logic-appendix.md).

Para regenerar el informe visual con Python, sin dependencias adicionales:

```powershell
python docs/ui-audit-2026-09-14/build-report.py
```

Los archivos de imagen se guardaron originalmente con extensión PNG, pero el navegador entregó bytes JPEG; el generador normaliza la extensión a `.jpg` sin modificar la imagen. El [manifiesto](capture-manifest.json) incluye el tamaño físico, viewport y desplazamiento. Las capturas se pueden abrir completas; algunas son de página entera y otras del primer viewport.

## Referencias

- [Apple: UI Design Dos and Don'ts](https://developer.apple.com/design/tips/): organización, alineación, contraste y controles de al menos 44 × 44 puntos. En el informe se usa 44 CSS px como objetivo de diseño, sin equipararlo automáticamente a cumplimiento WCAG.
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/): estructura y consistencia de experiencia.
- [W3C: contraste mínimo](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).
- [W3C: etiqueta visible y nombre accesible](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).
- [W3C: contraste no textual](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).
- [Google: alcance de la puntuación de accesibilidad de Lighthouse](https://developer.chrome.com/docs/lighthouse/accessibility/scoring).

## Archivos de la entrega

- `index.html`: informe visual offline.
- `report-template.html` y `build-report.py`: plantilla y generador del informe.
- `findings.json`: propuestas, evidencia y criterios de aceptación.
- `captures/`, `metrics-raw.json`, `capture-manifest.json`: evidencia visual y mediciones.
- `workflow-appendix.md`, `accessibility-static.md`: revisión detallada del código y los recorridos.
- `logic-repro.cjs`, `logic-results*.json`, `logic-appendix.md`: escenarios aislados y límites de interpretación.

El orden recomendado de implementación es confianza → flujos cotidianos → sistema visual, seguido de pruebas con iPhone real. Cada cambio debe conservar el funcionamiento offline, el registro manual, la progresión, el calentamiento requerido y el equipo por gimnasio.
