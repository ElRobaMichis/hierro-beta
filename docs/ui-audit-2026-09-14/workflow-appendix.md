# Recorridos UX — informe de 32 puntos y estado de evidencia

Hierro Beta **3.5.1** · Auditoría de 2026-09-14 · `C:\Users\Agustin\Documents\hierro-beta`.

Este documento conserva la numeración y los temas del informe original de 32 puntos, incorporando las comprobaciones de navegador y el resultado final de la evidencia disponible. **No son 32 defectos confirmados.** F06 y F12 quedan pendientes y fuera de los grupos principales del informe visual. F09 se reclasifica como requisito explícito, no como defecto. Las propuestas y prioridades se desarrollan en el informe visual.

## Evidencia y resultado exacto

Fuentes de ejecución: [logic-repro.cjs](C:/Users/Agustin/Documents/hierro-beta/docs/ui-audit-2026-09-14/logic-repro.cjs), [logic-results.json](C:/Users/Agustin/Documents/hierro-beta/docs/ui-audit-2026-09-14/logic-results.json) y la ejecución independiente del auditor principal [logic-results-verified.json](C:/Users/Agustin/Documents/hierro-beta/docs/ui-audit-2026-09-14/logic-results-verified.json). El [apéndice lógico](C:/Users/Agustin/Documents/hierro-beta/docs/ui-audit-2026-09-14/logic-appendix.md) conserva el procedimiento y las limitaciones por escenario.

La ejecución independiente devolvió **exit 1**. El JSON independiente leído para este documento contiene exactamente:

```json
{
  "requested": 20,
  "executed": 21,
  "includesNotesGym": true,
  "caseControls": 49,
  "reproduced": 19,
  "not_reproduced": 1,
  "harness_control_failed": 1,
  "harness_error": 0,
  "globalControlsPassed": true
}
```

Los 19 `reproduced` son **18 de los 20 puntos prioritarios originales más `NOTAS-GYM`**. F06 es `harness_control_failed` y F12 es `not_reproduced`. Pasaron ocho controles generales y 48 de los 49 controles de escenario. El exit 1 conserva esos dos casos no concluyentes; no identifica otro defecto de la aplicación.

| Estado | Significado en este informe |
|---|---|
| **VM** | El escenario lógico ocurrió con código actual, datos sintéticos y controles aprobados. No acredita por sí solo comportamiento visual o del sistema operativo. |
| **Estático** | Recorrido sustentado en las funciones y plantillas citadas; no tiene reproducer concluyente en el JSON. El impacto UX es una evaluación, no una métrica de uso. |
| **Navegador de auditoría** | Recorrido observado en la copia aislada por el auditor principal; sus capturas se conservan en esta carpeta. |
| **Pendiente** | La prueba del caso completo no permite confirmarlo. Se conserva la incertidumbre, sin convertirlo en defecto confirmado ni refutado. |
| **Requisito** | Comportamiento solicitado explícitamente por el usuario; no entra en el listado de defectos. |

## Los 32 puntos

### 1. El final puede anunciar guardado tras fallar la persistencia — VM, F01

Al finalizar una sesión con fallo simulado de escritura, `save()` muestra un aviso y devuelve `false`, pero `finishSession()` continúa: elimina la sesión activa en memoria y abre el final que afirma que está guardada. Al recargar el almacenamiento simulado reaparece la sesión activa anterior y no la sesión histórica finalizada. La ruta sin fallo sí persiste correctamente. El problema es la contradicción entre el resultado comunicado y la persistencia real; no implica que todas las finalizaciones pierdan datos.

Código: [index.html:899](C:/Users/Agustin/Documents/hierro-beta/index.html:899), [index.html:4725](C:/Users/Agustin/Documents/hierro-beta/index.html:4725), [index.html:4730](C:/Users/Agustin/Documents/hierro-beta/index.html:4730), [index.html:4740](C:/Users/Agustin/Documents/hierro-beta/index.html:4740).

### 2. Fallo al cargar se presenta como una base vacía — VM, F02

JSON corrupto o excepción de lectura hacen que `load()` devuelva datos normalizados vacíos sin mostrar error. El usuario puede interpretar que nunca tuvo datos o volver al inicio del producto. La prueba acredita sustitución en memoria: **`load()` no borra físicamente el texto guardado**. Retirar el fallo permite leer el historial intacto.

Código: [index.html:892](C:/Users/Agustin/Documents/hierro-beta/index.html:892).

### 3. Restaurar acepta estructura interna inválida y falla después de escribir — VM, F03

El importador comprueba los arrays exteriores `routines` e `history`, pero acepta `{routines:[],history:[null]}`. Tras confirmar, esa copia se escribe y `uiHome` falla al acceder a `h.entries` desde `systemicFatigue`. La misma ruta con una copia válida funciona, y un archivo sin `routines` se rechaza. Alcance: un respaldo mínimo inválido, no una auditoría exhaustiva de formatos.

Código: [validación, index.html:5214](C:/Users/Agustin/Documents/hierro-beta/index.html:5214), [aplicación:5226](C:/Users/Agustin/Documents/hierro-beta/index.html:5226), [fallo posterior:1902](C:/Users/Agustin/Documents/hierro-beta/index.html:1902).

### 4. Editar series de otro plan afecta a la sesión abierta — VM, F04

Con una sesión de A prevista para tres series, abrir la ficha del ejercicio compartido en B y fijar cinco series cambia la sesión de A a cinco. A conserva tres en su propia configuración. `syncActiveSets` usa el contexto visible para redimensionar el ejercicio activo. Como controles, editar el propio plan sí actualiza lo esperado y las series con datos no se recortan.

Código: [index.html:2648](C:/Users/Agustin/Documents/hierro-beta/index.html:2648), [index.html:2664](C:/Users/Agustin/Documents/hierro-beta/index.html:2664).

### 5. Mover un día cambia el contexto histórico y el activo — VM, F05

Mover un día de A a B cambia también el plan al que `historySplitId` atribuye sus sesiones pasadas y el contexto de una sesión ya abierta. El fixture pasa de descanso efectivo de 60 a 180 segundos. Las series históricas permanecen iguales; cambia su atribución y las reglas consultadas. Copiar el día, como control, conserva la atribución del original.

Código: [index.html:2354](C:/Users/Agustin/Documents/hierro-beta/index.html:2354), [index.html:1065](C:/Users/Agustin/Documents/hierro-beta/index.html:1065), [index.html:1975](C:/Users/Agustin/Documents/hierro-beta/index.html:1975).

### 6. Reinterpretación de carga al cambiar barra/unidad — PENDIENTE, F06

Se conserva el tema original únicamente para trazabilidad. **No se incluye como defecto confirmado ni entre los grupos principales del informe visual.** Ambas ejecuciones lo clasifican `harness_control_failed`: el fixture de barras da 10→10 kg y falla también el control que debía preservar 30 kg. El subcaso de inventario estándar registra 30→30,412 kg al cambiar a lb, pero ese resultado aislado no convierte el caso completo en concluyente. No se arregló el harness ni se amplió la prueba.

Puntos de código revisados, sin elevarlos a confirmación: [index.html:3738](C:/Users/Agustin/Documents/hierro-beta/index.html:3738), [index.html:4824](C:/Users/Agustin/Documents/hierro-beta/index.html:4824), [index.html:3002](C:/Users/Agustin/Documents/hierro-beta/index.html:3002), [index.html:2616](C:/Users/Agustin/Documents/hierro-beta/index.html:2616).

### 7. Importar Hevy deja días sin plan hasta recargar — VM, F07

El CSV sintético crea historial y un día, pero `applyHevyImport` no asigna `split` al nuevo día. Inmediatamente no hay plan ni `nextDay` disponible. `load()` vuelve a normalizar, crea el plan y hace que aparezca el siguiente día. El control demuestra que el dato importado existe: falla su integración inmediata en la navegación por planes.

Código: [index.html:5271](C:/Users/Agustin/Documents/hierro-beta/index.html:5271), [index.html:5409](C:/Users/Agustin/Documents/hierro-beta/index.html:5409), [index.html:2026](C:/Users/Agustin/Documents/hierro-beta/index.html:2026), [index.html:838](C:/Users/Agustin/Documents/hierro-beta/index.html:838).

### 8. Timer modal de serie dependiente de callbacks y sin continuidad al cerrar — VM, F08

Tras iniciar un objetivo de 20 segundos, avanzar 15 segundos de reloj y ejecutar un único callback deja 19 segundos. `closeModal` borra el estado del timer y cancela el intervalo; abrirlo otra vez reinicia la preparación. Esto acredita la lógica ante un callback retrasado y el cierre programático, **no** throttling real, bloqueo de pantalla, Escape o gesto exterior en un móvil.

Controles: cinco callbacks puntuales y «Terminar antes» escriben 5 segundos; veinte completan el objetivo; el descanso normal sí vence por deadline con una sola actualización. Finalizar el timer rellena segundos, pero no confirma automáticamente la serie.

Código: [index.html:4273](C:/Users/Agustin/Documents/hierro-beta/index.html:4273), [index.html:4321](C:/Users/Agustin/Documents/hierro-beta/index.html:4321), [index.html:5450](C:/Users/Agustin/Documents/hierro-beta/index.html:5450), [index.html:5136](C:/Users/Agustin/Documents/hierro-beta/index.html:5136).

### 9. Calentamiento obligatorio — REQUISITO EXPLÍCITO, NO DEFECTO

Se retira la interpretación original de que la obligatoriedad sea una decisión innecesaria. El usuario exige calentamiento obligatorio: **no se propone omitirlo, saltarlo ni ofrecer una vía alternativa que eluda el requisito**. La preparación previa al registro forma parte del comportamiento esperado.

El análisis estático identifica que `warmupContext` incorpora gimnasio, tipo, rango y configuración de carga, y que `ensureWarmup` decide cuándo conservar o recalcular esa preparación. No hay un escenario independiente concluyente que permita afirmar aquí que una invalidación concreta sea indebida. La continuidad y explicación de esos cambios queda como contexto de implementación, sin convertir el requisito en un defecto. Los casos VM de registro completan la preparación con handlers actuales y reloj sintético.

Código: [index.html:4935](C:/Users/Agustin/Documents/hierro-beta/index.html:4935), [index.html:4950](C:/Users/Agustin/Documents/hierro-beta/index.html:4950), [index.html:4967](C:/Users/Agustin/Documents/hierro-beta/index.html:4967), [registro, ui.js:775](C:/Users/Agustin/Documents/hierro-beta/ui.js:775).

### 10. Descanso incoherente al elegir o quitar ejercicios — VM, F10

Elegir en la cola el mismo ejercicio cancela su descanso, porque `uiSelectExercise` siempre llama a `uiResetRest`. En cambio, quitar el ejercicio que descansaba conserva el plazo y `uiRest` en el siguiente, aunque este no tenga ninguna serie confirmada. Cerrar la cola sin elegir mantiene el descanso; quitar solo de la sesión conserva el día del plan. El fallo se concentra en la transición de contexto, no en la obligatoriedad del calentamiento.

Código: [ui.js:797](C:/Users/Agustin/Documents/hierro-beta/ui.js:797), [ui.js:801](C:/Users/Agustin/Documents/hierro-beta/ui.js:801), [index.html:4161](C:/Users/Agustin/Documents/hierro-beta/index.html:4161).

### 11. Decisiones consecutivas entre registro, descanso, siguiente ejercicio y final — ESTÁTICO

Tras la última serie, la rama de descanso puede llevar a «Continuar», después a «Ejercicio completo», luego a «Terminar sesión» y finalmente a la confirmación «Terminar y guardar». El código distingue además descartar un borrador sin series de finalizar con series confirmadas. Son estados diferentes, pero la secuencia exige que el usuario vuelva a decidir sobre pasos ya anticipados por la pantalla anterior.

Se conserva como observación de fricción y claridad de estados; no hay medición de exceso de pulsaciones en VM ni se considera defectuosa por sí misma la protección de series confirmadas. No implica que se deban descartar registros sin confirmación del usuario.

Código: [ui.js:648](C:/Users/Agustin/Documents/hierro-beta/ui.js:648), [ui.js:653](C:/Users/Agustin/Documents/hierro-beta/ui.js:653), [index.html:4364](C:/Users/Agustin/Documents/hierro-beta/index.html:4364).

### 12. Pérdida de sufijos visibles de variantes — PENDIENTE, F12

Se conserva el tema original únicamente para trazabilidad. **No se incluye como defecto confirmado ni entre los grupos principales del informe visual.** Ambas ejecuciones devuelven `not_reproduced` para el caso completo. La función produjo «Remo» para tres variantes, pero la aserción de cola busca en HTML completo, donde `(2)` también puede aparecer en un handler. Esa aserción no acredita etiquetas visibles en navegador.

Las claves y nombres completos permanecen distintos. No afirmar colisión, pérdida de datos o pérdida visual confirmada de sufijos a partir de este entregable. El resultado limitado de la función queda documentado, sin reparar el harness ni resolver la incertidumbre.

Puntos revisados: [index.html:1709](C:/Users/Agustin/Documents/hierro-beta/index.html:1709), [ui.js:802](C:/Users/Agustin/Documents/hierro-beta/ui.js:802).

### 13. «Es otra máquina» amplía el cambio a otros planes y pierde el origen — VM, F13

Desde la sesión, crear una variante añade el ejercicio a todos los días que usan el original, incluido otro plan; no lo añade a la sesión abierta. La ficha resultante no conserva `from=session`. Se cambia por tanto más planificación de la que hace visible el contexto de entrada, mientras el entrenamiento en curso sigue sin esa variante. El original se conserva y repetir el nombre se rechaza.

Código: [index.html:3983](C:/Users/Agustin/Documents/hierro-beta/index.html:3983), [index.html:3999](C:/Users/Agustin/Documents/hierro-beta/index.html:3999), [index.html:4014](C:/Users/Agustin/Documents/hierro-beta/index.html:4014), [index.html:2954](C:/Users/Agustin/Documents/hierro-beta/index.html:2954).

### 14. Crear «Plancha» deja un tipo que requiere carga — VM, F14

Crear «Plancha» desde la biblioteca asigna grupo `core`, pero mantiene tipo `normal`; sin peso, la preparación queda en `setup`. Al seleccionar manualmente `tiempo`, la preparación funciona sin peso. El caso `Assisted` sí tiene inferencia específica. La observación se refiere a clasificación y orientación al configurar, no a que toda variante llamada plancha deba medirse igual.

**El problema no es exigir calentamiento:** el recorrido debe representar correctamente el tipo de ejercicio manteniendo la preparación obligatoria.

Código: [ui.js:599](C:/Users/Agustin/Documents/hierro-beta/ui.js:599), [ui.js:611](C:/Users/Agustin/Documents/hierro-beta/ui.js:611), [index.html:985](C:/Users/Agustin/Documents/hierro-beta/index.html:985), [index.html:4950](C:/Users/Agustin/Documents/hierro-beta/index.html:4950).

### 15. Alta inicial y biblioteca obligan a reconstruir el contexto entre pasos — ESTÁTICO

El onboarding pide objetivo, pasa a nombrar el primer día y después a una ficha vacía para añadir ejercicios. La biblioteca cierra tras cada alta, por lo que construir un día de varios ejercicios requiere volver a entrar repetidamente. Es una evaluación de carga de decisiones y trabajo repetitivo; no hay tasa de abandono ni duración medida por el harness. El título «Tu primer día» también se reutiliza al invocar ese diálogo desde otros contextos.

Código: [ui.js:1035](C:/Users/Agustin/Documents/hierro-beta/ui.js:1035), [ui.js:1050](C:/Users/Agustin/Documents/hierro-beta/ui.js:1050), [index.html:3817](C:/Users/Agustin/Documents/hierro-beta/index.html:3817), [index.html:3838](C:/Users/Agustin/Documents/hierro-beta/index.html:3838), [ui.js:586](C:/Users/Agustin/Documents/hierro-beta/ui.js:586), [ui.js:612](C:/Users/Agustin/Documents/hierro-beta/ui.js:612).

### 16. Navegación principal reinicia subcontextos y comparte memoria de scroll — ESTÁTICO

Los tres accesos principales navegan con un objeto nuevo que solo contiene `name`. Volver a Evolución o Tú por esa vía no transporta la subpestaña, consulta, filtro o límite anterior. `viewKey` distingue algunas fichas, pero para `history` y `settings` usa solo el nombre; sus subpantallas comparten clave de scroll. `go` mantiene navegación interna y no integra historial del navegador en esa función.

No se ejecutaron nuevas pruebas de Atrás del navegador ni scroll móvil. Tampoco se generaliza esta pérdida a todos los retornos: **F23 demuestra que `uiOpenProgress` sí conserva el recibo y la vista/filtro de vuelta**, aunque el contexto del plan dentro de la ficha sea incorrecto.

Código: [ui.js:431](C:/Users/Agustin/Documents/hierro-beta/ui.js:431), [index.html:1666](C:/Users/Agustin/Documents/hierro-beta/index.html:1666), [index.html:1675](C:/Users/Agustin/Documents/hierro-beta/index.html:1675), [ui.js:854](C:/Users/Agustin/Documents/hierro-beta/ui.js:854).

### 17. «Ver inventario» desvía del ejercicio sin conservar el punto de retorno — ESTÁTICO

Desde Equipo, el botón elige mancuernas para `mancuerna`, barras para `barra` y discos para los demás tipos. Una torre con pin puede conducir por tanto al inventario de discos, en lugar de a la configuración que motivó la consulta. La ruta usa `{name:'gym',kind:...}` y no guarda el ejercicio de origen. Abrir un gimnasio desde la lista también fija `kind:'plates'`.

Código: [ui.js:899](C:/Users/Agustin/Documents/hierro-beta/ui.js:899), [ui.js:942](C:/Users/Agustin/Documents/hierro-beta/ui.js:942), [retorno de inventario, index.html:3673](C:/Users/Agustin/Documents/hierro-beta/index.html:3673).

### 18. Reglas guardadas, efectivas y propuesta visible pueden discrepar — VM, F18

Un rango guardado 10–6 se interpreta como 10–11. Cambiar de Hipertrofia a Fuerza deja en la sesión una propuesta de **11 repeticiones** creada antes del cambio, aunque el rango efectivo ya sea 4–6. Refrescar explícitamente recalcula a 42,5 kg × 4 en este fixture; un rango válido 10–12 se conserva. Se sustituye cualquier cifra ilustrativa anterior por la observación exacta de los JSON actuales.

Código: [index.html:1018](C:/Users/Agustin/Documents/hierro-beta/index.html:1018), [index.html:2620](C:/Users/Agustin/Documents/hierro-beta/index.html:2620), [index.html:4743](C:/Users/Agustin/Documents/hierro-beta/index.html:4743), [index.html:2973](C:/Users/Agustin/Documents/hierro-beta/index.html:2973).

### 19. Formularios con silencio, sustitución del contexto y salidas diferentes — ESTÁTICO + NAVEGADOR DEL USUARIO

Nuevo gimnasio permite enviar un campo sin `required` y retorna sin mensaje si queda vacío; se reprodujo en el navegador de auditoría. En otros diálogos, como variante con nombre existente, `infoModal` sustituye el formulario por el error. Los modelos de guardado tampoco son uniformes: la nota en la ficha guarda al escribir, mientras su edición modal requiere guardar explícitamente. Son contratos de interacción distintos que necesitan resultar claros en cada contexto.

**Corrección de Cancelar/Cerrar:** no son dos botones con la misma acción. «Cancelar» vuelve a `gymPickerModal()`; «Cerrar» sale del diálogo. La inspección del DOM confirmó ambos en captura. Se describe como dos salidas con destinos distintos y comunicación poco clara, no como duplicación exacta.

Código: [index.html:3515](C:/Users/Agustin/Documents/hierro-beta/index.html:3515), [index.html:3528](C:/Users/Agustin/Documents/hierro-beta/index.html:3528), [index.html:3542](C:/Users/Agustin/Documents/hierro-beta/index.html:3542), [ui.js:241](C:/Users/Agustin/Documents/hierro-beta/ui.js:241), [index.html:4005](C:/Users/Agustin/Documents/hierro-beta/index.html:4005), [ui.js:906](C:/Users/Agustin/Documents/hierro-beta/ui.js:906), [index.html:2734](C:/Users/Agustin/Documents/hierro-beta/index.html:2734).

### 20. Editar historial no invalida sus récords guardados — VM, F20

Corregir 100 × 10 a 10 × 10 deja el PR almacenado de 133,33 kg aunque la serie corregida equivale a 13,33 kg. La marca original la crea el motor actual; no se inserta una marca arbitraria para provocar el fallo. `migratePRs` no vuelve a calcular si todas las sesiones ya tienen `prs`. Invalidar ese caché como control sí elimina el falso récord.

Código: [index.html:3386](C:/Users/Agustin/Documents/hierro-beta/index.html:3386), [index.html:5541](C:/Users/Agustin/Documents/hierro-beta/index.html:5541).

### 21. Descargas entran en referencias de fuerza y evolución — VM, F21

Una sesión marcada como descarga pero superior a la referencia anterior eleva `bestMetricBefore` de 13,33 a 26,67 kg y aparece como mejor punto de evolución. El fixture superior se elige para hacer visible la inclusión: no implica que toda descarga produzca ese cambio. Retirarla devuelve la referencia anterior, mientras `bestAssistBefore` sí excluye descargas. Hay una inconsistencia entre las reglas de exclusión de las referencias, además del mensaje de que una descarga no compite por récords.

Código: [index.html:4393](C:/Users/Agustin/Documents/hierro-beta/index.html:4393), [ui.js:837](C:/Users/Agustin/Documents/hierro-beta/ui.js:837), [index.html:4381](C:/Users/Agustin/Documents/hierro-beta/index.html:4381), [index.html:4671](C:/Users/Agustin/Documents/hierro-beta/index.html:4671).

### 22. Menos asistencia se interpreta como regresión en el aviso de fatiga — VM, F22

Dos ejercicios asistidos mejoran reduciendo ayuda 40→30 con las mismas reps y dos ejercicios normales permanecen estables: `systemicFatigue` informa dos regresiones de cuatro. Su cálculo usa el peso asistido como si fuera carga levantada. Igualar las cargas elimina el aviso. Se audita el cálculo y su mensaje, no se emite una conclusión sobre fatiga física real.

Código: [index.html:1898](C:/Users/Agustin/Documents/hierro-beta/index.html:1898), [index.html:1913](C:/Users/Agustin/Documents/hierro-beta/index.html:1913).

### 23. Abrir progreso desde un recibo usa el primer plan que encuentra — VM, F23

Un recibo de B abre la ficha con `rid` de A si A es el primer día que contiene la clave. En asistidos, el mínimo válido pasa a usar el rango de A: la mejor ayuda resulta 20 kg en vez de los 40 kg que corresponden al rango de B. Cambiar solo el `rid` corrige el cálculo. **El recibo y el filtro de vuelta sí se conservan**; el defecto probado es el contexto de reglas dentro de la ficha.

Código: [ui.js:854](C:/Users/Agustin/Documents/hierro-beta/ui.js:854), [index.html:2954](C:/Users/Agustin/Documents/hierro-beta/index.html:2954), [ui.js:839](C:/Users/Agustin/Documents/hierro-beta/ui.js:839).

### 24. Sesión ajena bloquea inicio local y exige reclamar para continuar — VM, F24

Si existe `syncForeign`, `startSession` ofrece continuar la sesión ajena y no inicia otro día local. Reclamar con transporte simulado sin conexión muestra error y deja el bloqueo. El diálogo ofrece reclamar, sin una alternativa local dentro de ese diálogo. Es el alcance concreto de la restricción: no se afirma que no exista ninguna otra operación desde ajustes.

Control: el mismo Engine con cifrado real y respuestas sintéticas válidas transfiere la sesión mediante GET/PUT en memoria; sin sesión ajena se puede iniciar localmente sin red. No se contactó el servicio ni se probaron dos dispositivos reales.

Código: [index.html:4032](C:/Users/Agustin/Documents/hierro-beta/index.html:4032), [sync.js:222](C:/Users/Agustin/Documents/hierro-beta/sync.js:222), [sync.js:223](C:/Users/Agustin/Documents/hierro-beta/sync.js:223), [sync-engine.js:127](C:/Users/Agustin/Documents/hierro-beta/sync-engine.js:127).

### 25. Resolver conflictos exige elegir sobre resúmenes incompletos y repetir elecciones — ESTÁTICO

`syncConflictValue` recorta muchos valores a 250 caracteres y resume arrays. Diferencias decisivas pueden quedar fuera de la representación usada para elegir una copia. Al volver a entrar por `uiSyncConflicts`, se reinicia `syncChoices`; cerrar sin aplicar y reabrir no conserva las elecciones. No se ejecutó un conflicto largo nuevo ni se midió qué porcentaje de conflictos queda oculto.

Código: [sync.js:199](C:/Users/Agustin/Documents/hierro-beta/sync.js:199), [sync.js:209](C:/Users/Agustin/Documents/hierro-beta/sync.js:209), [sync.js:212](C:/Users/Agustin/Documents/hierro-beta/sync.js:212).

### 26. Buscar una clave no comprueba si el usuario abandonó el diálogo — ESTÁTICO

`uiSyncInspect` espera la inspección y después abre la comparación sin comprobar que el formulario siga activo. Una respuesta tardía podría abrir el siguiente modal después de cerrar o cambiar de contexto. Es una posibilidad derivada de la secuencia asíncrona, no una carrera reproducida en el navegador o VM actuales. El error oculto por ID duplicado se documenta aparte como una reproducción distinta en navegador.

Código: [sync.js:172](C:/Users/Agustin/Documents/hierro-beta/sync.js:172), [sync.js:176](C:/Users/Agustin/Documents/hierro-beta/sync.js:176), [sync.js:178](C:/Users/Agustin/Documents/hierro-beta/sync.js:178).

### 27. Preferencia de notificaciones activa y disponibilidad efectiva se comunican en lugares distintos — ESTÁTICO

La página de notificaciones decide sus acciones con `pushPrefs.enabled`, mientras `pushActive` exige además registro, permiso y coincidencia de espacio. Un fallo al recuperar la suscripción puede dejar la preferencia activa con un mensaje de error. Durante descanso/preparación, el mensaje de estado de la sesión solo se incluye si `pushActive()` es verdadero; esa condición puede ocultar allí precisamente el problema que impide avisar. La pantalla de ajustes sí tiene una superficie de estado: no se afirma que el error sea invisible en toda la app.

Código: [push.js:6](C:/Users/Agustin/Documents/hierro-beta/push.js:6), [push.js:9](C:/Users/Agustin/Documents/hierro-beta/push.js:9), [push.js:174](C:/Users/Agustin/Documents/hierro-beta/push.js:174), [ui.js:662](C:/Users/Agustin/Documents/hierro-beta/ui.js:662).

### 28. Avisos locales ignoran preferencias específicas y usan otro plazo — VM, F28

Con permiso concedido, app oculta y push no registrado, desactivar `rest` e `idle` no evita los avisos del fallback local. La inactividad local usa más de 15 minutos; el programador push usa cinco. Como controles, app visible y `notify=off` sí bloquean la emisión; push sí respeta ambas preferencias específicas. `Notification` solo recoge la intención: no se probó entrega real ni pantalla bloqueada.

Código: [index.html:5042](C:/Users/Agustin/Documents/hierro-beta/index.html:5042), [index.html:5078](C:/Users/Agustin/Documents/hierro-beta/index.html:5078), [push-core.js:32](C:/Users/Agustin/Documents/hierro-beta/push-core.js:32).

### 29. Vincular para activar avisos pierde el objetivo del recorrido — ESTÁTICO

Desde Notificaciones sin espacio vinculado, la acción conduce a Sincronización. Al completar el vínculo, el código vuelve a la sección Sync, sin transportar el origen Notificaciones ni retomar explícitamente la activación solicitada. El usuario debe reconocer que queda ese paso y regresar por su cuenta. La observación se limita a continuidad del recorrido; no propone saltarse permisos ni activar avisos automáticamente sin la interacción necesaria.

Código: [push.js:10](C:/Users/Agustin/Documents/hierro-beta/push.js:10), [sync.js:188](C:/Users/Agustin/Documents/hierro-beta/sync.js:188), [ui.js:920](C:/Users/Agustin/Documents/hierro-beta/ui.js:920).

### 30. Fallos de preparación offline quedan sin explicación en el arranque — ESTÁTICO

Las ramas revisadas de solicitud de almacenamiento persistente y registro del service worker silencian sus rechazos. En esas rutas no se comunica al usuario que la preparación offline no terminó, pese a la promesa de funcionamiento sin conexión en la interfaz. No equivale a afirmar que la app falle siempre offline: no se probó caché real, instalación, arranque sin conexión, expulsión de almacenamiento ni el comportamiento interno del worker en esta fase.

Código: [index.html:5620](C:/Users/Agustin/Documents/hierro-beta/index.html:5620), [index.html:5628](C:/Users/Agustin/Documents/hierro-beta/index.html:5628), [index.html:5655](C:/Users/Agustin/Documents/hierro-beta/index.html:5655), [promesa, sync.js:144](C:/Users/Agustin/Documents/hierro-beta/sync.js:144).

### 31. Restaurar sesión no restaura el reloj global de descanso — VM, F31

Restaurar un respaldo con descanso activo recupera `db.active.restUntil`, pero deja `restUntil` global en `null`, tanto en la rama local como vinculada. `syncApply`, como control, sí repone esa variable; la rama vinculada ejecuta el checkpoint del Engine sobre memoria antes de restaurar.

La observación adicional `restoreOverRest` usa plazos coincidentes y **no acredita sustituir un descanso distinto por otro**. La conclusión válida se limita a restauración con reloj global inicialmente nulo. No se probó el servicio remoto.

Código: [index.html:5226](C:/Users/Agustin/Documents/hierro-beta/index.html:5226), [sync.js:242](C:/Users/Agustin/Documents/hierro-beta/sync.js:242), [sync.js:51](C:/Users/Agustin/Documents/hierro-beta/sync.js:51).

### 32. Ayudas y errores remiten a nombres de navegación anteriores — ESTÁTICO

La navegación actual ofrece Entrenar, Evolución y Tú, con Mis gimnasios y Datos y respaldos dentro de Tú. Varias ayudas todavía indican «Rutinas → Cambiar», «Ajustes → Mi equipo» o «Ajustes → Respaldo». El usuario debe traducir esos nombres para encontrar la acción, especialmente al resolver errores. Se citan mensajes concretos; no se presupone que todo el copy esté desactualizado.

Código: [navegación, ui.js:433](C:/Users/Agustin/Documents/hierro-beta/ui.js:433), [secciones, ui.js:920](C:/Users/Agustin/Documents/hierro-beta/ui.js:920), [index.html:2308](C:/Users/Agustin/Documents/hierro-beta/index.html:2308), [index.html:3047](C:/Users/Agustin/Documents/hierro-beta/index.html:3047), [index.html:5221](C:/Users/Agustin/Documents/hierro-beta/index.html:5221).

## Nota adicional: persistencia por gimnasio — VM, NOTAS-GYM

**La nota técnica es global por clave de ejercicio; la configuración de máquina y la unidad son por gimnasio.** El escenario independiente confirma:

1. En A, torre de inicio/paso 5 kg y nota «Asiento 4 en A».
2. Al cambiar a B, se recupera torre de inicio/paso 10 lb, pero sigue esa misma nota.
3. Editar en B a «Asiento 7 en B» y volver a A recupera la torre de 5 kg, pero deja la nota de B.
4. Recargar y proyectar para sync conserva una única nota en `exmeta[key].notes`, sin copia dentro de `gyms[].machines[key]`.

`MACHINE_FIELDS` incluye `equip`, `points`, `base`, `bar`, `step`, `cap` y `stack`; no incluye `notes`. La inferencia UX debe distinguir una indicación técnica común de un ajuste específico de la máquina. El placeholder «Asiento, agarre, técnica…» reúne ambas clases bajo una misma nota, mientras la selección de gimnasio puede sugerir aislamiento. El texto de Nuevo gimnasio «lo que ajustes ahí no toca a…» tampoco explica esta excepción.

En sync, editar esa nota en ambas copias produce conflicto global `/exmeta/press de prueba/notes`. Como control, modificar configuración de la máquina de A en una copia y la de B en otra se combina sin conflicto. No se ha cambiado el modelo, migrado notas ni elegido un rediseño.

Código: [guardado, index.html:2677](C:/Users/Agustin/Documents/hierro-beta/index.html:2677), [campos por gym:3421](C:/Users/Agustin/Documents/hierro-beta/index.html:3421), [snapshot:3435](C:/Users/Agustin/Documents/hierro-beta/index.html:3435), [aplicación:3446](C:/Users/Agustin/Documents/hierro-beta/index.html:3446), [copy:3513](C:/Users/Agustin/Documents/hierro-beta/index.html:3513), [campo visible, ui.js:906](C:/Users/Agustin/Documents/hierro-beta/ui.js:906), [proyección, sync-core.js:50](C:/Users/Agustin/Documents/hierro-beta/sync-core.js:50).

## Comprobación adicional de navegador: error de clave detrás del diálogo

**Navegador de auditoría, corroboración estática; sin reproducer VM.** En Tú → Sync → Ya tengo una clave, enviar `clave-de-prueba` no muestra el error dentro del diálogo. La inspección del DOM confirmó dos nodos `#sync-error`: el primero en el fondo inerte contiene «Revisa la clave: debe empezar por hr1. y estar completa.»; el segundo, dentro del diálogo, queda vacío. Al cerrar aparece el error detrás.

La pantalla y el diálogo generan el mismo ID. `syncUIError` usa `getElementById`, por lo que el error se asigna al primer nodo en vez de a la superficie activa. La validación de la clave sucede antes del transporte. Este hallazgo se incorpora sin alterar la numeración original y sin confundirlo con la respuesta tardía del punto 26.

Código: [pantalla, sync.js:144](C:/Users/Agustin/Documents/hierro-beta/sync.js:144), [diálogo:170](C:/Users/Agustin/Documents/hierro-beta/sync.js:170), [catch:179](C:/Users/Agustin/Documents/hierro-beta/sync.js:179), [asignación:147](C:/Users/Agustin/Documents/hierro-beta/sync.js:147), [validación, sync-core.js:144](C:/Users/Agustin/Documents/hierro-beta/sync-core.js:144).

Se conservan también como observaciones de las capturas de auditoría, sin nueva ejecución: cabeceras/forecast extensos; protagonismo visual del 1RM; final parcial de una serie con «3396 kg menos». La comparación de volumen está en [index.html:4586](C:/Users/Agustin/Documents/hierro-beta/index.html:4586) y [index.html:4594](C:/Users/Agustin/Documents/hierro-beta/index.html:4594), y el título de métrica en [ui.js:840](C:/Users/Agustin/Documents/hierro-beta/ui.js:840). **No se recalculó 3396 ni se midieron esas pantallas en VM.** Estas observaciones no elevan F06/F12 a confirmados.

## Cobertura y límites finales

| Recorrido original | Puntos de este documento | Evidencia disponible |
|---|---|---|
| Onboarding, biblioteca y creación de días | 7, 14, 15 | VM de importación y tipo; resto estático |
| Planes y contextos compartidos | 4, 5, 13, 18, 23 | VM |
| Preparación y calentamiento | 9, 14 | Requisito preservado; VM del tipo de Plancha y preparación usada por otros casos |
| Registro, cola, descanso y final | 1, 8, 10, 11, 31 | VM salvo evaluación de secuencia de 11; capturas de final observadas en navegador |
| Evolución, historial y referencias | 20, 21, 22, 23 | VM; protagonismo visual de 1RM observado en navegador |
| Gimnasios, equipo, notas y formularios | 6, 12, 13, 17, 19, NOTAS-GYM | F06/F12 pendientes; VM de variante y notas; estático y capturas de gimnasio |
| Navegación y nombres de menús | 16, 17, 23, 29, 32 | VM del contexto F23; resto estático |
| Sync, avisos, offline y errores | 2, 3, 24–31; error de clave adicional | VM en los casos identificados; resto estático o reproducción explícita en navegador |

Los archivos fuente se leen y sus funciones se ejecutan en VM con datos sintéticos. Se omite el arranque `init`; no se usa estado real del usuario. `localStorage`, FileReader, reloj y scheduler son simulados. El render general registra llamadas, salvo F03 que ejecuta `uiHome`. El DOM mínimo no emula layout, selectores complejos, foco, `inert`, gestos o teclado. Los avisos se recogen en memoria. El motor sync conserva validación y cifrado actuales, pero su transporte de prueba responde en memoria: los GET/PUT registrados **no fueron tráfico de red**.

No se ejecutaron de nuevo escenarios para preparar este documento, ni se corrigió el harness. Se leyeron resultados ya existentes y las líneas necesarias para documentar los puntos originales. El único archivo creado en esta entrega es `workflow-appendix.md`; los scripts, resultados y archivos de aplicación actuales se conservan. Queda cerrada esta fase de auditoría con F06/F12 pendientes y con el calentamiento obligatorio expresamente fuera de los defectos.
