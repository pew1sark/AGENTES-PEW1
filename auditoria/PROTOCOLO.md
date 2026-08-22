# PROTOCOLO DE AUDITORÍA — AUTENTICIDAD DE ENGAGEMENT EN INSTAGRAM

Cómo determinar si los likes de una publicación son reales o comprados, y qué
parte de ellos viene de cuentas bot.

---

## Por qué esto no se resuelve con un botón

Instagram cerró el acceso automatizado a estos datos. Tres barreras, en orden:

1. **Muro de sesión.** El contenido de un post no se sirve sin cookie de sesión iniciada.
2. **La lista de likers ya no es pública.** Desde 2019 no existe pestaña de Actividad,
   y no hay API oficial que devuelva quién dio like a un post ajeno. La Graph API de
   Instagram entrega métricas de *tus* publicaciones, nunca la identidad de quien
   interactúa con las de otro.
3. **Automatizar el scraping viola los Términos de Uso** y expone la cuenta que lo
   haga a bloqueo permanente.

Consecuencia práctica: **la recolección es manual, desde tu app, con tu sesión.**
Mirar una lista de likes que Instagram te muestra a ti es uso normal de la
plataforma. El auditor procesa después lo que anotaste.

La buena noticia: **el nivel macro no necesita la lista de cuentas.** En las pruebas,
un caso de likes comprados quedó en 100/100 solo con los números públicos del post.
La lista de cuentas sirve para saber *de qué calidad* es el paquete, no para
detectar que existe.

---

## Vía rápida — 5 minutos, veredicto macro

Suele bastar. Anota del post y del perfil:

| Dato | Dónde | ¿Obligatorio? |
|---|---|---|
| Likes | contador del post | Sí |
| Comentarios | contador del post | Sí |
| Seguidores del autor | su perfil | Sí |
| Likes de sus 5 posts anteriores | su grilla, uno por uno | Muy recomendable |
| Fecha de publicación | encabezado del post | No |

Con esos cinco números el auditor ya cruza: ratio likes:comentarios, engagement rate
contra el benchmark de su tramo, y el salto contra su propio histórico. **Esa última
es la señal más difícil de falsear:** nadie compra likes para todos sus posts por
igual, así que el post inflado sobresale de su propia línea base.

---

## Vía completa — 30 minutos, veredicto concluyente

Añade a lo anterior:

### Si la cuenta es tuya (o el cliente te comparte Insights)

Abre **Insights** del post y anota `alcance`, `guardados`, `compartidos`. Esto cambia
todo: con alcance, la métrica pasa a ser *qué porcentaje de quienes vieron el post
dio like*. Lo orgánico vive entre 3% y 12%.

> **Si los likes superan al alcance, la auditoría está cerrada.** Nadie puede dar
> like a algo que no vio. Los likes entraron desde fuera de la distribución de
> Instagram: es prueba directa de compra, no un indicio.

La asimetría **likes altos / guardados y compartidos en cero** es la segunda más
delatora: los paquetes vendidos incluyen likes, a veces comentarios, nunca guardar
ni compartir — porque esas acciones no se pueden simular en volumen sin costo real.

### Muestra de cuentas que dieron like

Toca el contador de likes del post y anota **entre 30 y 50 cuentas** — es lo que
pide el auditor para que el porcentaje signifique algo; por debajo de 20 lo reporta
pero no le da peso. **Tómalas salteadas, no las primeras 30:** Instagram ordena la
lista poniendo arriba a quienes sigues, así que el techo de la lista es tu círculo
real y no representa al resto.

De cada una, con entrar al perfil basta:

```json
{
  "usuario": "maria_8837",
  "foto_perfil": false,
  "publicaciones": 0,
  "seguidores": 4,
  "seguidos": 2100,
  "bio": "",
  "privada": true,
  "verificada": false
}
```

Y copia el texto de los comentarios a `comentarios_texto`.

---

## Cómo se usa

```bash
cp ejemplo_post.json mi_post.json      # rellenar; lo desconocido va en null
python3 auditor_ig.py mi_post.json
python3 auditor_ig.py mi_post.json --html informe.html
```

Sin dependencias: Python 3 y nada más.

---

## Qué mira el auditor

**Nivel macro** — sobre los números del post

| Señal | Umbral de sospecha | Por qué funciona |
|---|---|---|
| Likes > alcance | cualquier exceso | Imposible físicamente. Prueba directa |
| Likes / alcance | > 25% | Lo orgánico convierte 3–12% del alcance |
| Ratio likes:comentarios | > 500:1 · crítico > 1000:1 | El bot da like en milisegundos; comentar le cuesta |
| Guardados+compartidos / likes | < 0,5% | Los paquetes no incluyen señal profunda |
| Salto contra histórico | > 5× la mediana | Un pico sin causa visible es compra |
| Engagement rate por tramo | fuera de banda | Benchmarks 2026: nano ≈4%, micro ≈2,5%, medio ≈1,5%, macro ≈0,7% |
| Curva de acumulación | > 85% en la 1ª hora y luego plana | El paquete se entrega en bloque; lo orgánico gotea días |

**Nivel cuenta** — puntaje 0–100 por perfil

Sin foto, cero publicaciones, biografía vacía, ratio seguidos/seguidores
desproporcionado, seguir a miles de cuentas, usuario alfanumérico autogenerado.
**Ninguna señal condena sola** — hay gente real sin foto y con nombre+números.
Condena la acumulación. Corte: 0–24 real · 25–49 dudosa · 50–74 sospechosa · 75+ bot.

**Nivel población** — la firma del lote

Es el más importante en 2026, porque los bots actuales tienen foto generada por IA
y biografía creíble: revisar perfiles de a uno ya no los caza. Lo que no pueden
disimular es que el lote completo se creó con el mismo script. El auditor reduce
cada usuario a su *forma* (`maria_8837` → `aaaaa_9999`) y busca formas repetidas.
Personas distintas no eligen nombres con la misma plantilla; scripts sí.

**Nivel comentarios** — porcentaje de genéricos y duplicados literales. Una audiencia
real menciona algo concreto del post; el paquete deja elogios que servirían para
cualquier publicación.

---

## Cómo leer el veredicto

| Índice | Lectura |
|---|---|
| 0–19 | Consistente con engagement orgánico |
| 20–39 | Señales mixtas — completar datos antes de concluir |
| 40–64 | Altamente sospechoso — patrón no orgánico sin prueba directa |
| 65–100 · o cualquier hallazgo CRÍTICO | Engagement comprado |

Un solo hallazgo **CRÍTICO** fuerza el veredicto máximo por sí solo: son los
imposibles físicos, no los indicios.

---

## Dos advertencias antes de acusar a alguien

**Un engagement rate alto no es prueba de nada por sí solo.** Con Reels y Explorar,
una cuenta chica puede legítimamente recibir más likes que seguidores. Por eso el
auditor, cuando le das el alcance, baja el peso del engagement rate sobre seguidores
y decide con la conversión alcance→like, que es la métrica honesta.

**Los likes falsos no siempre los compró el dueño de la cuenta.** Existe el *bot
spam* — granjas que reparten likes sin que nadie los pida — y el sabotaje, donde un
tercero compra engagement falso sobre una cuenta ajena para que el algoritmo la
penalice. Si vas a auditar a un competidor, un influencer que te cotiza o un
proveedor, el informe demuestra que **el engagement no es real**; atribuir *quién lo
compró* requiere evidencia distinta.
