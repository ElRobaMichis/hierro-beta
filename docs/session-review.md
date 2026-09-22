# Revisión de la pantalla de series · 3.3.1

## Análisis antes de cambiar la interfaz

Se reprodujo la versión 3.3.0 con una sesión de prueba y calentamiento completado. Se tomaron capturas del navegador a 400 × 907 y 320 × 740, tanto de una torre con ajustes finos como de una barra con varios discos por lado. Los datos personales no se utilizaron.

En la torre, el SVG tenía 100 px de alto dentro de un espacio de 62 px. A 400 px, su borde inferior llegaba a y=535 mientras el texto de carga cercana comenzaba en y=504. El dibujo invadía la explicación. Una torre completa de 50 placas a ese tamaño tampoco permitía contar bien las placas.

El botón de calentamiento completado seguía ocupando una tarjeta después de acabar su tarea. Sumado a nota, montaje, fila de serie/aplicar, propuesta, campos, RIR e instrucciones permanentes, producía demasiados bloques antes de registrar. El botón principal comenzaba en y=856 y terminaba en y=912, parcialmente fuera de la pantalla de 907 px.

La propuesta estaba separada de su acción de aplicar. La cantidad escrita, la propuesta y la carga realizable podían ser distintas, pero sus etiquetas eran pequeñas y las explicaciones se mezclaban con el dibujo. En barra, la ilustración lateral también quitaba espacio a la lista de discos por lado.

## Decisiones

1. El calentamiento guía antes del trabajo y deja de ocupar la pantalla al completarse. Su consulta sigue en el menú existente del ejercicio. También se retira la tarjeta de acceso directo cuando no hace falta calentar.
2. El montaje principal muestra la indicación que se puede leer de un vistazo: placa y ajuste fino, discos por lado o mancuerna por mano. El dibujo completo y el cálculo siguen accesibles al tocar «Ver montaje».
3. La propuesta y su acción se presentan juntas. Los pesos reales del borrador no se sustituyen al reorganizar la pantalla.
4. La nota conserva su tamaño legible y su tratamiento destacado durante preparación y trabajo; deja de repetirse durante descanso y al completar el ejercicio.
5. Se acorta la etiqueta de esfuerzo. La explicación de RIR se mantiene al abrirlo. Las instrucciones sobre aplicar y registrar pasan al detalle de la propuesta; el estado bajo el botón solo aparece como respuesta a una acción.

La jerarquía buscada es: ejercicio y nota → serie/propuesta → montaje → registro → esfuerzo opcional → confirmar. Los controles de peso, la doble progresión, los descansos y la persistencia conservan su comportamiento.

## Comprobación del resultado

Con los mismos datos de la torre, título y nota de dos líneas a 400 × 907, el botón de registrar pasó de y=856–912 a y=799–855: quedó completamente visible. El peso escrito siguió siendo 65 lb; reorganizar la pantalla no lo sustituyó por los 65,5 lb de la propuesta.

Las capturas finales cubrieron torre con ajustes finos, barra con varios discos, mancuernas y descanso. También se revisaron 320 px y 820 px, modos claro y oscuro. No hubo desbordamiento horizontal en las anchuras probadas. Los controles principales conservaron alturas de al menos 44 px. Una pantalla más baja o una nota más larga puede requerir desplazamiento vertical: no se recorta la nota ni se reducen las áreas táctiles para forzar que todo quepa.

Al probar los botones apareció un segundo problema: las conversiones a kilos hacían que una torre marcada como 65,5 lb siguiera mostrando «carga más cercana» aun después de aplicar exactamente 65,5 lb. Se corrigió la comparación de presentación usando la etiqueta nativa y la precisión del almacenamiento. Los cambios físicos de carga siguen mostrándose; los redondeos invisibles dejan de generar avisos. La propuesta conserva además los tres decimales de los ajustes finos cuando corresponda.

Se recorrieron aplicar, deshacer, montaje detallado, esfuerzo, registrar, descanso, repetir serie, consulta del calentamiento y recarga. El navegador no informó errores de JavaScript. Las pruebas existentes de progresión, calentamiento obligatorio, registro, actualización y uso sin conexión se mantienen, con comprobaciones adicionales para el aviso de redondeo.

## 3.10.1 · la barra de acción que se quedaba flotando en iPhone

La barra fija de «Registrar serie» y «Completé este calentamiento» sube con `--keyboard-inset` para no quedar bajo el teclado. Ese hueco se medía solo cuando `visualViewport` avisaba de un cambio. En iOS, y más en la app instalada, ese aviso no llega cuando el teclado se cierra porque el campo desaparece al redibujar la pantalla, por ejemplo al confirmar la carga prevista del calentamiento. La última medida, la del teclado abierto, se quedaba aplicada: la barra flotaba unos centímetros sobre el borde y tapaba «Ejercicio» y el selector de gimnasio hasta reiniciar la app.

Ahora el hueco solo existe mientras hay un campo de texto enfocado y conectado a la página; sin él es cero aunque el navegador conserve una medida vieja. Además se vuelve a medir al ganar o perder el foco, al volver a la app, al girar, al cambiar el tamaño de la ventana y después de cada redibujado, con tres comprobaciones diferidas que cubren la animación del teclado. Es la única barra fija que depende del teclado; la navegación superior y el aviso de pestañas no usan ese valor.

## 3.11.2 · la barra que se despegaba al volver de otra app

Era un segundo caso, distinto del teclado. Al regresar a la app desde una notificación, iOS puede dejar la parte visible de la pantalla desplazada respecto a la página; `visualViewport.offsetTop` queda en positivo sin que nadie haya hecho scroll. Un elemento fijo se ancla a la página, no a lo visible, así que la barra aparecía a media pantalla con contenido debajo hasta que un redibujado con `scrollTo(0,0)` realineaba las dos. La corrección de 3.10.1 no lo cubría porque ahí el hueco del teclado ya era cero.

Ahora, sin campo enfocado, ese desplazamiento se compensa en la propia barra con `--viewport-shift`, que la baja hasta el borde visible, y se pide a la página realinearse desplazándola exactamente ese offset, para que nada salte. La realineación se limita a una cada 600 ms. Con el teclado abierto no se aplica: ahí manda `--keyboard-inset`. Se vuelve a medir también al recuperar el foco de la ventana.
