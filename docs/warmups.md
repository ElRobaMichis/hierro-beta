# Calentamiento guiado · 3.3.0

Al abrir un ejercicio que requiere preparación, la sesión muestra una aproximación a la vez. El formulario de series de trabajo aparece cuando la persona termina el recorrido. Las notas del equipo se mantienen visibles.

Cada calentamiento se confirma por separado. Después hay 30 segundos de descanso, también antes de pasar a trabajo. Una ampliación añade 30 segundos al plazo original; no se pueden programar más de 60 segundos. Al acabar, el siguiente paso queda habilitado: la app nunca registra ni avanza por sí sola. La persona puede tardar más en continuar.

En ejercicios por tiempo hay 3 segundos para colocarse y un temporizador corto, independiente del cronómetro de las series de trabajo. Se respetan las preferencias existentes de sonido y vibración. Los avisos dependen de lo que permita el navegador en segundo plano; los plazos guardados permiten recuperar el tiempo correcto al volver.

## Decisiones de programación

Son reglas de la aplicación, no una medición de temperatura muscular ni una valoración individual de seguridad. No se infiere que todo el cuerpo esté preparado por haber visitado una pantalla.

- Rango de fuerza (tope de 7 reps): aproximaciones al 40, 60 y 80 % del peso de trabajo; se reducen a dos con preparación reciente del mismo grupo principal.
- Otros rangos con carga: dos aproximaciones al 50 y 75 %. Si solo hay calentamiento previo del mismo grupo, queda una aproximación. Con trabajo confirmado reciente del mismo grupo se permite empezar directamente.
- Tras 30 minutos sin actividad conocida de ese grupo, se deja de asumir preparación previa. Es un umbral de producto conservador, no un tiempo fisiológico demostrado.
- No existe un corte universal de 12 kg. La omisión por carga ligera exige una carga de hasta el 60 % de un peso de trabajo registrado en ese ejercicio en los últimos 28 días, fuera de rango de fuerza. Exige que el registro conserve el mismo contexto de gimnasio, equipo, base y número de manos. Los respaldos antiguos sin ese contexto no activan esta omisión. Se limita a cargas libres; torres y máquinas de discos no usan esa comparación porque su mecánica puede cambiar. Estos umbrales son decisiones de producto.
- Cada carga se ajusta al inventario real, incluida la barra, discos por lado, mancuernas por mano y límites de placas y ajustes finos. Se eliminan escalones repetidos o que alcancen el peso de trabajo. Si no existe una carga menor, se prescribe práctica suave sin carga o con apoyo, sin inventar equipo.
- Peso corporal: pocas repeticiones fáciles sin lastre, con apoyo si hace falta. Por tiempo: duración corta sin lastre, proporcional al objetivo y hasta 10 segundos. En asistidos se aumenta la ayuda dentro del máximo de la máquina.
- Cuando falta la referencia de carga, se pide únicamente el peso previsto para calcular la preparación. No se confirma una serie ni se rellenan repeticiones realizadas.
- Un ejercicio al que se le ofrece acceso directo permite solicitar el calentamiento guiado desde su explicación.

Los porcentajes son de la carga de trabajo, no del 1RM. La selección de grupo usa la asignación principal existente: no se inventa trabajo de músculos secundarios ni se agrupan automáticamente cuádriceps e isquiotibiales.

La evidencia apoya dar más atención a la preparación específica al trabajar pesado, pero no establece que una única escalera sea óptima para todos los ejercicios. La revisión de [Iversen et al. (2021)](https://link.springer.com/article/10.1007/s40279-021-01490-1), sección 8.1, describe resultados variados según protocolo y carga. El estudio de [Ribeiro et al. (2020)](https://www.mdpi.com/1660-4601/17/18/6882) compara protocolos específicos en sentadilla y press de banca. Esas fuentes orientan las decisiones; no validan los umbrales exactos de esta app ni garantizan prevenir lesiones.

## Estado y compatibilidad

`active.exercises[].warmup` guarda el plan, identificador, contexto del equipo, paso confirmado, fase y plazos absolutos. Vive fuera de `sets`; no interviene en volumen, PR, doble progresión ni historial de series de trabajo. No requiere red.

Cambiar de ejercicio o recargar conserva los pasos y descansos. Un identificador y número de paso rechazan eventos atrasados y dobles toques. Cambiar el equipo o aumentar la carga antes de la primera serie de trabajo recalcula la preparación. Bajar una carga ya preparada conserva la preparación. Las sesiones antiguas con `warmupDone` o trabajo confirmado siguen funcionando.

Desde 3.6.3, corregir únicamente el ajuste fino o las notas de montaje conserva las aproximaciones realizadas si la carga prevista sigue igual o es menor. Una preparación terminada permanece terminada. En una preparación parcial se conserva el descanso original y se recalculan solo los escalones pendientes. Cambiar de gimnasio, el salto principal, la unidad o aumentar la carga mantiene la comprobación del contexto completo.

Las pruebas de `tests/run.js` recorren preparación, temporizador, ampliación, recarga, cambio de ejercicio/equipo, registro bloqueado, casos corporales/asistidos y exclusión de historial. El resto de pruebas comprueba el arranque, actualización, distribución y funcionamiento sin conexión.
