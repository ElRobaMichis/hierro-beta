# Notificaciones de entrenamiento · 3.5.0

Hierro conserva su frontend en GitHub Pages. El Worker existente programa los avisos en Durable Objects con almacenamiento SQLite y alarmas, disponibles en Cloudflare Free. El navegador no necesita permanecer abierto ni la computadora encendida.

## Activación

1. En el dispositivo donde entrenas, crea o vincula tu espacio de sincronización.
2. Abre **Tú → Notificaciones → Activar notificaciones** y concede el permiso.
3. Usa **Probar con pantalla bloqueada**: programa un aviso a los diez segundos. La prueba se ofrece sin una sesión en curso para no reemplazar sus avisos.

En iPhone/iPad se requiere iOS/iPadOS 16.4 o posterior y abrir Hierro como una app añadida a la pantalla de inicio. No basta con tener una pestaña abierta en Orion, Safari u otro navegador. El permiso se solicita únicamente como respuesta al botón. Sonido, presentación y modos de concentración dependen del sistema.

## Avisos

- Al terminar el descanso de trabajo o calentamiento, el aviso indica la siguiente serie o aproximación, ejercicio, carga disponible, unidad, placa y ajuste fino. En barras y mancuernas indica el montaje correspondiente. Usa el mismo cálculo de equipo que la pantalla de entrenamiento, sin inferir pesos inexistentes.
- El recordatorio de inactividad se programa una sola vez por pausa, después de cinco minutos sin confirmar una serie. Respeta el descanso prescrito y deja al menos un minuto adicional: un descanso de cinco minutos no genera una advertencia mientras sigue activo. Escribir un borrador no cuenta como confirmar una serie.
- Los detalles pueden ocultarse de la pantalla bloqueada. La preferencia y la suscripción pertenecen a cada dispositivo.
- Ampliar, saltar, cambiar ejercicio, finalizar o descartar reemplaza o cancela los avisos anteriores. La transferencia sincronizada de sesión traslada la programación al nuevo responsable y rechaza una revisión anterior.
- Tocar un aviso abre la sesión correspondiente. No registra series ni salta calentamientos. Si esa sesión terminó, abre el inicio.

La sesión se guarda primero en el dispositivo. La programación no bloquea el registro. La pantalla confirma **Avisos programados** solo tras recibir la respuesta del servidor. Sin internet puedes seguir entrenando, pero no se pueden programar avisos nuevos; se reintenta al volver a tener conexión. El aviso depende también de que el teléfono tenga conexión para recibirlo.

Web Push no es una alarma exacta: red, ahorro de batería, concentración o el proveedor pueden retrasar la entrega. El reloj de la app sigue siendo la referencia. Los avisos tienen una ventana de entrega corta (90 segundos), reintentos limitados y una etiqueta estable para no acumular banners. Un mensaje ya en tránsito no puede retirarse del proveedor; si queda obsoleto, el service worker muestra un texto genérico y silencioso, nunca una carga antigua. WebKit exige que cada push produzca una notificación visible.

Los pitidos de los últimos tres segundos siguen funcionando en primer plano. La web no puede seleccionar un sonido personalizado del sistema ni garantizar vibración en iPhone.

## Privacidad y operación

`push-core.js` cifra el mensaje en el cliente mediante el protocolo Web Push (ECDH P-256, HKDF-SHA-256, AES-GCM). La suscripción entrega sus claves al código local; **Cloudflare no recibe ni esas claves ni el contenido legible del aviso**. El servidor guarda el endpoint, identificadores opacos, revisiones, horarios y bytes cifrados. No recibe la clave de recuperación de sincronización.

La clave privada VAPID es el secreto `VAPID_JWK` del Worker. `/push/config` publica únicamente la clave pública. La clave privada no está en el repositorio ni en Pages. Para conservar suscripciones, no debe rotarse sin preparar su renovación en los dispositivos.

Solo un espacio existente y autenticado puede registrar avisos. Se admiten hasta ocho dispositivos por espacio y dos avisos pendientes para la sesión responsable. Los endpoints se restringen a los proveedores de Apple, Google, Mozilla y Microsoft; no se siguen redirecciones. Se conservan los límites de solicitudes y espacios de la beta. Una suscripción rechazada con 404/410 se retira. Borrar un espacio purga su programador. No se habilitó ningún plan de pago.

Las solicitudes llevan una secuencia por dispositivo, y los cambios de responsable necesitan una revisión de sincronización más reciente. Los identificadores de eventos permiten detectar reintentos. Las alarmas son de ejecución al menos una vez; no se promete entrega exactamente una vez ante fallos entre un envío y su confirmación.

## Verificación

`npm run test:push` verifica cifrado con un receptor independiente, firma VAPID, validación de endpoints, cálculo de cargas y calentamientos, programación, cambios sin conexión, cancelación durante cifrado, transferencia, orden de solicitudes, alarmas reales de workerd y comportamiento del service worker. El workflow también conserva las pruebas del motor, sincronización, instalación y actualización offline.

La revisión visual usó datos sintéticos aislados a 375 y 1265 px, con temas claro y oscuro. Se comprobó el cambio del modo privado y el acceso desde Tú. No se modificaron datos personales.

`node scripts/check-push-live.js <URL-del-Worker>` crea un espacio desechable, programa una alarma en Cloudflare y comprueba el intento de envío a un endpoint deliberadamente inválido del proveedor. Después elimina el espacio y su programador. Esto verifica el servidor real, **no la recepción en un teléfono físico**. La recepción se confirma con el botón de prueba en el dispositivo del usuario.

## Fuentes consultadas

- [WebKit: Web Push en apps añadidas al inicio, permisos e iPhone](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/)
- [Cloudflare: alarmas de Durable Objects](https://developers.cloudflare.com/durable-objects/api/alarms/)
- [Cloudflare: cuotas de Durable Objects Free](https://developers.cloudflare.com/durable-objects/platform/pricing/)
- [RFC 8291: cifrado Web Push](https://www.rfc-editor.org/rfc/rfc8291)
- [RFC 8292: identificación VAPID](https://www.rfc-editor.org/rfc/rfc8292)
