# Hierro Beta

Prueba la aplicación en **https://elrobamichis.github.io/hierro-beta/**.

Abre ese enlace en tu teléfono y añádelo a la pantalla de inicio. Se instala como **Hierro Beta**. Después del primer acceso con conexión, la app puede abrir sin internet.

Los planes y el historial se guardan en tu dispositivo. Puedes restaurar un respaldo de Hierro desde **Tú → Datos y respaldos**. Esta beta utiliza almacenamiento y cachés independientes de la aplicación principal; importar o editar aquí no cambia sus datos. La sincronización cifrada es opcional: crea o vincula tu espacio desde **Tú → Sincronización**. Los avisos remotos se activan por dispositivo y necesitan internet.

La versión **3.14.0** celebra lo que viene: al abrir un día, cada propuesta se revela al verla y «Subir carga» hace rodar el peso hasta el nuevo con destellos y una escala que sube. Al registrar, llegar al tope del rango se anuncia en el momento. Consulta [la sección 3.14.0](docs/motion-sound-2026-09-23/README.md#3140--lo-que-viene-se-celebra).

La versión **3.13.0** añade movimiento y sonido sin cambiar el diseño. Las vistas entran con suavidad, los números cuentan, los relojes ruedan y el póster final celebra con confeti, fanfarria y el dibujo de su comparación. Registrar una serie, calentar y terminar un descanso tienen sonidos propios, sintetizados en el dispositivo y disponibles sin conexión. Todo respeta Sonido, Vibración, Animaciones y «Reducir movimiento». Consulta [qué se mueve y qué suena](docs/motion-sound-2026-09-23/README.md).

La versión **3.6.2** alinea las tarjetas de la derecha con las de la izquierda en preferencias de sesión y objetivos del ejercicio. Comparten filas y altura en escritorio; el móvil conserva una sola columna. Consulta la [verificación de las dos filas y sus capturas](docs/ui-row-alignment-2026-09-14/README.md).

La versión **3.6.1** unifica el ancho, los márgenes interiores y la separación de las tarjetas de preferencias de sesión y objetivos del ejercicio. «Probar aviso» tiene espacio propio debajo de vibración. Consulta la [comprobación con capturas](docs/ui-panel-alignment-2026-09-14/README.md).

La versión **3.6.0** aplica el análisis de experiencia conservando el estilo, los degradados y las animaciones de Hierro. Acerca el registro de series al pulgar, compacta los días y el inventario, distingue carga real de fuerza estimada, permite retomar el cronómetro y mejora la recuperación de cambios. Consulta la [revisión de la implementación y sus capturas](docs/ui-refinement-2026-09-14/README.md).

Desde la versión 3.3.0, los ejercicios que requieren calentamiento empiezan con una preparación guiada y descansos de 30 segundos, ampliables a un minuto. Al terminar aparecen las series de trabajo. Consulta los [criterios y funcionamiento del calentamiento](docs/warmups.md).

La versión 3.3.1 simplifica la pantalla de series y mantiene los dibujos de carga en «Ver montaje». El [análisis de la interfaz](docs/session-review.md) recoge los problemas observados, las decisiones y la verificación visual.

La versión 3.3.2 permite explorar el volumen semanal dentro de la gráfica y compararlo con el promedio de hasta cuatro semanas completas anteriores. También renueva los dibujos del equipo, muestra la versión en móvil y mejora el espacio en el diario y en el encabezado de cada día. Consulta los [criterios del promedio y la revisión visual](docs/evolution-review.md).

## Desarrollo

El código de la aplicación está en la raíz. No requiere instalar dependencias de npm. Usa Node.js 24 para las comprobaciones:

```sh
node tests/run.js
node tests/offline.js
node tests/upgrade.js
node scripts/build-beta.js
node tests/beta.js
node tests/offline.js --beta
node tests/upgrade.js --beta
```

Para probar la distribución exacta que se publica:

```sh
python -m http.server 4174 --directory dist
```

La construcción cambia el nombre instalable y los espacios de almacenamiento/caché, conservando el formato de los respaldos y el motor de entrenamiento. La versión 3.2.3 entrega el motor, la interfaz y los estilos en un mismo documento para evitar bloqueos al abrir o actualizar. Los archivos separados se conservan para la compatibilidad con instalaciones anteriores.

## Publicación

Cada cambio en `main` ejecuta las comprobaciones y publica únicamente `dist/` mediante GitHub Actions y GitHub Pages. Las pruebas, archivos de desarrollo y respaldos locales no forman parte de la web. El repositorio principal permanece independiente.
