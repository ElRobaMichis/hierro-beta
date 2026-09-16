# Calentamiento guiado · 3.7.0

Al abrir un ejercicio que requiere preparación, la sesión muestra una aproximación a la vez. El formulario de series de trabajo aparece cuando la persona termina el recorrido. Las notas del equipo se mantienen visibles.

Cada calentamiento se confirma por separado. Después hay 30 segundos de descanso. Tras el último escalón de un rango pesado, el que ronda el 80 % de la carga, el descanso base antes del trabajo es de 60 segundos. Una ampliación añade 30 segundos al plazo original; el máximo es de 60 segundos tras un escalón ligero y de 90 tras el pesado. Al acabar, el siguiente paso queda habilitado: la app nunca registra ni avanza por sí sola. La persona puede tardar más en continuar.

En ejercicios por tiempo hay 3 segundos para colocarse y un temporizador corto, independiente del cronómetro de las series de trabajo. Se respetan las preferencias existentes de sonido y vibración. Los avisos dependen de lo que permita el navegador en segundo plano; los plazos guardados permiten recuperar el tiempo correcto al volver.

## Decisiones de programación

Son reglas de la aplicación, no una medición de temperatura muscular ni una valoración individual de seguridad. No se infiere que todo el cuerpo esté preparado por haber visitado una pantalla.

- La escalera depende de la intensidad relativa de la serie de trabajo, estimada por el tope del rango de repeticiones, no del ejercicio ni del equipo. El escalón que importa es el de ~80 % con pocas repeticiones; los ligeros preparan la técnica.
- Tope de hasta 6 reps: aproximaciones al 40 × 5, 60 × 3 y 80 % × 2 del peso de trabajo; con preparación reciente del mismo grupo quedan 60 × 3 y 80 % × 2.
- Tope de 7 u 8 reps (≈80 % del 1RM): 50 % × 5 y 80 % × 3; con preparación reciente del mismo grupo, solo 80 % × 3. Estos rangos cuentan como pesados: nunca se omite la preparación, aunque el grupo tenga trabajo confirmado.
- Tope de 9 a 12 reps: 55 % × 5 y 80 % × 4 como primer trabajo del grupo. Con preparación o trabajo reciente del mismo grupo se permite empezar directamente.
- Tope de 13 reps o más: una aproximación al 70 % × 6 como primer trabajo del grupo; en otro caso, acceso directo.
- Cuando el equipo no baja más (carro de una máquina de discos, barra vacía, primera placa) y varios escalones caen en la misma carga, se conserva un solo escalón con las repeticiones del más pesado. Un hack squat con carro de 47,6 kg y trabajo a 57,6 kg prepara con el carro vacío × 3, no × 6.
- Tras 30 minutos sin actividad conocida de ese grupo, se deja de asumir preparación previa. Es un umbral de producto conservador, no un tiempo fisiológico demostrado.
- No existe un corte universal de 12 kg. La omisión por carga ligera exige una carga de hasta el 60 % de un peso de trabajo registrado en ese ejercicio en los últimos 28 días, fuera de rango de fuerza. Exige que el registro conserve el mismo contexto de gimnasio, equipo, base y número de manos. Los respaldos antiguos sin ese contexto no activan esta omisión. Se limita a cargas libres; torres y máquinas de discos no usan esa comparación porque su mecánica puede cambiar. Estos umbrales son decisiones de producto.
- Cada carga se ajusta al inventario real, incluida la barra, discos por lado, mancuernas por mano y límites de placas y ajustes finos. Se eliminan escalones repetidos o que alcancen el peso de trabajo. Si no existe una carga menor, se prescribe práctica suave sin carga o con apoyo, sin inventar equipo.
- Peso corporal: pocas repeticiones fáciles sin lastre, con apoyo si hace falta. Por tiempo: duración corta sin lastre, proporcional al objetivo y hasta 10 segundos. En asistidos se aumenta la ayuda dentro del máximo de la máquina.
- Cuando falta la referencia de carga, se pide únicamente el peso previsto para calcular la preparación. No se confirma una serie ni se rellenan repeticiones realizadas.
- Un ejercicio al que se le ofrece acceso directo permite solicitar el calentamiento guiado desde su explicación.

Los porcentajes son de la carga de trabajo, no del 1RM. La selección de grupo usa la asignación principal existente: no se inventa trabajo de músculos secundarios ni se agrupan automáticamente cuádriceps e isquiotibiales.

La evidencia apoya dar más atención a la preparación específica al trabajar pesado, pero no establece que una única escalera sea óptima para todos los ejercicios. Ningún metaanálisis valida una escalera concreta; los porcentajes anteriores siguen los ensayos con mejor resultado. [Ribeiro et al. (2020)](https://www.jomh.org/articles/10.31083/jomh.2021.069) mejoraron la velocidad en sentadilla y press con 40 y 80 % de la carga de trabajo, y las cargas ligeras solas no tuvieron efecto. [Viveiros et al. (2024)](https://www.sciencedirect.com/science/article/abs/pii/S1360859224004017) obtuvieron más volumen total con una serie de 5 al 80 % del 10RM que con 15 al 40 % o 10 al 60 %. Con cargas de unas 10 repeticiones, [Ribeiro et al. (2014)](https://journals.sagepub.com/doi/10.2466/25.29.PMS.119c17z7) y un [ensayo de 2025](https://sportrxiv.org/index.php/server/preprint/view/559) no encontraron diferencia entre calentar y no calentar. [Enes et al. (2024)](https://pmc.ncbi.nlm.nih.gov/articles/PMC11243969/) mostraron que una serie al 90 % solo mejora la primera serie de trabajo, por lo que no se prescribe potenciación pesada. El descanso de un minuto tras el escalón pesado sigue el protocolo de la NSCA para aproximaciones de 3 a 5 repeticiones. La revisión de [Iversen et al. (2021)](https://link.springer.com/article/10.1007/s40279-021-01490-1), sección 8.1, describe resultados variados según protocolo y carga. El estudio de [Ribeiro et al. (2020)](https://www.mdpi.com/1660-4601/17/18/6882) compara protocolos específicos en sentadilla y press de banca. Esas fuentes orientan las decisiones; no validan los umbrales exactos de esta app ni garantizan prevenir lesiones.

## Estado y compatibilidad

`active.exercises[].warmup` guarda el plan, identificador, contexto del equipo, paso confirmado, fase y plazos absolutos. Vive fuera de `sets`; no interviene en volumen, PR, doble progresión ni historial de series de trabajo. No requiere red.

Cambiar de ejercicio o recargar conserva los pasos y descansos. Un identificador y número de paso rechazan eventos atrasados y dobles toques. Cambiar el equipo o aumentar la carga antes de la primera serie de trabajo recalcula la preparación. Bajar una carga ya preparada conserva la preparación. Las sesiones antiguas con `warmupDone` o trabajo confirmado siguen funcionando.

Desde 3.7.0, el plan guarda `heavy`; los estados antiguos sin ese campo usan 30 segundos de descanso en todos los escalones y se validan igual.

Desde 3.6.3, corregir únicamente el ajuste fino o las notas de montaje conserva las aproximaciones realizadas si la carga prevista sigue igual o es menor. Una preparación terminada permanece terminada. En una preparación parcial se conserva el descanso original y se recalculan solo los escalones pendientes. Cambiar de gimnasio, el salto principal, la unidad o aumentar la carga mantiene la comprobación del contexto completo.

Las pruebas de `tests/run.js` recorren preparación, temporizador, ampliación, recarga, cambio de ejercicio/equipo, registro bloqueado, casos corporales/asistidos y exclusión de historial. El resto de pruebas comprueba el arranque, actualización, distribución y funcionamiento sin conexión.
