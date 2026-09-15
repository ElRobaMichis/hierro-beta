"""Build a local, offline UI audit from captured DOM measurements and screenshots.
Uses only Python's standard library. Never reads or changes personal app storage.
"""
from pathlib import Path
import json, html, struct

ROOT = Path(__file__).resolve().parent
CAP = ROOT / 'captures'

def image_size(b):
    if b[:8] == b'\x89PNG\r\n\x1a\n': return struct.unpack('>II', b[16:24])
    if b[:2] != b'\xff\xd8': return None
    p = 2
    while p < len(b):
        if b[p] != 255: p += 1; continue
        while b[p] == 255: p += 1
        marker = b[p]; p += 1
        if marker in (0xd8, 0xd9): continue
        length = int.from_bytes(b[p:p+2], 'big')
        if marker in (0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf):
            return (int.from_bytes(b[p+5:p+7], 'big'), int.from_bytes(b[p+3:p+5], 'big'))
        p += length
    return None

records = json.loads((ROOT / 'metrics-raw.json').read_text(encoding='utf-8'))
if isinstance(records, dict): records = records['captures']
for im in CAP.glob('*.png'):
    if im.read_bytes()[:2] == b'\xff\xd8':
        dest = im.with_suffix('.jpg')
        if dest.exists(): raise RuntimeError('Refusing to replace an existing screenshot: ' + str(dest))
        im.rename(dest)

excluded = {'09-second-tab-lock-390': 'Estado alterado por siembra de dos fixtures sobre el mismo origen; no representa un problema de producción.',
            '56-timed-landscape-844': 'La captura no conserva la relación del viewport al cambiar de orientación; se repitió como 65-landscape-settled-844.'}
for rec in records:
    im = next((CAP / (rec['name'] + ext) for ext in ('.jpg', '.png') if (CAP / (rec['name'] + ext)).exists()), None)
    if im is None: raise RuntimeError('Missing screenshot ' + rec['name'])
    rec['image'] = im.name
    rec['imageSize'] = image_size(im.read_bytes())
    rec['axeReview'] = 'confirmed-settled' if rec['name'].startswith(('60-', '61-')) else 'exploratory-not-a-verdict'
    if rec['name'] in excluded: rec['excludedReason'] = excluded[rec['name']]
    (CAP / (rec['name'] + '.json')).write_text(json.dumps(rec, ensure_ascii=False, indent=2), encoding='utf-8')

meta = {'version': '3.5.1', 'commit': '4d96f2f', 'date': '2026-09-14',
        'method': 'Capturas de navegador, geometría DOM, axe-core 4.13.0, revisión estática y simulaciones aisladas. Sin seguimiento de usuarios ni medición ocular.',
        'warning': 'Los resultados automáticos exploratorios no son una lista confirmada de defectos. Algunos se tomaron durante animaciones; solo se citan contrastes estables comprobados (60 y 61). No sumar ocurrencias como fallos únicos.',
        'excluded': excluded, 'captures': records}
(ROOT / 'metrics-raw.json').write_text(json.dumps(meta, ensure_ascii=False, indent=2), encoding='utf-8')
by_name = {r['name']: r for r in records}

def shot(name, cls='', caption=''):
    r=by_name[name]
    return f'<figure class="{cls}"><a href="captures/{r["image"]}" target="_blank" rel="noopener"><img loading="lazy" src="captures/{r["image"]}" alt="{html.escape(caption or name)}"></a><figcaption>{html.escape(caption)} <span>{r["width"]} × {r["height"]} · ventana CSS</span></figcaption></figure>'

findings = [
 {'id':'UX-01','p':1,'area':'Confianza','evidence':'Simulación de código','title':'El éxito de guardado debe corresponder a una escritura real.',
  'observed':'La revisión del cliente identifica flujos que continúan después de save() = false: el cierre puede sustituir el aviso de error por la celebración de sesión guardada. También hay un retorno silencioso a una base vacía si falla la lectura.',
  'impact':'La persona puede creer que su sesión está a salvo cuando solo permanece en memoria.',
  'proposal':'Hacer transaccionales registrar y terminar. Ante un fallo, conservar la sesión, mantener el error visible y ofrecer reintentar o descargar una copia. Separar instalación vacía de datos ilegibles.',
  'accept':'Simular cuota llena y JSON inválido: no mostrar éxito, no reemplazar el contenido anterior y mantener una salida de recuperación.',
  'source':'index.html:892, 899, 4725','image':None},
 {'id':'UX-02','p':1,'area':'Entrenar','evidence':'Observado y medido','title':'Confirmar debe quedar al alcance durante toda la serie.',
  'observed':'A 320 × 740, «Registrar serie» ocupa y=762–818: está fuera de la primera pantalla. A 390 × 844 con nombre y nota largos aparece en y=973–1029. En calentamiento, «Completé este calentamiento» ocupa y=839–893.',
  'impact':'La acción más frecuente exige desplazarse, justo cuando la persona usa una sola mano o acaba de hacer esfuerzo.',
  'proposal':'Una zona inferior estable para confirmar, con espacio reservado para no tapar campos. Mantener el nombre, la indicación de montaje y la nota legibles. Adaptar esta zona al teclado y a las áreas seguras.',
  'accept':'En móvil estrecho, nota larga y teclado real de iPhone: confirmar accesible sin ocultar el campo enfocado; áreas táctiles de al menos 44 × 44 CSS px como objetivo de diseño.',
  'source':'ui.js:640–679 · ui.css:1253–1266','image':'11-work-320'},
 {'id':'UX-03','p':1,'area':'Sincronización','evidence':'Reproducido en navegador','title':'El error de vinculación se escribe detrás del diálogo.',
  'observed':'En Tú → Sincronización → Ya tengo una clave, «clave-de-prueba» y Buscar dejan vacío el error del formulario. Hay dos #sync-error: el mensaje se coloca en el primero, dentro del fondo inerte. Solo aparece después de cerrar.',
  'impact':'Parece que el botón está trabado y no hay forma visible de saber qué corregir.',
  'proposal':'Dar un destino de error propio a cada formulario; mantener texto, foco y botón en ese diálogo. Aplicar el mismo patrón a buscar, vincular y resolver conflictos.',
  'accept':'Una clave inválida muestra el error junto al campo sin cerrar el diálogo ni generar una petición válida; ningún ID duplicado en ese recorrido.',
  'source':'sync.js:141, 147, 166–179','image':'42-sync-invalid-key-390'},
 {'id':'UX-04','p':1,'area':'Recuperación','evidence':'Observado + revisión de código','title':'Un toque accidental no debe borrar una medición o una serie.',
  'observed':'Con el cronómetro mostrando 22, tocar el fondo lo cierra; al reabrir comienza otra vez en la cuenta de preparación de 3. Eliminar una serie desde su edición ejecuta splice y guarda sin ofrecer Deshacer.',
  'impact':'Se pierde trabajo sin una recuperación cercana. En el gimnasio es fácil tocar fuera de un panel.',
  'proposal':'Convertir la medición en un estado persistente del ejercicio; minimizar conserva su avance. Para eliminar una serie confirmada, ofrecer Deshacer o una confirmación explícita.',
  'accept':'Cerrar, cambiar de pantalla y volver conservan el tiempo real. Borrar y deshacer restaura peso, reps, esfuerzo y estado de confirmación.',
  'source':'index.html:4273–4324, 5438–5450 · ui.js:823','image':'55-timer-modal-390'},
 {'id':'UX-05','p':1,'area':'Contexto','evidence':'Simulación de código','title':'Editar otro plan no debe reescribir la sesión en curso.',
  'observed':'Las simulaciones reproducen que editar las series del plan B cambia las de la sesión A en curso, y que mover un día cambia el plan con que se interpreta su historial. Son operaciones que la interfaz presenta como ajustes de configuración.',
  'impact':'La persona puede registrar una sesión con reglas diferentes de las que eligió al empezar.',
  'proposal':'Guardar contexto de sesión e historial explícito. Separar cambios para próximas sesiones de cambios deliberados en la actual. Aplicar las reglas del plan consultado sin alterar otro entrenamiento.',
  'accept':'Con una sesión A abierta, editar B no altera A. Mover un día no cambia el contexto de las sesiones ya guardadas. Las propuestas consultadas identifican el plan al que pertenecen.',
  'source':'index.html:1065, 1975, 2648, 2664 · simulaciones F04 y F05','image':None},
 {'id':'UX-06','p':2,'area':'Preparación','evidence':'Observado y medido','title':'La consulta del día empieza demasiado tarde.',
  'observed':'En Full body, el primer botón de ejercicio empieza en y=920 a 390 × 844. La página de cinco ejercicios mide aproximadamente 4 000 px. En escritorio también queda muy abajo por la cabecera y el bloque motivacional.',
  'impact':'La intención «ver qué toca y si voy a subir» queda detrás de una presentación que ya conoce el usuario.',
  'proposal':'Cabecera compacta con nombre, gimnasio y resumen de avances. Mostrar de inmediato las primeras propuestas y conservar los detalles de rangos y razones al expandir cada ejercicio.',
  'accept':'Primer ejercicio y su propuesta visibles al abrir el día a 390 × 844. Mantener satisfacción visual y acceso a todos los días sin añadir una pantalla intermedia.',
  'source':'ui.js:548–583 · capturas 03, 37 y 50','image':'03-day-390'},
 {'id':'UX-07','p':2,'area':'Legibilidad','evidence':'Medición DOM + axe estable','title':'La información secundaria es demasiado pequeña y tenue.',
  'observed':'El estado de guardado usa 8 px; algunos auxiliares de registro, 9 px. En claro, #6b756c sobre #f4f3ec da 4,30:1 en texto pequeño, por debajo de 4,5:1. El inicio oscuro estable no reproduce ese fallo de contraste.',
  'impact':'Información como la unidad, el rango y si los datos están guardados se vuelve difícil de consultar con una mirada rápida.',
  'proposal':'Escala tipográfica breve: instrucciones y etiquetas críticas 14–16 px; metadatos realmente secundarios 12–13 px. Oscurecer el texto secundario claro y comprobar placeholders, campos, gráficos y estados deshabilitados por separado.',
  'accept':'Texto normal al menos 4,5:1 y texto grande 3:1. No reducir etiquetas esenciales para hacer caber tarjetas. Comprobar tamaños ampliados en iPhone físico.',
  'source':'ui.css:2, 161, 787, 1298 · capturas 60 y 61','image':'10-work-390'},
 {'id':'UX-08','p':2,'area':'Navegación','evidence':'Reproducido en navegador','title':'Las secciones deben conservar su propio lugar.',
  'observed':'Después de buscar Jalón en Evolución → Ejercicios, ir a Entrenar y volver abre Panorama. Ajustes comparte la misma memoria de scroll entre subsecciones: Sincronización abrió a y=326 después de otro ajuste.',
  'impact':'Se repiten búsquedas y aparecen páginas nuevas empezadas a mitad, sin su título ni explicación inicial.',
  'proposal':'Estado independiente por pestaña y subsección. Conservar consulta al volver; abrir una sección nueva arriba. Mantener un historial de navegación compatible con Atrás y con el retorno al origen.',
  'accept':'Salir y volver conserva subpestaña, búsqueda, filtro y posición. Abrir otro ajuste muestra su cabecera. Atrás vuelve al lugar de consulta.',
  'source':'index.html:1666–1684 · ui.js:431 · navigation-check.txt','image':'41-sync-entry-scroll-390'},
 {'id':'UX-09','p':2,'area':'Formularios','evidence':'Reproducido en navegador','title':'Hay dos salidas distintas presentadas como cancelación.',
  'observed':'Nuevo gimnasio muestra Cancelar y Cerrar. Cancelar abre el selector de gimnasio; Cerrar solo cierra. El envío con nombre vacío no explica qué falta. Es una incoherencia de destinos, no dos funciones idénticas.',
  'impact':'La persona no puede anticipar si saldrá al selector o a la administración de gimnasios.',
  'proposal':'Un único cierre que vuelva al origen. En formularios, Cancelar; en consultas, Cerrar; Volver solo para un paso anterior real. Validación local junto al campo y conservación del borrador.',
  'accept':'Desde cada origen, cancelar vuelve al mismo contexto. Vacío, cero o rango inválido muestran una explicación sin sustituir el formulario.',
  'source':'index.html:3509–3542 · ui.js:225–241','image':'25-new-gym-modal-400'},
 {'id':'UX-10','p':2,'area':'Primer uso','evidence':'Reproducido en navegador','title':'Crear un ejercicio necesita una decisión mínima sobre cómo registrarlo.',
  'observed':'Crear Plancha lateral desde cero la deja como ejercicio normal con rango de reps. Al empezar solicita una carga de trabajo en kg. «Crear y elegir ejercicios» también termina en un día vacío que exige otro toque para abrir el selector.',
  'impact':'Quien empieza encuentra una petición que no corresponde a su ejercicio y debe descubrir Objetivos por su cuenta.',
  'proposal':'Tras crear, elegir de forma breve Peso y reps / Tiempo / Corporal / Asistido y equipo. Usar inferencias como sugerencias revisables. Permitir añadir varios ejercicios antes de cerrar la biblioteca.',
  'accept':'Una plancha configurada por tiempo llega a segundos. El alta de varios ejercicios no exige reabrir el selector para cada uno.',
  'source':'ui.js:586–612, 1050 · capturas 58 y 59','image':'59-new-timed-exercise-wrong-mode-390'},
 {'id':'UX-11','p':2,'area':'Evolución','evidence':'Observado','title':'El progreso debería responder primero cuánto levantaste.',
  'observed':'La ficha destaca 85,1 lb de 1RM estimado, mientras el registro real era 63,85 lb × 10. El dato «Último registro» repite la estimación y la gráfica empieza cerca del final de la primera pantalla.',
  'impact':'Es fácil confundir la estimación con una carga realmente realizada; exige bajar para comprobar las series.',
  'proposal':'Destacar la última sesión real con peso, reps y series. Mantener la fuerza estimada como métrica claramente seleccionable. Acercar la gráfica y mostrar la serie real asociada al punto consultado.',
  'accept':'En una mirada se distingue registro real de estimación. Tocar, enfocar o consultar un punto no abre otro diálogo ni oculta la gráfica.',
  'source':'ui.js:837–875 · capturas 04, 51 y 64','image':'04-exercise-progress-390'},
 {'id':'UX-12','p':2,'area':'Cierre','evidence':'Observado + simulación de código','title':'La celebración necesita comparar sesiones equivalentes.',
  'observed':'Al cerrar una sesión de una sola serie aparece «3 396 kg menos» que en la anterior completa. Además, la revisión del código detecta metadatos de PR que pueden quedar obsoletos tras corregir el historial.',
  'impact':'Un resumen bonito puede comunicar un retroceso que el registro parcial no permite inferir, o celebrar una marca que ya se corrigió.',
  'proposal':'Mostrar cobertura de la sesión y logros válidos; explicar cuándo la comparación es parcial. Recalcular marcas al editar. Reservar mensajes motivacionales para este momento, apoyados por datos reales.',
  'accept':'Una sesión parcial se identifica como tal. Corregir la serie que originó un PR actualiza diario, resumen y tarjetas.',
  'source':'index.html:3386, 4554, 5541 · ui.js:1008 · captura 16','image':'16-finish-card-400'},
 {'id':'UX-13','p':2,'area':'Accesibilidad','evidence':'Reproducido + revisión de código','title':'El foco y las etiquetas deben acompañar a la acción.',
  'observed':'Elegir RIR 2 deja document.activeElement en BODY. El campo accesible «Peso de la serie 1» omite unidad y convenciones visibles como total de ambas mancuernas o discos sin barra. Algunos kg/lb no exponen selección. Equipo y Barras miden menos de 44 px de ancho.',
  'impact':'Teclado, lector de pantalla y voz pierden información o el lugar de interacción. Las pestañas cortas son más difíciles de acertar.',
  'proposal':'Restaurar foco después del render, asociar etiqueta y ayuda del peso, usar estados de selección explícitos y ampliar zonas táctiles sin ampliar necesariamente el icono.',
  'accept':'Tras elegir RIR, el foco queda en su control o en Registrar. El nombre accesible contiene la etiqueta visible y la unidad. Anunciar una vez el fin del descanso, sin leer cada segundo.',
  'source':'ui.js:656–659, 811 · focus-check.json · accessibility-static.md','image':'53-rir-modal-390'},
 {'id':'UX-14','p':2,'area':'Equipo','evidence':'Observado','title':'El inventario puede ser más rápido de revisar.',
  'observed':'Siete tipos de disco ocupan una página de 2 214 px a 400 × 907. El selector de unidad está después de la lista. Máquinas también contiene barras y mancuernas. Ver inventario desde una torre abre Discos y pierde el retorno a la ficha.',
  'impact':'Configurar un gimnasio en computadora o corregir una máquina entre series necesita demasiada búsqueda y desplazamiento.',
  'proposal':'Filas compactas con peso, disponibilidad y cantidad juntos; unidad cerca del título. Llamar «Equipo por ejercicio» a las configuraciones y volver a la ficha de origen tras un ajuste.',
  'accept':'Una misma lista permite entender y editar disponibilidad y pares sin cambiar de contexto. Torre → inventario relevante → volver a la torre.',
  'source':'ui.js:878–900, 944–953 · capturas 26, 28 y 31','image':'26-inventory-plates-400'},
 {'id':'UX-15','p':2,'area':'Notificaciones','evidence':'Observado + revisión de código','title':'Distinguir preferencias elegidas de avisos realmente disponibles.',
  'observed':'Sin vincular un espacio ya aparecen los tres switches encendidos. La acción dirige a Sincronización, pero el recorrido no conserva el destino de volver a activar avisos. Requisitos y límite sin internet aparecen al final.',
  'impact':'La persona puede interpretar preferencias preparadas como notificaciones activadas, especialmente con el teléfono bloqueado.',
  'proposal':'Estado explícito al principio: sin activar, listo, permiso retirado o sin conexión. Mantener las preferencias editables, pero diferenciarlas de la disponibilidad; regresar al paso de activación después de vincular.',
  'accept':'Ver en una mirada si el próximo aviso está programado o pendiente. La interfaz coincide con permiso, suscripción y conexión reales, sin prometer puntualidad garantizada.',
  'source':'push.js:6–10, 163 · sync.js:188 · captura 40','image':'40-notifications-390'},
 {'id':'UX-16','p':3,'area':'Mapa corporal','evidence':'Observado','title':'Aclarar qué significa Pierna frente a sus subgrupos.',
  'observed':'El mapa muestra cuádriceps e isquiotibiales trabajados, mientras la fila Pierna indica 0. Es correcto como categoría independiente, pero su nombre sugiere un total agregado.',
  'impact':'El usuario puede interpretar que el mapa y las cifras se contradicen.',
  'proposal':'Distinguir «Pierna sin desglosar» de sus subgrupos o presentar una agrupación con total y detalle sin contar dos veces. Conservar la leyenda que aclara que color no significa recuperación.',
  'accept':'El total mostrado puede reconciliarse con cada categoría y ejercicio; la clasificación general heredada conserva su significado.',
  'source':'ui.js:37–115 · capturas 18 y 19','image':'18-body-400'},
 {'id':'UX-17','p':3,'area':'Lenguaje e iconos','evidence':'Observado + revisión estática','title':'Unificar nombres y reservar los símbolos para orientar.',
  'observed':'Persisten plan/split, día/rutina y enlaces de ayuda a Ajustes o Rutinas que ya no son pestañas. «1 ejercicios · 1 series» y «sesiónes» aparecen en estados concretos. La cola depende visualmente de un icono cuya comprensión necesita una prueba de uso.',
  'impact':'La misma entidad parece cambiar de nombre y cuesta encontrar lo que una explicación señala.',
  'proposal':'Glosario único: plan, día, ejercicio, serie, sesión, gimnasio. Iconos de una misma cuadrícula y espesor óptico, siempre con nombre accesible; conservar variantes útiles y unidades junto a las cifras.',
  'accept':'Cada instrucción coincide con un destino actual. Nombres largos y variantes siguen siendo distinguibles a 320 px. Ningún icono se cambia solo por decoración.',
  'source':'ui.js:3–32, 577 · index.html:1709, 2308, 3047, 5221','image':'33-plan-400'},
 {'id':'UX-18','p':2,'area':'Descanso','evidence':'Observado + revisión de código','title':'El descanso debe preparar la siguiente acción.',
  'observed':'El reloj es legible, pero el bloque siguiente solo muestra nombre y número de serie. La acción visual dominante durante la espera es Saltar descanso. Al finalizar el último descanso hay pasos separados de Continuar y Siguiente.',
  'impact':'La persona debe salir del descanso para consultar la siguiente carga y vuelve a decidir avanzar más de una vez.',
  'proposal':'Mostrar próximo peso y montaje junto al reloj. Mantener ampliar y saltar como controles secundarios mientras corre. Al terminar, una acción conduce al siguiente estado pertinente, incluido calentamiento cuando corresponde.',
  'accept':'Desde descanso se puede consultar qué peso y placa siguen. La transición respeta preparación y confirmación manual de series, sin saltos automáticos.',
  'source':'ui.js:650, 653, 798 · captura 13','image':'13-rest-400'},
 {'id':'UX-19','p':2,'area':'Notas y gimnasios','evidence':'Simulación de código','title':'El asiento de una máquina pertenece a ese gimnasio.',
  'observed':'La nota se almacena una sola vez por ejercicio. En la simulación, «Asiento 4 en A» aparece al entrar a B; editarla como «Asiento 7 en B» también cambia lo que se lee al volver a A. La unidad y la torre sí conservan configuración propia.',
  'impact':'La persona que entrena en varios lugares puede seguir una indicación de montaje que corresponde a otra máquina.',
  'proposal':'Distinguir indicación técnica general de ajuste del gimnasio: asiento, altura de polea y accesorios. Mostrar ambas juntas cuando ayuden a ejecutar, con el lugar identificado; conservar las notas existentes como generales al migrar.',
  'accept':'A y B conservan asientos distintos; una indicación técnica compartida sigue apareciendo en ambos. La sincronización preserva ese alcance y la migración no pierde notas.',
  'source':'index.html:2677, 3421, 3435, 3446 · simulación NOTAS-GYM','image':None}
]
(ROOT / 'findings.json').write_text(json.dumps(findings, ensure_ascii=False, indent=2), encoding='utf-8')

cards=[]
for f in findings:
    evidence_link = f'<a class="evidence-link" href="captures/{by_name[f["image"]]["image"]}" target="_blank" rel="noopener">Ver captura ↗</a>' if f['image'] else '<a class="evidence-link" href="logic-results-verified.json">Ver simulaciones ↗</a>'
    cards.append(f'''<article class="finding" data-priority="{f['p']}"><div class="tags"><span class="priority p{f['p']}">P{f['p']}</span><span>{f['id']} · {f['area']}</span><span>{f['evidence']}</span></div><h3>{f['title']}</h3><p>{f['observed']}</p><p class="impact">{f['impact']}</p><details><summary>Propuesta y criterio de aceptación</summary><p>{f['proposal']}</p><p><b>Comprobar:</b> {f['accept']}</p><p class="source">Referencia: {f['source']}</p></details>{evidence_link}</article>''')

selected=[('03-day-390','Preparación: la propuesta del primer ejercicio empieza en y=920.'),('11-work-320','Registro: confirmar empieza debajo de una pantalla de 740 px.'),('25-new-gym-modal-400','Nuevo gimnasio: dos salidas con destinos diferentes.'),('42-sync-invalid-key-390','Clave inválida: el error se muestra detrás del formulario.'),('52-long-note-390','Una nota extensa desplaza la acción hasta y=973.'),('16-finish-card-400','Sesión parcial comparada contra una sesión completa.')]
atlas=''.join(shot(n, 'evidence-shot', caption) for n,caption in selected)

gallery=[]
for r in records:
    if r['name'] in excluded: continue
    category='Móvil' if r['width']<=430 else 'Tablet / horizontal' if r['width']<1000 else 'Escritorio'
    gallery.append(f'<a class="gallery-item" data-screen="{category}" href="captures/{r["image"]}" target="_blank"><img loading="lazy" src="captures/{r["image"]}" alt="Captura {r["name"]}"><b>{r["name"]}</b><span>{r["width"]} × {r["height"]} · desplazamiento {r["scrollY"]} px</span></a>')

coverage=[
 ('Primera instalación','Bienvenida clara/oscura, selección de objetivo, primer día, crear un ejercicio','57–59','Observado'),
 ('Entrenar','Inicio con historial, consulta de días, propuestas, nombre y nota extensos','02–03, 37, 52','Observado'),
 ('Calentamiento','Aproximación, descanso real de 30 s, siguiente paso, pantalla de carga desconocida','07–08, 59','Observado'),
 ('Registro y descanso','Trabajo, tres anchos móviles, RIR, edición, descanso, fin parcial','10–16, 53','Observado'),
 ('Por tiempo','Ficha, registro, cronómetro, cierre exterior y reanudación desde cero','22, 54–55','Observado'),
 ('Evolución','Panorama y consulta integrada, directorio/búsqueda, cuerpo, diario y recibo','17–22, 51, 63–64','Observado'),
 ('Planes','Plan activo y guardado, ordenación móvil/tablet, reglas y biblioteca','32–38','Observado'),
 ('Gimnasios y equipo','Dos gimnasios, alta inválida, discos, barras, mancuernas, máquinas','24–31','Observado'),
 ('Ajustes','Preferencias, ayuda, apariencia, respaldo e identidad/versionado','23, 39, 44–47','Observado'),
 ('Sync y avisos','Requisitos, vinculación sin cuenta, error de clave, continuidad entre pantallas','40–43','Observado sin conectar cuentas'),
 ('Errores y contexto','Almacenamiento, importación, reglas por plan, historial, inventario y temporizadores','logic-results.json','Simulación aislada'),
 ('iPhone real','Teclado, VoiceOver, áreas seguras, suspensión, entrega push y alcance físico del pulgar','Pendiente','No ejecutado')]
rows=''.join('<tr>'+''.join(f'<td>{html.escape(c)}</td>' for c in row)+'</tr>' for row in coverage)

source_links='''<a href="https://developer.apple.com/design/tips/">Apple: organización, alineación y controles táctiles</a><a href="https://developer.apple.com/design/human-interface-guidelines/">Apple Human Interface Guidelines</a><a href="https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html">W3C: contraste de texto</a><a href="https://www.w3.org/WAI/WCAG22/Understanding/label-in-name.html">W3C: etiqueta y nombre accesible</a><a href="https://developer.chrome.com/docs/lighthouse/accessibility/scoring">Google: alcance del análisis automático de accesibilidad</a>'''

page = (ROOT/'report-template.html').read_text(encoding='utf-8')
subs={'{{FINDINGS}}':''.join(cards),'{{ATLAS}}':atlas,'{{GALLERY}}':''.join(gallery),'{{COVERAGE}}':rows,'{{SOURCES}}':source_links,
      '{{CAPTURE_COUNT}}':str(len(records)-len([r for r in records if r['name'] in excluded])), '{{FINDING_COUNT}}':str(len(findings))}
for k,v in subs.items(): page=page.replace(k,v)
(ROOT/'index.html').write_text(page,encoding='utf-8')
(ROOT/'capture-manifest.json').write_text(json.dumps([{'id':r['name'],'image':r['image'],'viewport':[r['width'],r['height']],'imageSize':r['imageSize'],'scrollY':r['scrollY'],'excluded':r.get('excludedReason')} for r in records],ensure_ascii=False,indent=2),encoding='utf-8')
print('Report built:',len(records),'measured captures;',len(findings),'prioritized groups.')
