# Hierro Beta

Prueba la aplicación en **https://elrobamichis.github.io/hierro-beta/**.

Abre ese enlace en tu teléfono y añádelo a la pantalla de inicio. Se instala como **Hierro Beta**. Después del primer acceso con conexión, la app puede abrir sin internet.

Los planes y el historial se guardan en tu dispositivo. Puedes restaurar un respaldo de Hierro desde **Tú → Datos y respaldos**. Esta beta utiliza almacenamiento y cachés independientes de la aplicación principal; importar o editar aquí no cambia sus datos. No hay sincronización automática entre dispositivos.

Desde la versión 3.3.0, los ejercicios que requieren calentamiento empiezan con una preparación guiada y descansos de 30 segundos, ampliables a un minuto. Al terminar aparecen las series de trabajo. Consulta los [criterios y funcionamiento del calentamiento](docs/warmups.md).

La versión 3.3.1 simplifica la pantalla de series y mantiene los dibujos de carga en «Ver montaje». El [análisis de la interfaz](docs/session-review.md) recoge los problemas observados, las decisiones y la verificación visual.

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
