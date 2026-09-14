# Evolución, equipo y espacios · 3.3.2

## Análisis

Antes de editar se revisó la beta 3.3.1 con un historial sintético de 36 sesiones. Las capturas mostraron que consultar una semana tapaba la gráfica con una ventana. El contenedor estaba marcado como una imagen, aunque sus barras eran botones, por lo que sus controles tampoco aparecían individualmente en el árbol de accesibilidad.

En «Tú», la marca decorativa «h.» y la versión estaban dentro de una columna oculta en móvil. En el diario se midieron 0 px entre la última división y «Mostrar más sesiones». En el día «Full body», el botón «Opciones» ocupaba su propia fila y dejaba 83 px entre el final del título y «Consultar otro día» a 400 × 907.

Los dibujos de equipo heredaban los trazos generales de los iconos y tenían poca diferenciación visual. La torre de 50 placas resultaba especialmente difícil de leer sin un número junto al pin.

## Gráfica y referencia semanal

La barra seleccionada actualiza fecha, volumen, sesiones y comparación dentro de la misma tarjeta. Se puede seleccionar con el puntero, al tocarla o al enfocarla con el teclado. La actualización no vuelve a montar la página ni abre una ventana. La gráfica conserva sus ocho semanas y señala el promedio con una línea discontinua.

«Promedio» es la media aritmética. Se calcula con hasta cuatro semanas de calendario completas anteriores a la semana en curso, empezando como pronto en la semana del primer registro. Se incluyen las semanas sin actividad dentro de ese periodo. No se inventan semanas vacías anteriores al historial. El detalle «Cómo leer tu volumen» explica estos criterios.

La semana en curso no entra en el cálculo. Con un promedio de 6 000 kg y 2 000 kg esta semana, el mensaje es «Llevas el 33% de tu promedio semanal». Con 7 200 kg, se supera esa referencia en un 20%. Los mensajes distinguen una semana en curso de una cerrada; no presentan una semana parcial como un retroceso. Con menos de una semana cerrada o con promedio cero se muestra una explicación, sin dividir entre cero. La referencia se calcula en la unidad interna; cambiar entre kilos y libras no modifica los porcentajes.

El volumen sigue siendo peso × repeticiones y conserva las exclusiones existentes de asistencia y tiempo. El promedio no modifica las propuestas de carga, el volumen recomendado ni la progresión. La interfaz aclara que más volumen por sí solo no indica más fuerza.

## Equipo y distribución

- Barra con agarre, cierres y perfiles de discos diferenciados. El conjunto se escala para mantener visibles todos los discos.
- Discos con aro, centro y agarres en la lista de montaje; sus cantidades y pesos siguen escritos al lado.
- Mancuerna hexagonal con el peso indicado en sus cabezas.
- Torre con materiales distintos para placas activas e inactivas, pin visible y número junto a la placa seleccionada. El indicador conserva su posición física, incluso en torres largas. Los dibujos son SVG de la aplicación y funcionan sin recursos externos.
- «Tú» identifica Hierro y su versión tanto en móvil como en escritorio.
- El botón del diario queda separado por 24 px y mantiene la paginación.
- En móvil, «Opciones» comparte fila con el título del día. La separación medida antes del selector pasa de 83 a 20 px, conservando un control táctil de 44 px de alto.

## Verificación

Se compararon capturas en ventanas de navegador de 320 × 740, 400 × 907, 820 × 1180 y 1280 × 900, incluyendo los temas claro y oscuro. No se observó desbordamiento horizontal. Las barras conservaron 26 px de ancho y toda la altura de la gráfica como área táctil en la ventana más estrecha. Se verificaron la consulta integrada, el teclado, la entrada del puntero, la paginación de 30 a 36 sesiones, la versión móvil, las opciones y el selector de día, los montajes y la torre durante el calentamiento.

934 comprobaciones automatizadas aprobadas: 826 del motor y la interfaz, 26 de uso sin conexión, 21 de actualización, 13 de la distribución beta, 27 sin conexión en beta y 21 de actualización en beta. Las nuevas comprobaciones cubren porcentajes, semanas vacías, historial corto, ausencia de referencia, unidades y posición del pin en torres de 50 placas.

La revisión utilizó datos de prueba aislados. Las dimensiones de navegador no equivalen a una prueba en un iPhone físico.
