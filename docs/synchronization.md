# Sincronización de Hierro Beta

La PWA sigue alojada en GitHub Pages. Un Worker de Cloudflare y una base D1 conservan la copia cifrada; no se necesita una computadora encendida. Las claves y los datos de entrenamiento en claro nunca se envían al Worker.

## Uso

En **Tú → Sincronización**, crea tu espacio. Guarda la clave en tu gestor de contraseñas o descarga su archivo privado. En otro dispositivo usa **Ya tengo una clave**, o escanea el QR con su cámara. El QR se genera localmente con código incluido en la PWA: ningún servicio externo lo recibe.

Antes de vincular un dispositivo con datos, se muestran las cantidades de ambas copias. Puedes traer los datos de la nube o combinarlos con los locales. La app conserva una copia local anterior al cambio. Los cambios coincidentes se revisan campo por campo.

Los cambios se guardan primero en localStorage. La app envía con una pausa de 2,2 segundos después de editar y consulta cada 15 segundos mientras está visible; también al volver a ella o recuperar la conexión. El navegador puede suspender una PWA cerrada: la sincronización se reanuda al abrirla. No se promete ejecución en segundo plano.

Se comparten planes, días, ejercicios, rangos, reglas, notas, inventarios y máquinas de cada gimnasio, historial y sesión en curso. La apariencia, sonidos, notificaciones y el gimnasio seleccionado son preferencias locales. La unidad de cada gimnasio forma parte de su equipo. Al continuar una sesión se selecciona su gimnasio.

La sesión en curso tiene un dispositivo responsable. Otro dispositivo muestra **Continuar en este dispositivo** y hace una transferencia con conexión, conservando series, calentamientos y descanso. No se abre una segunda sesión sobre la primera. Si dos dispositivos entrenaron sin conexión al mismo tiempo, ambas versiones se conservan para revisión. Los cambios externos de equipo y programación esperan a que termine la sesión local, para no cambiar el significado de un peso ya escrito.

## Privacidad y límites

- Clave aleatoria de 256 bits obtenida con `crypto.getRandomValues`. Su checksum detecta errores al copiar; no añade entropía.
- HKDF-SHA-256 deriva por separado identidad, acceso al servidor y una clave AES-GCM de 256 bits. El servidor recibe el secreto de acceso derivado, conserva únicamente su hash SHA-256 y no puede derivar la clave de cifrado.
- Cada envío lleva un IV aleatorio de 96 bits. AES-GCM autentica además el protocolo, formato e identidad del espacio. Se comprime antes de cifrar cuando el navegador lo permite. Se limita también el tamaño al descomprimir.
- La clave del usuario y el estado de conciliación se guardan en IndexedDB, separados del respaldo de entrenamiento. Los enlaces QR usan un fragmento, que se retira de la dirección al abrirlo. Las solicitudes usan `credentials: omit`, `referrerPolicy: no-referrer` y HTTPS en producción.
- Quien tenga la clave puede leer y modificar el espacio. No hay recuperación por correo. Si se pierde, hace falta otro dispositivo aún vinculado o un respaldo descargado. Desvincular un dispositivo conserva su entrenamiento local y no revoca otras copias de la misma clave.
- El cifrado protege el contenido almacenado por el servicio. No protege un dispositivo desbloqueado, una clave compartida o código malicioso ejecutado en el mismo origen de la PWA. Como otras webs, Hierro confía en el código que publica el dueño del sitio.
- Límite inicial: 6 MiB de JSON por espacio, hasta 32 espacios en esta beta. El Worker corta cuerpos mayores de 9 MiB y divide los datos en filas de 400.000 caracteres. Estos límites mantienen el almacenamiento acotado sin contratar un plan de pago. El código no hace mejoras de plan automáticas.
- Cloudflare Free tiene cuotas. Cuando se agotan o falla el servicio, la app conserva el entrenamiento y muestra que falta sincronizar. No es una garantía de almacenamiento o disponibilidad ilimitados.

## Conciliación y recuperación

Se compara la copia local, la última copia reconocida y la copia remota. Los registros se identifican por ID, no por posición o fecha del dispositivo. Las altas independientes se combinan y las eliminaciones se propagan. Las series sin IDs y la sesión activa son unidades indivisibles. Dos ediciones incompatibles, eliminar contra editar, reordenar de formas distintas o borrar el plan de un día nuevo requieren una elección.

El servidor exige una revisión para actualizar. D1 ejecuta en una transacción el cambio de revisión, retirada de fragmentos y escritura de la nueva copia. Un envío antiguo recibe 409 y vuelve a combinar. La lectura de fragmentos pertenece a una sola revisión. Nunca se publica media copia.

El cliente conserva hasta tres copias previas en IndexedDB. En un conflicto se guardan las versiones local y remota. Pueden descargarse como respaldos normales desde **Copias de seguridad locales**. La base reconocida solo avanza después de incorporar la copia recibida al almacenamiento local; las ediciones hechas durante un envío quedan pendientes de la siguiente sincronización. Una respuesta perdida tras crear un espacio no pierde la clave ni crea otra cuenta.

El bloqueo de edición entre pestañas usa Web Locks cuando el navegador lo ofrece, con un aviso visible en las pestañas secundarias. Además, se comprueba el almacenamiento antes de guardar para detectar una pestaña antigua que no conozca ese bloqueo.

## Desarrollo y despliegue

```sh
npm ci --ignore-scripts
npm run test:sync
npm run sync:schema:local
npm run sync:dev
```

`sync:dev` inicia únicamente la copia local de desarrollo en el puerto 8787. Ese servidor no forma parte del servicio de producción.

Una sola vez, el dueño de la cuenta debe autorizar Wrangler en Cloudflare. Después:

1. Verificar que se use Workers Free, sin activar una suscripción de pago.
2. Crear una base D1 llamada `hierro-beta-sync` y poner su ID público de recurso en `sync-worker/wrangler.jsonc`.
3. Aplicar `sync-worker/schema.sql` a esa base mediante `wrangler d1 execute … --remote --file …`.
4. Publicar el Worker mediante `npm run sync:deploy` y comprobar `/health`.
5. Poner la URL HTTPS publicada en `HIERRO_SYNC_URL` de `sync.js`. No poner tokens de Cloudflare en el código ni en Pages.
6. Ejecutar todas las pruebas, construir `dist/` y publicar por el workflow habitual de GitHub Pages.
7. Verificar creación, vinculación y cambios en ambos sentidos contra el Worker publicado usando exclusivamente cuentas de prueba.

`.wrangler`, dependencias, archivos de entorno, backend y pruebas quedan fuera de `dist/`. El HTML de producción incluye de forma atómica la interfaz, estilos, criptografía, sincronización y QR, para no mezclar versiones con un service worker anterior. Las credenciales de despliegue nunca forman parte de los archivos publicados.

## Fuentes consultadas (14 de septiembre de 2026)

- [GitHub Pages: alojamiento estático](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages)
- [Workers: planes y cuotas](https://developers.cloudflare.com/workers/platform/pricing/)
- [D1: precios y cuotas](https://developers.cloudflare.com/d1/platform/pricing/)
- [D1: límites, incluyendo 500 MB por base Free y 2 MB por fila](https://developers.cloudflare.com/d1/platform/limits/)
- [D1: transacciones con batch](https://developers.cloudflare.com/d1/worker-api/d1-database/)
- [Worker: límites de solicitudes por binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
- [Nayuki: generador QR, licencia MIT conservada en qr.js](https://www.nayuki.io/page/qr-code-generator-library)

El generador se distribuye dentro de la app, sin dependencias en tiempo de ejecución. Wrangler y Miniflare se usan únicamente para desarrollo, pruebas y despliegue.

## Verificación de publicación

El 14 de septiembre de 2026 se confirmó en el panel de Cloudflare que el plan vigente es Free ($0). Se publicó el servicio en https://hierro-beta-sync.agustinmedrano01.workers.dev. La comprobación con dos clientes independientes contra ese servicio validó vinculación, cambios en ambos sentidos, reconexión, conflictos, CORS y rechazo de otra clave; el espacio de prueba se eliminó al terminar.

La revisión de navegador usó copias aisladas a 390 y 1280 px: vinculación, cambio de nombre, traspaso de sesión durante el descanso de calentamiento, finalización del calentamiento, registro de una serie y recepción del historial y su PR en el primer dispositivo. No se modificaron datos personales ni se usó una clave existente para las pruebas.
