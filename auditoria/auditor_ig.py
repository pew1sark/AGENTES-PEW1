#!/usr/bin/env python3
"""
AUDITOR IG — Auditoría de autenticidad de engagement en Instagram

Analiza si los likes de una publicación son reales o comprados, y puntúa
cuenta por cuenta la probabilidad de que sean bots.

Uso:
    python3 auditor_ig.py datos.json
    python3 auditor_ig.py datos.json --html informe.html

El JSON de entrada se documenta en PROTOCOLO.md y hay una plantilla lista
para rellenar en ejemplo_post.json.

No scrapea ni accede a Instagram: trabaja sobre datos que tú recolectas a
mano desde la app o exportas desde Instagram Insights / Meta Business Suite.
"""

import json
import re
import statistics
import sys
from collections import Counter
from dataclasses import dataclass, field

# ─── Benchmarks 2026 ─────────────────────────────────────────────────────────
# Engagement rate sobre seguidores, por tramo de cuenta. Las bandas "sanas"
# son anchas a propósito: salirse por abajo indica audiencia muerta, salirse
# por arriba indica inflado (salvo que el alcance lo justifique).
#            hasta        nombre    esperado  sano_min  sano_max  alerta_sup
TRAMOS = [
    (10_000,      "nano",   4.0,  1.5, 12.0, 18.0),
    (50_000,      "micro",  2.5,  1.0,  7.0, 12.0),
    (500_000,     "medio",  1.5,  0.6,  4.0,  8.0),
    (10 ** 12,    "macro",  0.7,  0.3,  2.5,  5.0),
]

# Ratio likes:comentarios. Los bots dan like en milisegundos; comentar les
# cuesta, así que el ratio se dispara cuando el engagement está comprado.
RATIO_LC_SANO = 200
RATIO_LC_ATENCION = 500
RATIO_LC_ALERTA = 1000

# Porcentaje de likes sobre alcance. Un post público real convierte entre un
# 3% y un 12% del alcance en likes. Por encima de 25% el embudo no cierra.
LIKES_ALCANCE_ALTO = 25.0
LIKES_ALCANCE_EXTREMO = 40.0

# Por debajo de esta muestra, un porcentaje de bots no es representativo:
# con 5 cuentas, una sola granja da 20% y eso no dice nada del post.
MUESTRA_MINIMA = 20

NIVELES = {"OK": 0, "ATENCION": 1, "ALERTA": 2, "CRITICO": 3}


@dataclass
class Hallazgo:
    nivel: str
    titulo: str
    detalle: str
    peso: int = 0          # aporte al índice de sospecha (0-100)
    metrica: str = ""      # valor numérico para la tabla resumen


@dataclass
class Cuenta:
    usuario: str
    puntaje: int = 0
    motivos: list = field(default_factory=list)

    @property
    def clase(self):
        if self.puntaje >= 75:
            return "BOT"
        if self.puntaje >= 50:
            return "SOSPECHOSA"
        if self.puntaje >= 25:
            return "DUDOSA"
        return "REAL"


# ─── Utilidades ──────────────────────────────────────────────────────────────

def tramo_de(seguidores):
    for tope, nombre, esperado, smin, smax, alerta in TRAMOS:
        if seguidores < tope:
            return nombre, esperado, smin, smax, alerta
    return TRAMOS[-1][1:]


def forma_usuario(u):
    """Reduce un usuario a su 'forma': maria_8837 -> aaaaa_9999.

    Sirve para detectar lotes generados por el mismo script: cuando decenas
    de cuentas comparten forma exacta, no son personas distintas.
    """
    return "".join("9" if c.isdigit() else "a" if c.isalpha() else c for c in u)


def ratio_vocales(u):
    letras = [c for c in u.lower() if c.isalpha()]
    if not letras:
        return 0.0
    return sum(1 for c in letras if c in "aeiou") / len(letras)


def pct(parte, total):
    return (parte / total * 100) if total else 0.0


# ─── Nivel 1: análisis macro (no necesita la lista de cuentas) ───────────────

def analizar_macro(post, historico):
    """Señales que se detectan solo con los números del post.

    Este bloque ya basta para saber si hay compra de likes; la lista de
    cuentas sirve después para saber de qué proveedor y con qué calidad.
    """
    h = []
    likes = post.get("likes") or 0
    comentarios = post.get("comentarios") or 0
    seguidores = post.get("seguidores_autor") or 0
    alcance = post.get("alcance")
    guardados = post.get("guardados") or 0
    compartidos = post.get("compartidos") or 0

    # --- Ratio likes:comentarios -------------------------------------------
    if comentarios == 0 and likes >= 100:
        h.append(Hallazgo(
            "ALERTA", "Cero comentarios con volumen alto de likes",
            f"{likes} likes y ningún comentario. Un post que mueve a {likes} "
            "personas a tocar el corazón normalmente mueve al menos a una a escribir.",
            peso=22, metrica=f"{likes}:0"))
    elif comentarios:
        ratio = likes / comentarios
        if ratio > RATIO_LC_ALERTA:
            h.append(Hallazgo(
                "CRITICO", "Ratio likes:comentarios propio de automatización",
                f"{ratio:.0f} likes por cada comentario. Por encima de {RATIO_LC_ALERTA}:1 "
                "el patrón es característico de likes comprados: el bot da like, no conversa.",
                peso=28, metrica=f"{ratio:.0f}:1"))
        elif ratio > RATIO_LC_ATENCION:
            h.append(Hallazgo(
                "ALERTA", "Ratio likes:comentarios muy alto",
                f"{ratio:.0f} likes por cada comentario (umbral de sospecha: {RATIO_LC_ATENCION}:1).",
                peso=16, metrica=f"{ratio:.0f}:1"))
        elif ratio > RATIO_LC_SANO:
            h.append(Hallazgo(
                "ATENCION", "Ratio likes:comentarios por encima de lo habitual",
                f"{ratio:.0f} likes por comentario. Puede ser contenido poco "
                "conversacional (arte, paisaje) o inicio de inflado.",
                peso=6, metrica=f"{ratio:.0f}:1"))
        else:
            h.append(Hallazgo(
                "OK", "Ratio likes:comentarios saludable",
                f"{ratio:.0f} likes por comentario, dentro del rango orgánico.",
                metrica=f"{ratio:.0f}:1"))

    # --- Likes contra alcance (la métrica honesta) -------------------------
    if alcance:
        conv = pct(likes, alcance)
        if likes > alcance:
            h.append(Hallazgo(
                "CRITICO", "Más likes que alcance: imposible orgánicamente",
                f"{likes} likes sobre {alcance} cuentas alcanzadas. Nadie puede dar "
                "like sin haber visto el post: los likes entraron desde fuera de la "
                "distribución de Instagram. Esto es prueba directa de compra.",
                peso=40, metrica=f"{conv:.0f}%"))
        elif conv > LIKES_ALCANCE_EXTREMO:
            h.append(Hallazgo(
                "CRITICO", "Conversión alcance→like fuera de rango",
                f"{conv:.1f}% del alcance dio like. Lo orgánico vive entre 3% y 12%.",
                peso=30, metrica=f"{conv:.1f}%"))
        elif conv > LIKES_ALCANCE_ALTO:
            h.append(Hallazgo(
                "ALERTA", "Conversión alcance→like anormalmente alta",
                f"{conv:.1f}% del alcance dio like (esperable: 3–12%).",
                peso=18, metrica=f"{conv:.1f}%"))
        else:
            h.append(Hallazgo(
                "OK", "Conversión alcance→like normal",
                f"{conv:.1f}% del alcance dio like, dentro del rango orgánico.",
                metrica=f"{conv:.1f}%"))

    # --- Engagement rate sobre seguidores ----------------------------------
    if seguidores:
        er = pct(likes + comentarios + guardados + compartidos, seguidores)
        nombre, esperado, smin, smax, alerta = tramo_de(seguidores)
        etiqueta = f"{er:.2f}% (tramo {nombre}, esperado ≈{esperado}%)"
        if er > alerta and not alcance:
            h.append(Hallazgo(
                "ALERTA", "Engagement rate muy por encima de su tramo",
                f"{etiqueta}. Sin dato de alcance no se puede descartar que sea "
                "un post que se distribuyó fuera de sus seguidores; con alcance "
                "en la mano esta señal se resuelve sola.",
                peso=12, metrica=f"{er:.2f}%"))
        elif er > alerta:
            h.append(Hallazgo(
                "ATENCION", "Engagement rate alto para su tramo",
                f"{etiqueta}. El alcance reportado lo explica en parte.",
                peso=4, metrica=f"{er:.2f}%"))
        elif er < smin:
            h.append(Hallazgo(
                "ATENCION", "Engagement rate bajo para su tramo",
                f"{etiqueta}. Indica audiencia inactiva o comprada en el pasado, "
                "no likes falsos en este post.",
                peso=5, metrica=f"{er:.2f}%"))
        else:
            h.append(Hallazgo(
                "OK", "Engagement rate coherente con el tamaño de la cuenta",
                etiqueta, metrica=f"{er:.2f}%"))

    # --- Guardados y compartidos -------------------------------------------
    if likes >= 200 and (guardados or compartidos):
        senal_real = pct(guardados + compartidos, likes)
        if senal_real < 0.5:
            h.append(Hallazgo(
                "ALERTA", "Likes sin guardados ni compartidos que los acompañen",
                f"Solo {guardados + compartidos} guardados+compartidos frente a {likes} likes "
                f"({senal_real:.2f}%). Los paquetes de likes no incluyen guardar ni compartir: "
                "es de las asimetrías más delatoras.",
                peso=20, metrica=f"{senal_real:.2f}%"))
        else:
            h.append(Hallazgo(
                "OK", "Guardados y compartidos acompañan a los likes",
                f"{senal_real:.1f}% de señal profunda sobre likes.",
                metrica=f"{senal_real:.1f}%"))

    # --- Anomalía contra el histórico de la cuenta -------------------------
    previos = [p.get("likes", 0) for p in historico if p.get("likes")]
    if len(previos) >= 3:
        mediana = statistics.median(previos)
        if mediana > 0:
            salto = likes / mediana
            if salto >= 5:
                h.append(Hallazgo(
                    "ALERTA", "Salto brusco frente al histórico de la cuenta",
                    f"{likes} likes contra una mediana de {mediana:.0f} en sus posts "
                    f"anteriores: {salto:.1f}× lo normal. Un salto así necesita una causa "
                    "visible (viralización, colaboración, pauta). Si no la hay, es compra.",
                    peso=20, metrica=f"{salto:.1f}×"))
            elif salto >= 2.5:
                h.append(Hallazgo(
                    "ATENCION", "Post por encima de su histórico",
                    f"{salto:.1f}× la mediana histórica ({mediana:.0f} likes). "
                    "Rango alto pero alcanzable de forma orgánica.",
                    peso=6, metrica=f"{salto:.1f}×"))
            else:
                h.append(Hallazgo(
                    "OK", "Coherente con el histórico de la cuenta",
                    f"{salto:.1f}× la mediana histórica ({mediana:.0f} likes).",
                    metrica=f"{salto:.1f}×"))

    # --- Velocidad de acumulación ------------------------------------------
    primera_hora = post.get("likes_primera_hora")
    if primera_hora and likes:
        p = pct(primera_hora, likes)
        horas = post.get("horas_desde_publicacion") or 0
        if p > 85 and horas >= 12:
            h.append(Hallazgo(
                "ALERTA", "Curva de likes de golpe y luego plana",
                f"{p:.0f}% de los likes entraron en la primera hora y después la "
                f"publicación se detuvo ({horas}h de vida). Los paquetes se entregan "
                "en bloque; lo orgánico sigue goteando durante días.",
                peso=18, metrica=f"{p:.0f}% en 1h"))
        else:
            h.append(Hallazgo(
                "OK", "Curva de acumulación sin entrega en bloque",
                f"{p:.0f}% de los likes en la primera hora.",
                metrica=f"{p:.0f}% en 1h"))

    return h


# ─── Nivel 2: puntuación cuenta por cuenta ───────────────────────────────────

RE_NOMBRE_DIGITOS = re.compile(r"^[a-z._]+[._]?\d{4,}$", re.I)
RE_ALFANUM_CAOS = re.compile(r"^[a-z]{2,5}\d{6,}$", re.I)
RE_SOLO_LETRAS_LARGO = re.compile(r"^[a-z]{12,}$", re.I)


def puntuar_cuenta(d):
    """Puntaje 0-100 de probabilidad de bot para una cuenta.

    Ninguna señal condena por sí sola: un usuario real puede no tener foto o
    llamarse nombre+números. Lo que condena es la acumulación.
    """
    u = (d.get("usuario") or "").lstrip("@")
    c = Cuenta(usuario=u)
    p = 0
    m = []

    posts = d.get("publicaciones")
    seguidores = d.get("seguidores")
    seguidos = d.get("seguidos")
    bio = (d.get("bio") or "").strip()

    if d.get("verificada"):
        c.puntaje, c.motivos = 0, ["cuenta verificada"]
        return c

    if d.get("foto_perfil") is False:
        p += 15
        m.append("sin foto de perfil")

    if posts == 0:
        p += 20
        m.append("cero publicaciones")
    elif posts is not None and posts <= 2:
        p += 8
        m.append(f"solo {posts} publicación" + ("es" if posts != 1 else ""))

    if seguidos and seguidores is not None:
        if seguidores == 0:
            p += 18
            m.append("sin seguidores")
        else:
            r = seguidos / max(seguidores, 1)
            if r > 20:
                p += 20
                m.append(f"sigue {r:.0f}× más cuentas de las que la siguen")
            elif r > 10:
                p += 14
                m.append(f"ratio seguidos/seguidores {r:.0f}×")
            elif r > 5:
                p += 7
                m.append(f"ratio seguidos/seguidores {r:.0f}×")

    if seguidos and seguidos > 4000:
        p += 12
        m.append(f"sigue a {seguidos} cuentas")
    elif seguidos and seguidos > 2000:
        p += 6
        m.append(f"sigue a {seguidos} cuentas")

    if seguidores is not None and seguidores < 20 and seguidos and seguidos > 500:
        p += 15
        m.append("perfil de consumo masivo sin audiencia propia")

    if not bio:
        p += 6
        m.append("biografía vacía")

    if u:
        if RE_ALFANUM_CAOS.match(u):
            p += 20
            m.append("usuario alfanumérico autogenerado")
        elif RE_NOMBRE_DIGITOS.match(u):
            p += 12
            m.append("usuario tipo nombre+dígitos")
        elif RE_SOLO_LETRAS_LARGO.match(u) and ratio_vocales(u) < 0.28:
            p += 14
            m.append("usuario sin estructura pronunciable")
        if sum(ch.isdigit() for ch in u) >= 6:
            p += 8
            m.append("6+ dígitos en el usuario")

    if d.get("privada") and posts in (0, None) and (seguidores or 0) < 30:
        p += 10
        m.append("privada, vacía y sin audiencia")

    c.puntaje = min(p, 100)
    c.motivos = m
    return c


# ─── Nivel 3: análisis de la población de likers ─────────────────────────────

def analizar_poblacion(cuentas_raw):
    """La firma de un lote comprado está en el conjunto, no en la cuenta suelta.

    Un bot moderno tiene foto generada por IA y bio creíble, así que revisar
    perfiles uno a uno ya no basta. Lo que no pueden disimular es que el lote
    completo comparte estructura: se crearon con el mismo script.
    """
    h = []
    if not cuentas_raw:
        return h, []

    cuentas = [puntuar_cuenta(d) for d in cuentas_raw]
    n = len(cuentas)

    bots = [c for c in cuentas if c.clase == "BOT"]
    sosp = [c for c in cuentas if c.clase == "SOSPECHOSA"]
    dud = [c for c in cuentas if c.clase == "DUDOSA"]
    no_reales = pct(len(bots) + len(sosp), n)

    detalle_muestra = (f"Muestra de {n} cuentas: {len(bots)} bot, {len(sosp)} sospechosas, "
                       f"{len(dud)} dudosas, {n - len(bots) - len(sosp) - len(dud)} reales.")

    if n < MUESTRA_MINIMA:
        # Se informa el dato, pero no se le da peso ni se eleva el nivel:
        # extrapolar una tasa de bots desde una muestra chica es inventar.
        h.append(Hallazgo(
            "ATENCION" if no_reales >= 20 else "OK",
            "Muestra insuficiente para estimar la tasa de bots",
            f"{no_reales:.0f}% no auténticas, pero sobre solo {n} cuenta" + ("s" if n != 1 else "") + f". {detalle_muestra} "
            f"Hacen falta al menos {MUESTRA_MINIMA} (idealmente 30–50) para que el "
            "porcentaje signifique algo. Las cuentas individuales sí quedan clasificadas abajo.",
            peso=0, metrica=f"n={n}"))
    elif no_reales >= 40:
        h.append(Hallazgo("CRITICO", "La mayoría de la muestra no son cuentas reales",
                          f"{no_reales:.0f}% entre bots y sospechosas. {detalle_muestra}",
                          peso=35, metrica=f"{no_reales:.0f}%"))
    elif no_reales >= 20:
        h.append(Hallazgo("ALERTA", "Proporción alta de cuentas no auténticas",
                          f"{no_reales:.0f}% entre bots y sospechosas, sobre un ruido de fondo "
                          f"orgánico esperable de 5–12%. {detalle_muestra}",
                          peso=22, metrica=f"{no_reales:.0f}%"))
    elif no_reales >= 12:
        h.append(Hallazgo("ATENCION", "Presencia de cuentas no auténticas por sobre lo normal",
                          f"{no_reales:.0f}% entre bots y sospechosas. {detalle_muestra}",
                          peso=8, metrica=f"{no_reales:.0f}%"))
    else:
        h.append(Hallazgo("OK", "Población de likers dentro del ruido orgánico",
                          f"{no_reales:.0f}% no auténticas. {detalle_muestra}",
                          metrica=f"{no_reales:.0f}%"))

    # --- Lotes con la misma forma de usuario -------------------------------
    formas = Counter(forma_usuario(c.usuario) for c in cuentas if c.usuario)
    lotes = ([(f, k) for f, k in formas.items()
              if k >= max(4, n * 0.06) and any(ch.isdigit() for ch in f)] if n >= 10 else [])
    if lotes:
        lotes.sort(key=lambda x: -x[1])
        desc = ", ".join(f"{f} ×{k}" for f, k in lotes[:4])
        cubiertas = sum(k for _, k in lotes)
        h.append(Hallazgo(
            "ALERTA", "Lotes de usuarios generados por el mismo patrón",
            f"{cubiertas} cuentas ({pct(cubiertas, n):.0f}% de la muestra) comparten "
            f"estructura exacta de nombre: {desc}. Personas distintas no eligen "
            "nombres con la misma plantilla; scripts sí.",
            peso=25, metrica=f"{len(lotes)} lotes"))

    # --- Homogeneidad del comportamiento -----------------------------------
    seguidos = [d.get("seguidos") for d in cuentas_raw if isinstance(d.get("seguidos"), int)]
    if len(seguidos) >= 10:
        masivos = pct(sum(1 for s in seguidos if s > 1500), len(seguidos))
        if masivos > 50:
            h.append(Hallazgo(
                "ALERTA", "Audiencia compuesta por cuentas de seguimiento masivo",
                f"{masivos:.0f}% de la muestra sigue a más de 1.500 cuentas. "
                "Perfil típico de granja: existen para repartir interacción.",
                peso=18, metrica=f"{masivos:.0f}%"))

    sin_posts = [d.get("publicaciones") for d in cuentas_raw if d.get("publicaciones") is not None]
    if len(sin_posts) >= 10:
        vacias = pct(sum(1 for x in sin_posts if x == 0), len(sin_posts))
        if vacias > 30:
            h.append(Hallazgo(
                "ALERTA", "Alta proporción de perfiles sin ninguna publicación",
                f"{vacias:.0f}% de la muestra no ha publicado nunca.",
                peso=16, metrica=f"{vacias:.0f}%"))

    return h, cuentas


# ─── Nivel 4: calidad de los comentarios ─────────────────────────────────────

GENERICOS = {
    "nice", "wow", "cool", "great", "amazing", "love it", "so nice", "perfect",
    "beautiful", "awesome", "good", "top", "lindo", "hermoso", "genial",
    "increible", "increíble", "bonito", "que lindo", "qué lindo", "brutal",
    "crack", "grande", "bueno", "excelente", "buenisimo", "buenísimo",
}


def analizar_comentarios(textos):
    h = []
    if not textos:
        return h
    n = len(textos)
    genericos = 0
    for t in textos:
        limpio = re.sub(r"[^\w\sáéíóúñü]", "", (t or "").lower()).strip()
        sin_emoji_ni_texto = not limpio
        if sin_emoji_ni_texto or limpio in GENERICOS or len(limpio.split()) <= 1:
            genericos += 1
    p = pct(genericos, n)
    duplicados = n - len(set((t or "").strip().lower() for t in textos))

    if p >= 70:
        h.append(Hallazgo("ALERTA", "Comentarios sin contenido específico",
                          f"{p:.0f}% de los comentarios son emojis sueltos o elogios genéricos "
                          "que servirían para cualquier publicación. Una audiencia real "
                          "menciona algo concreto del post.",
                          peso=15, metrica=f"{p:.0f}%"))
    elif p >= 45:
        h.append(Hallazgo("ATENCION", "Comentarios mayoritariamente genéricos",
                          f"{p:.0f}% sin referencia concreta al contenido.",
                          peso=6, metrica=f"{p:.0f}%"))
    else:
        h.append(Hallazgo("OK", "Comentarios con contenido específico",
                          f"Solo {p:.0f}% genéricos.", metrica=f"{p:.0f}%"))

    if duplicados >= max(2, n * 0.15):
        h.append(Hallazgo("ALERTA", "Comentarios repetidos literalmente",
                          f"{duplicados} comentarios idénticos a otro. Señal de paquete "
                          "de comentarios con plantilla.",
                          peso=14, metrica=f"{duplicados} repetidos"))
    return h


# ─── Veredicto ───────────────────────────────────────────────────────────────

def veredicto(hallazgos, tiene_muestra, post):
    indice = min(sum(x.peso for x in hallazgos), 100)
    critico = any(x.nivel == "CRITICO" for x in hallazgos)

    # Sin datos no hay veredicto. Declarar "consistente" porque no se
    # encontró nada, cuando no se pudo mirar nada, es un certificado falso.
    likes = post.get("likes")
    contexto = post.get("comentarios") is not None or post.get("seguidores_autor")
    if not likes or not contexto:
        falta = []
        if not likes:
            falta.append("likes")
        if post.get("comentarios") is None:
            falta.append("comentarios")
        if not post.get("seguidores_autor"):
            falta.append("seguidores del autor")
        return 0, "DATOS INSUFICIENTES", (
            "No se puede emitir veredicto: falta " + ", ".join(falta) + ". "
            "Con likes, comentarios y seguidores del autor ya hay auditoría macro; "
            "ver la vía rápida en PROTOCOLO.md.")

    if critico or indice >= 65:
        titulo = "ENGAGEMENT COMPRADO"
        texto = ("Las cifras no se sostienen de forma orgánica. Hay evidencia suficiente "
                 "para afirmar que una parte relevante de los likes fue adquirida.")
    elif indice >= 40:
        titulo = "ALTAMENTE SOSPECHOSO"
        texto = ("Varias señales apuntan a inflado artificial. Falta una prueba directa, "
                 "pero el patrón general no es el de una publicación orgánica.")
    elif indice >= 20:
        titulo = "SEÑALES MIXTAS"
        texto = ("Hay indicadores fuera de rango, aunque explicables por el tipo de "
                 "contenido o por distribución fuera de seguidores. Conviene completar datos.")
    else:
        titulo = "ENGAGEMENT CONSISTENTE"
        texto = "Los números se comportan como los de una publicación orgánica."

    if not tiene_muestra:
        texto += ("\n  Nota: sin muestra de cuentas que dieron like, el veredicto se apoya "
                  "solo en el nivel macro. Añadir 30–50 cuentas lo vuelve concluyente.")
    return indice, titulo, texto


# ─── Salida ──────────────────────────────────────────────────────────────────

SIMBOLO = {"OK": "○", "ATENCION": "◐", "ALERTA": "●", "CRITICO": "▲"}


def render_terminal(post, hallazgos, cuentas, indice, titulo, texto):
    a = []
    a.append("")
    a.append("─" * 74)
    a.append("  AUDITORÍA DE AUTENTICIDAD — INSTAGRAM")
    a.append("─" * 74)
    a.append(f"  Publicación : {post.get('url', 's/d')}")
    a.append(f"  Autor       : {post.get('autor', 's/d')}")
    a.append(f"  Likes       : {post.get('likes') or 's/d'}   "
             f"Comentarios: {post.get('comentarios') if post.get('comentarios') is not None else 's/d'}   "
             f"Alcance: {post.get('alcance') or 's/d'}")
    a.append("")

    orden = sorted(hallazgos, key=lambda x: -NIVELES[x.nivel])
    for grupo in ("CRITICO", "ALERTA", "ATENCION", "OK"):
        items = [x for x in orden if x.nivel == grupo]
        if not items:
            continue
        a.append(f"  {grupo}")
        for x in items:
            a.append(f"   {SIMBOLO[x.nivel]} {x.titulo}" + (f"  [{x.metrica}]" if x.metrica else ""))
            for linea in _envolver(x.detalle, 66):
                a.append(f"     {linea}")
        a.append("")

    if cuentas:
        a.append("  CUENTAS ANALIZADAS")
        for c in sorted(cuentas, key=lambda c: -c.puntaje)[:40]:
            motivos = "; ".join(c.motivos[:3]) or "sin señales"
            a.append(f"   {c.puntaje:3d}  {c.clase:11s} @{c.usuario[:24]:24s} {motivos[:60]}")
        if len(cuentas) > 40:
            a.append(f"   … y {len(cuentas) - 40} cuentas más en el informe HTML")
        a.append("")

    a.append("─" * 74)
    a.append(f"  ÍNDICE DE SOSPECHA: {indice}/100    →    {titulo}")
    a.append("─" * 74)
    for linea in _envolver(texto, 70):
        a.append(f"  {linea}")
    a.append("")
    return "\n".join(a)


def _envolver(t, ancho):
    salida = []
    for parrafo in t.split("\n"):
        linea = ""
        for palabra in parrafo.split():
            if len(linea) + len(palabra) + 1 > ancho:
                salida.append(linea)
                linea = palabra
            else:
                linea = f"{linea} {palabra}".strip()
        salida.append(linea)
    return salida


def render_html(post, hallazgos, cuentas, indice, titulo, texto):
    color = "#C0392B" if indice >= 65 else "#C87941" if indice >= 40 else "#C8A96E" if indice >= 20 else "#7B9E87"
    filas = []
    for x in sorted(hallazgos, key=lambda x: -NIVELES[x.nivel]):
        c = {"CRITICO": "#C0392B", "ALERTA": "#C87941", "ATENCION": "#C8A96E", "OK": "#7B9E87"}[x.nivel]
        filas.append(
            f'<div class="h"><span class="n" style="background:{c}">{x.nivel}</span>'
            f'<div><strong>{_esc(x.titulo)}</strong>'
            f'{f"<em>{_esc(x.metrica)}</em>" if x.metrica else ""}'
            f'<p>{_esc(x.detalle)}</p></div></div>')

    cfilas = []
    for c in sorted(cuentas, key=lambda c: -c.puntaje):
        col = {"BOT": "#C0392B", "SOSPECHOSA": "#C87941", "DUDOSA": "#C8A96E", "REAL": "#7B9E87"}[c.clase]
        cfilas.append(f'<tr><td style="color:{col};font-weight:600">{c.puntaje}</td>'
                      f'<td style="color:{col}">{c.clase}</td><td>@{_esc(c.usuario)}</td>'
                      f'<td>{_esc("; ".join(c.motivos) or "—")}</td></tr>')

    tabla = ("<h2>Cuentas analizadas</h2><table><thead><tr><th>Puntaje</th><th>Clase</th>"
             "<th>Usuario</th><th>Señales</th></tr></thead><tbody>"
             + "".join(cfilas) + "</tbody></table>") if cfilas else ""

    return f"""<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Auditoría de autenticidad</title><style>
*{{box-sizing:border-box}}
body{{font-family:-apple-system,'Helvetica Neue',sans-serif;background:#fff;color:#1a1a1a;
max-width:820px;margin:0 auto;padding:48px 28px;line-height:1.6}}
.et{{font-size:11px;letter-spacing:.25em;text-transform:uppercase;color:#888}}
h1{{font-size:26px;letter-spacing:.04em;margin:.2em 0 .1em}}
h2{{font-size:15px;letter-spacing:.03em;color:{color};margin-top:2.4em;
border-top:1px solid #eee;padding-top:1.4em}}
.meta{{font-size:13px;color:#666;margin-bottom:2.4em}}
.meta span{{display:inline-block;margin-right:1.6em}}
.idx{{border:1px solid #eee;border-left:4px solid {color};padding:22px 26px;margin:2em 0}}
.idx .v{{font-size:40px;font-weight:600;color:{color};line-height:1}}
.idx .t{{font-size:15px;letter-spacing:.12em;text-transform:uppercase;margin:.5em 0}}
.idx p{{font-size:14px;color:#444;margin:0;white-space:pre-line}}
.h{{display:flex;gap:14px;padding:14px 0;border-bottom:1px solid #f2f2f2;align-items:flex-start}}
.n{{color:#fff;font-size:9px;letter-spacing:.1em;padding:3px 8px;border-radius:2px;
white-space:nowrap;margin-top:3px}}
.h em{{font-style:normal;font-size:12px;color:#888;margin-left:10px}}
.h p{{margin:.4em 0 0;font-size:14px;color:#444}}
table{{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:1em;display:block;overflow-x:auto}}
th{{text-align:left;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:#888;
border-bottom:1px solid #ddd;padding:8px 10px 8px 0}}
td{{padding:7px 10px 7px 0;border-bottom:1px solid #f4f4f4;vertical-align:top}}
</style></head><body>
<div class="et">Auditoría de autenticidad</div>
<h1>{_esc(post.get('autor', 'Publicación'))}</h1>
<div class="meta"><span>{_esc(post.get('url', ''))}</span><br>
<span>Likes: {post.get('likes') or 's/d'}</span>
<span>Comentarios: {post.get('comentarios') if post.get('comentarios') is not None else 's/d'}</span>
<span>Alcance: {post.get('alcance') or 's/d'}</span>
<span>Seguidores: {post.get('seguidores_autor') or 's/d'}</span></div>
<div class="idx"><div class="v">{indice}<span style="font-size:16px;color:#999">/100</span></div>
<div class="t">{_esc(titulo)}</div><p>{_esc(texto)}</p></div>
<h2>Hallazgos</h2>{''.join(filas)}
{tabla}
</body></html>"""


def _esc(t):
    return (str(t).replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;"))


# ─── Entrada ─────────────────────────────────────────────────────────────────

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    with open(sys.argv[1], encoding="utf-8") as f:
        datos = json.load(f)

    post = datos.get("post", {})
    hallazgos = analizar_macro(post, datos.get("historico", []))
    h_pob, cuentas = analizar_poblacion(datos.get("cuentas", []))
    hallazgos += h_pob
    hallazgos += analizar_comentarios(datos.get("comentarios_texto", []))

    indice, titulo, texto = veredicto(hallazgos, bool(cuentas), post)
    print(render_terminal(post, hallazgos, cuentas, indice, titulo, texto))

    if "--html" in sys.argv:
        destino = sys.argv[sys.argv.index("--html") + 1]
        with open(destino, "w", encoding="utf-8") as f:
            f.write(render_html(post, hallazgos, cuentas, indice, titulo, texto))
        print(f"  Informe HTML: {destino}\n")


if __name__ == "__main__":
    main()
