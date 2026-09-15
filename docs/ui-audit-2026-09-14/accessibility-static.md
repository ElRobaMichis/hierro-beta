Revisé el código actual de **Hierro 3.5.1**, en solo lectura. Los SHA-256 de los tres archivos coinciden al inicio y al cierre. No abrí la aplicación ni navegadores personales, ni usé pruebas anteriores como evidencia. Esta es una auditoría estática; no acredita comportamiento observado en un teléfono.

P1 indica prioridad alta para registrar entrenamientos; P2, siguiente prioridad.

Los problemas confirmados en código son:

1. **P1 — El foco se pierde después de elegir RIR.** `uiSetRIR()` cierra el diálogo, devuelve el foco al botón original y después ejecuta `render()`, que elimina ese mismo botón mediante `innerHTML`. No hay restauración posterior. También afecta otras transiciones que reconstruyen la pantalla. Conviene enfocar un destino estable después del renderizado.  
   Evidencia: [ui.js:811](C:/Users/Agustin/Documents/hierro-beta/ui.js:811), [ui.js:274](C:/Users/Agustin/Documents/hierro-beta/ui.js:274), [index.html:1870](C:/Users/Agustin/Documents/hierro-beta/index.html:1870).

2. **P1 — El nombre accesible del peso elimina información necesaria para introducirlo.** La etiqueta visible distingue «Discos totales», «Total de las dos», «Ayuda» o «Lastre opcional», con su unidad; `aria-label` la sustituye por «Peso de la serie N». Las indicaciones «Sin la barra» o «Suma ambas manos» tampoco están asociadas mediante `aria-describedby`. Puede inducir un registro equivocado con lector de pantalla y dificulta el control por voz.  
   Evidencia: [ui.js:656](C:/Users/Agustin/Documents/hierro-beta/ui.js:656), [ui.js:659](C:/Users/Agustin/Documents/hierro-beta/ui.js:659). La etiqueta visible debe formar parte del nombre accesible: [WCAG 2.5.3](https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html).

3. **P1 — Una serie confirmada se elimina al primer toque, sin recuperación en ese flujo.** «Eliminar esta serie» llama directamente a `splice()`, guarda y cierra. No distingue series registradas de borradores ni ofrece confirmación o Deshacer. Es una acción sensible para una mano cansada o húmeda.  
   Evidencia: [ui.js:815](C:/Users/Agustin/Documents/hierro-beta/ui.js:815), [ui.js:823](C:/Users/Agustin/Documents/hierro-beta/ui.js:823).

4. **P2 — Tocar fuera del diálogo descarta cambios y cancela cronómetros.** Todos los diálogos normales cierran al tocar el fondo. Las notas sólo se guardan con «Guardar»; además, `closeModal()` borra el estado del cronómetro de serie. Un toque exterior durante su ejecución pierde la medición sin registrar el tiempo transcurrido.  
   Evidencia: [index.html:5438](C:/Users/Agustin/Documents/hierro-beta/index.html:5438), [index.html:5450](C:/Users/Agustin/Documents/hierro-beta/index.html:5450), [index.html:2734](C:/Users/Agustin/Documents/hierro-beta/index.html:2734), [index.html:4273](C:/Users/Agustin/Documents/hierro-beta/index.html:4273).

5. **P2 — Persisten formularios sin etiquetas vinculadas y errores silenciosos.** «Nombre» al editar gimnasio y «Nombre/Peso» al añadir equipo son `span` dentro de `div`, sin asociación con los inputs. En «Nuevo gimnasio», enviar el nombre vacío simplemente retorna. En «Agregar peso», el HTML permite `0`, pero el manejador lo rechaza sin mensaje.  
   Evidencia: [index.html:3563](C:/Users/Agustin/Documents/hierro-beta/index.html:3563), [index.html:3758](C:/Users/Agustin/Documents/hierro-beta/index.html:3758), [index.html:3542](C:/Users/Agustin/Documents/hierro-beta/index.html:3542), [index.html:3770](C:/Users/Agustin/Documents/hierro-beta/index.html:3770).

6. **P2 — Algunas selecciones sólo se expresan visualmente.** El RIR seleccionado, el objetivo en preferencias y los selectores kg/lb usan `.on`, sin `aria-pressed`, `aria-checked` o controles de selección equivalentes. El lector puede identificar las opciones, pero el código no comunica cuál está elegida.  
   Evidencia: [ui.js:809](C:/Users/Agustin/Documents/hierro-beta/ui.js:809), [ui.js:931](C:/Users/Agustin/Documents/hierro-beta/ui.js:931), [index.html:3683](C:/Users/Agustin/Documents/hierro-beta/index.html:3683).

7. **P2 — El final del descanso de trabajo carece de anuncio accesible explícito.** Cambian el texto del reloj y «Saltar descanso» por «Continuar», pero esos elementos no tienen una región viva. La notificación local se omite con la aplicación visible. Con sonido y vibración desactivados falta un anuncio programático del final; bastaría anunciar esa transición, sin leer cada segundo.  
   Evidencia: [ui.js:650](C:/Users/Agustin/Documents/hierro-beta/ui.js:650), [index.html:5136](C:/Users/Agustin/Documents/hierro-beta/index.html:5136), [index.html:5045](C:/Users/Agustin/Documents/hierro-beta/index.html:5045).

8. **P2 — Hay contrastes insuficientes calculables en ambos temas.** Los placeholders claros `#7f8b7d` sobre `#fffefa` dan **3,53:1**, por debajo de 4,5:1 para texto normal; el equivalente oscuro da **5,61:1**. Los bordes de campos vacíos sobre el fondo del diálogo dan **1,57:1 en claro y 2,40:1 en oscuro**: insuficientes cuando son la indicación que permite identificar el campo.  
   Evidencia: [ui.css:180](C:/Users/Agustin/Documents/hierro-beta/ui.css:180), [ui.css:552](C:/Users/Agustin/Documents/hierro-beta/ui.css:552), [ui.css:995](C:/Users/Agustin/Documents/hierro-beta/ui.css:995), [ui.css:1019](C:/Users/Agustin/Documents/hierro-beta/ui.css:1019). Referencias: [contraste de texto](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html), [contraste de controles](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html).

9. **P2 — Instrucciones importantes quedan en microtexto móvil.** Los auxiliares bajo peso y repeticiones tienen **9 px**; incluyen instrucciones como excluir la barra y el rango de repeticiones. Las etiquetas bajan a **10 px** hasta 360 px de ancho. Es una debilidad de legibilidad para consultas rápidas durante el entrenamiento; el tamaño por sí solo no demuestra incumplimiento WCAG.  
   Evidencia: [ui.css:787](C:/Users/Agustin/Documents/hierro-beta/ui.css:787), [ui.css:1298](C:/Users/Agustin/Documents/hierro-beta/ui.css:1298), [ui.js:657](C:/Users/Agustin/Documents/hierro-beta/ui.js:657).

10. **P2 — Cerrar una lista larga exige llegar a su final.** El montaje de diálogos mueve el cierre al final. La biblioteca puede mostrar 20 resultados, con filas móviles de al menos 76 px, y el cierre no permanece visible durante el desplazamiento. Para una mano, conviene conservar una salida accesible durante toda la consulta.  
    Evidencia: [ui.js:239](C:/Users/Agustin/Documents/hierro-beta/ui.js:239), [ui.js:588](C:/Users/Agustin/Documents/hierro-beta/ui.js:588), [ui.js:594](C:/Users/Agustin/Documents/hierro-beta/ui.js:594), [ui.css:747](C:/Users/Agustin/Documents/hierro-beta/ui.css:747).

Estas hipótesis requieren observación y **no las considero fallos reproducidos**:

- **Alcance del pulgar y teclado:** «Registrar serie» está en el flujo normal, sin fijación inferior. Comprobar su visibilidad con teclado abierto, propuesta, montaje y nota larga; también cuántos desplazamientos exige cada serie. [ui.css:514](C:/Users/Agustin/Documents/hierro-beta/ui.css:514), [ui.js:659](C:/Users/Agustin/Documents/hierro-beta/ui.js:659).
- **Recortes por zonas seguras:** `viewport-fit=cover` está activo, pero las reglas móviles sustituyen el padding superior que incorporaba `safe-area-inset-top`. Comprobar cabecera y diálogos completos en dispositivos con recorte, especialmente en horizontal. [index.html:5](C:/Users/Agustin/Documents/hierro-beta/index.html:5), [ui.css:769](C:/Users/Agustin/Documents/hierro-beta/ui.css:769), [ui.css:749](C:/Users/Agustin/Documents/hierro-beta/ui.css:749).
- **Compresión entre 361–390 px y texto ampliado:** comprobar los dos campos y sus controles ±; la reorganización especial del auxiliar sólo entra hasta 360 px. [ui.css:783](C:/Users/Agustin/Documents/hierro-beta/ui.css:783), [ui.css:890](C:/Users/Agustin/Documents/hierro-beta/ui.css:890).
- **Reconocimiento del icono de cola:** tiene nombre accesible, pero visualmente depende del icono de lista. Su descubrimiento y alcance con ambas manos requieren una prueba de uso. [ui.js:644](C:/Users/Agustin/Documents/hierro-beta/ui.js:644).

Sí están presentes en el código revisado: foco visible, aislamiento del fondo de los diálogos, control de Tab, movimiento reducido, navegación inferior móvil, botones principales con altura mínima de 44 px, controles ± con ancho mínimo de 44 px y «Registrar serie» con altura mínima de 56 px. Esas medidas declaradas no sustituyen la comprobación táctil y visual pendiente.
