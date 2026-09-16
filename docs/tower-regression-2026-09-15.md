# Torre con ajuste fino · beta 3.6.3

Se reprodujo una propuesta de 85 lb que cambiaba a 70 lb al habilitar un ajuste fino, mientras el borrador seguía en 85 y el calentamiento volvía a empezar. El montaje seguía correctamente el borrador de 85 (placa 6), pero se mostraba junto a una propuesta distinta. Había errores de cálculo y de conservación del estado, no un cambio real en el peso de la placa.

La progresión redondeaba primero por el salto de la torre y después por sus combinaciones disponibles. Esa doble aproximación ignoraba el inicio de la torre y podía saltarse cargas válidas. Ahora parte de la carga histórica y selecciona directamente una combinación de placa y ajuste, en la dirección del progreso. Se conservan el mínimo explícito y el máximo físico; si el mínimo rebasa la última combinación, se llega al tope disponible.

## Caso de regresión

Historial: 62,5 lb, dos series de 13 y 10 repeticiones, ambas con RIR 0. Objetivo: dos series, rango 6–8. Torre: primera placa de 10 lb, salto de 15 lb, máximo principal de 160 lb.

| Configuración | Propuesta | Montaje |
| --- | --- | --- |
| Sin ajuste fino | 70 lb × 6 | Placa 5 de 70 lb |
| Ajuste de 5 lb, máximo 10 lb | 65 lb × 6 | Placa 4 de 55 lb + 10 lb |
| Carga manual de 85 lb | Se conserva lo escrito | Placa 6 de 85 lb |

El ajuste fino no cambia la numeración ni el peso base. Se verificaron las 33 combinaciones de esta torre. Otra prueba usa una torre habitual de 10 en 10 lb con dos ajustes de 2,5 lb: permite 65 lb y conserva su configuración al cambiar de gimnasio. La capacidad de dos ajustes es explícita en ese escenario; no se inventan accesorios cuando falta el máximo.

## Estado de la sesión

- El borrador identifica la carga rellenada por la app. Al editar el equipo se actualiza junto a la propuesta; escribir un peso manual elimina esa identificación.
- Las series confirmadas y los pesos manuales se conservan. El montaje muestra base, ajuste y total, e identifica una carga escrita distinta de la propuesta.
- Corregir únicamente el ajuste fino o la nota conserva la preparación realizada para una carga igual o mayor. Los calentamientos pendientes conservan su descanso y sus aproximaciones confirmadas. Cambios de máquina o aumentos reales mantienen la comprobación de preparación.
- Al arrancar una versión nueva se recalculan las propuestas guardadas en sesiones abiertas. Los borradores antiguos sin identificación de origen se conservan: «Aplicar» permite sustituirlos explícitamente. El guardado de esta actualización es transaccional.

## Verificación

895 comprobaciones del motor y recorrido de sesión, incluidas 39 nuevas regresiones; 34 + 35 de uso sin conexión; 21 + 21 de arranque/actualización; 19 de distribución beta; 71 de sincronización y 74 de avisos. Total: 1170. Se usan el motor real, controladores reales y un reloj simulado para recorrer los descansos; no se prueban copias de las fórmulas.

La herramienta de navegador no ofrecía superficies disponibles en esta sesión. La comprobación de la presentación se limita al HTML generado y a la revisión del CSS existente; no se añaden capturas ni se afirma una validación visual en teléfono.
