# MateBudy - Logica Principal del Producto

## 1. Inicio / Muro social

Al entrar al panel principal, el usuario ve un muro tipo red social.

Objetivos del muro:
- Publicar fotos.
- Compartir opiniones.
- Comentar publicaciones.
- Dar "me gusta".
- Recomendar personas amables o confiables.
- Compartir como fue un servicio recibido.
- Sugerir perfiles que ayudaron bien.

Reglas:
- Las valoraciones formales solo se pueden hacer despues de que exista un servicio completado.
- Las publicaciones del muro no reemplazan la calificacion oficial del servicio.

## 2. Mapa

Debe existir una pestana `Mapa`.

En el mapa se podra ver:
- Reuniones de usuarios de la app en vivo.
- Ubicacion o puntos de encuentro activos.
- Buscador principal de servicios.

## 3. Busqueda de servicios

En el buscador se mostrara el texto:
- `Que necesitas?`

La persona describe lo que necesita y el sistema busca un servicio real.

El sistema debe devolver una lista ordenada de mejor a peor segun:
- Disponibilidad real.
- Coincidencia del perfil con lo que busca el cliente.
- Mejor valoracion.
- Estado del perfil activo.
- Historial y confiabilidad del proveedor.

Cada resultado debe mostrar:
- Nombre.
- Tipo de servicio.
- Disponibilidad.
- Valoracion.
- Coincidencia con la necesidad buscada.
- Boton para iniciar chat.

## 4. Chat privado

Los chats privados de contratacion son solo para quien busca un servicio.

Condicion:
- Solo el cliente puede abrir un chat de contratacion desde la busqueda.

Objetivo del chat:
- Coordinar el servicio.
- Ajustar detalles.
- Confirmar disponibilidad.
- Extender tiempo contratado si hace falta.

## 5. Logica de contratacion

Cuando el cliente decide contratar a una persona:

1. El sistema pregunta:
- `Cuantas horas lo vas a contratar?`

2. Se calcula el total:
- tarifa por hora del proveedor
- horas contratadas
- comision de la app

Ejemplo:
- Pedro cobra 150 por hora
- cliente contrata 2 horas

Base:
- 150 x 2 = 300

Comision:
- La app suma un porcentaje por hora
- El porcentaje comienza en 15%
- Si el importe total es mas alto, la comision baja progresivamente
- Minimo posible de comision: 5%

Regla deseada:
- Poco dinero: comision cercana a 15%
- Mucho dinero o muchas horas: comision baja hasta 5%

## 6. Pago

Luego del calculo:
- el cliente pasa a pagar con tarjeta

Pasarelas deseadas:
- Mercado Pago como primera opcion
- o cualquier alternativa que libere rapido el dinero

Objetivo:
- cobrar al cliente antes del servicio
- retener el dinero en la app
- liberarlo cuando el servicio termina bien

## 7. Flujo despues del pago

Una vez pagado:
- se notifica al proveedor
- el proveedor debe aceptar o rechazar

### Si el proveedor dice "no puedo"

Consecuencias:
- si estaba marcado como disponible, la app lo sanciona
- el dinero se devuelve al cliente
- el cliente recibe mensaje de disculpa
- el cliente debe elegir otra persona

Mensaje esperado:
- `Pedro no puede en este momento, lo sentimos mucho. Elige otra opcion.`

### Si el proveedor dice "si puedo"

Entonces:
- el dinero queda retenido
- el proveedor va al servicio
- el proveedor no recibe el dinero hasta finalizar correctamente

## 8. Finalizacion y liberacion del dinero

Cuando termina el servicio:
- el cliente confirma dentro del chat o del flujo del servicio que todo estuvo bien
- recien ahi se libera el dinero al proveedor

Si el tiempo contratado no alcanza:
- dentro del chat el cliente puede contratar mas tiempo
- se repite el proceso de calculo y pago extra

## 9. Valoraciones

Regla muy importante:
- solo se puede valorar a alguien despues de un servicio real completado

La valoracion formal debe impactar en:
- ranking en resultados
- reputacion
- confiabilidad del perfil

## 10. Monitor y monitoreado

La cuenta `Monitor/Familiar` no pertenece al flujo de contratacion normal.

La cuenta `Monitor/Familiar` sirve para:
- seguir en tiempo real a un familiar
- ver geolocalizacion en tiempo real
- ver bateria del telefono del familiar
- saber por donde va
- recibir una alerta sonora si el familiar activa el boton de alerta
- y tambien pedir servicios dentro de la app

La logica definitiva es:
- `Monitor` y `Familiar` son la misma cuenta
- esa misma cuenta puede usar monitoreo y pedir servicios

La parte monitoreada debe tener:
- boton de alerta o SOS
- envio de ubicacion en tiempo real
- estado del dispositivo

## 11. Enfoque social y prevencion del aislamiento

La app esta pensada para:
- personas mayores
- personas vulnerables
- y tambien para bajar o detectar a tiempo situaciones de aislamiento severo o riesgo emocional en jovenes

El objetivo no es reemplazar un sistema clinico, sino:
- detectar senales de aislamiento o malestar
- activar apoyo humano temprano
- conectar a la persona con actividades, comunidad y ayuda voluntaria

## 12. Especialista voluntario

`Especialista voluntario` queda fuera de la logica comercial.

No aplica en:
- pagos
- contratacion normal paga
- ranking de servicios pagos

Si aplica en:
- apoyo humano
- contacto voluntario
- contencion
- acompanamiento
- derivacion a ayuda profesional cuando haga falta

Idealmente aqui debe haber:
- personas con ganas de ayudar
- psicologos voluntarios
- referentes comunitarios

## 13. Mapa social y actividades

En el mapa se pueden ver actividades generadas por usuarios.

Ejemplo:
- `Nos juntamos a las 18 en Parque Batlle a tomar mate`

Esto sirve para:
- fomentar encuentros reales
- combatir aislamiento
- acercar personas a actividades seguras
- crear comunidad

## 14. Sistema de senales de riesgo emocional

La app puede identificar senales de riesgo, pero no debe presentarlo como diagnostico ni como deteccion automatica infalible de suicidio.

Debe funcionar como sistema de senales y apoyo.

Senales posibles:
- aislamiento prolongado
- publicaciones con desesperanza
- cambios bruscos de tono
- pedidos indirectos de ayuda
- ausencia prolongada luego de conducta preocupante
- alertas manuales de familiares o usuarios

Regla importante:
- una senal no equivale a confirmacion de riesgo suicida
- el sistema debe combinar senales y derivar a apoyo humano

## 15. Acciones al detectar senales de riesgo

Cuando el sistema detecta un caso preocupante:

1. enviar una notificacion amable a la persona
   Ejemplo:
   - `Hace tiempo que no interactuas. Hay personas cerca, actividades y apoyo disponible si lo necesitas.`

2. sugerir actividades del mapa para evitar aislamiento
   Ejemplo:
   - reuniones
   - mates
   - caminatas
   - encuentros comunitarios

3. derivar el caso a un `Especialista voluntario`

4. mostrar al voluntario datos utiles para contactar y ofrecer apoyo
   Siempre bajo reglas de privacidad definidas por la app.

## 16. Principios de seguridad para salud mental

La app no debe:
- prometer diagnosticar depresion o suicidio
- afirmar que sabe con certeza que alguien quiere hacerse dano
- depender solo de inteligencia artificial para tomar decisiones graves

La app si debe:
- detectar senales tempranas
- activar apoyo humano
- reducir aislamiento
- permitir contacto rapido con voluntarios
- permitir escalamiento a ayuda urgente si hay peligro inminente

## 17. Modulo futuro de escalamiento

A futuro, si se detecta riesgo alto:
- notificar a voluntario o referente asignado
- mostrar recursos de crisis
- ofrecer contacto inmediato con ayuda
- y, si el sistema juridico y operativo lo permite, activar protocolo de emergencia

Esto debe hacerse con mucho cuidado legal, etico y de privacidad.

## 11. Estados del proveedor

Si un proveedor aparece como `disponible`, ese estado tiene consecuencias.

Por eso:
- si rechaza un servicio estando disponible, debe existir sancion
- si acepta, queda comprometido con el servicio

Sanciones futuras posibles:
- bajar posicion en resultados
- bajar reputacion interna
- marcar confiabilidad menor

## 12. Etapas de construccion recomendadas

### Etapa 1
- registro y verificacion de identidad
- roles bien definidos
- panel principal
- muro social

### Etapa 2
- buscador real de servicios
- ranking por perfil, disponibilidad y valoracion
- chat de contratacion
- mapa con actividades sociales
- publicaciones y sugerencias

### Etapa 3
- pagos con retencion
- aceptacion o rechazo del proveedor
- devolucion automatica
- liberacion de fondos

### Etapa 4
- tiempo extra dentro del chat
- valoraciones solo tras servicio
- sanciones por disponibilidad falsa

### Etapa 5
- monitor/familiar
- geolocalizacion en tiempo real
- bateria
- boton de alerta
- sistema de senales de aislamiento o riesgo
- derivacion a especialista voluntario

## 13. Decisiones pendientes

Para cerrar esta logica sin rehacerla despues, aun falta definir:

1. Si el muro social lo ven todos los roles o solo algunos.
2. Si el chat normal y el chat de contratacion seran el mismo modulo o dos modos distintos.
3. Cual sera la formula exacta de comision decreciente entre 15% y 5%.
4. Que pasarela de pago se integrara primero.
5. Que datos exactos podra ver un especialista voluntario cuando reciba una alerta.
