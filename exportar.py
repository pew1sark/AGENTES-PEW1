#!/usr/bin/env python3
"""
Exportador de documentos SarkPEW1
Convierte texto markdown a HTML con estilo de marca y abre en Safari para guardar como PDF.

Uso:
    python3 exportar.py "Titulo del Documento" tipo archivo.md
    python3 exportar.py "Propuesta Cafetería Central" propuesta propuesta.md
    python3 exportar.py "Ficha Hotel Boutique" prospecto ficha.md

Tipos disponibles: propuesta | prospecto | produccion | cotizacion | concepto | general
"""

import sys
import os
import re
import base64
import subprocess
import datetime

# ─── Colores y estética por tipo de documento ───────────────────────────────

TIPOS = {
    "propuesta":   {"color": "#1a1a1a", "acento": "#C8A96E", "etiqueta": "PROPUESTA ARTÍSTICA"},
    "prospecto":   {"color": "#1a1a1a", "acento": "#7B9E87", "etiqueta": "FICHA DE PROSPECTO"},
    "produccion":  {"color": "#1a1a1a", "acento": "#8B7BA8", "etiqueta": "PLAN DE PRODUCCIÓN"},
    "cotizacion":  {"color": "#1a1a1a", "acento": "#C87941", "etiqueta": "COTIZACIÓN"},
    "concepto":    {"color": "#1a1a1a", "acento": "#4A90A4", "etiqueta": "CONCEPTO CREATIVO"},
    "general":     {"color": "#1a1a1a", "acento": "#888888", "etiqueta": "DOCUMENTO"},
}


def md_a_html(texto):
    """Convierte markdown básico a HTML."""
    lineas = texto.split('\n')
    html = []
    en_lista = False
    en_ol = False
    en_tabla = False
    en_codigo = False
    bloque_codigo = []

    for linea in lineas:
        # Bloques de código
        if linea.strip().startswith('```'):
            if not en_codigo:
                en_codigo = True
                bloque_codigo = []
            else:
                en_codigo = False
                contenido = '\n'.join(bloque_codigo)
                html.append(f'<pre><code>{contenido}</code></pre>')
                bloque_codigo = []
            continue

        if en_codigo:
            bloque_codigo.append(linea.replace('<', '&lt;').replace('>', '&gt;'))
            continue

        # Tablas
        if '|' in linea and linea.strip().startswith('|'):
            if not en_tabla:
                en_tabla = True
                html.append('<table>')
                celdas = [c.strip() for c in linea.strip().strip('|').split('|')]
                html.append('<thead><tr>' + ''.join(f'<th>{c}</th>' for c in celdas) + '</tr></thead><tbody>')
            elif re.match(r'[\|\s\-:]+$', linea):
                continue
            else:
                celdas = [c.strip() for c in linea.strip().strip('|').split('|')]
                html.append('<tr>' + ''.join(f'<td>{inline_md(c)}</td>' for c in celdas) + '</tr>')
            continue
        elif en_tabla:
            html.append('</tbody></table>')
            en_tabla = False

        # Línea horizontal
        if re.match(r'^---+$', linea.strip()):
            if en_lista:
                html.append('</ul>')
                en_lista = False
            if en_ol:
                html.append('</ol>')
                en_ol = False
            html.append('<hr>')
            continue

        # Checkboxes
        if re.match(r'^\s*-\s+\[[ x]\]', linea):
            checked = 'checked' if '[x]' in linea else ''
            texto_item = re.sub(r'^\s*-\s+\[[ x]\]\s*', '', linea)
            if not en_lista:
                html.append('<ul class="checklist">')
                en_lista = True
            html.append(f'<li><input type="checkbox" {checked} disabled> {inline_md(texto_item)}</li>')
            continue

        # Listas
        if re.match(r'^\s*[-*]\s+', linea):
            texto_item = re.sub(r'^\s*[-*]\s+', '', linea)
            if not en_lista:
                html.append('<ul>')
                en_lista = True
            html.append(f'<li>{inline_md(texto_item)}</li>')
            continue
        elif en_lista and linea.strip() == '':
            html.append('</ul>')
            en_lista = False
        elif en_lista and not re.match(r'^\s*[-*]\s+', linea):
            html.append('</ul>')
            en_lista = False

        # Listas numeradas
        if re.match(r'^\s*\d+\.\s+', linea):
            texto_item = re.sub(r'^\s*\d+\.\s+', '', linea)
            if not en_ol:
                html.append('<ol>')
                en_ol = True
            html.append(f'<li>{inline_md(texto_item)}</li>')
            continue
        elif en_ol:
            html.append('</ol>')
            en_ol = False

        # Imagen sola en su propia línea
        m_img = re.match(r'^!\[(.*?)\]\((.+?)\)$', linea.strip())
        if m_img:
            html.append(f'<figure><img src="{m_img.group(2)}" alt="{m_img.group(1)}"></figure>')
            continue

        # Títulos
        m = re.match(r'^(#{1,4})\s+(.+)$', linea)
        if m:
            nivel = len(m.group(1))
            contenido = inline_md(m.group(2))
            html.append(f'<h{nivel}>{contenido}</h{nivel}>')
            continue

        # Línea vacía
        if linea.strip() == '':
            html.append('')
            continue

        # Párrafo normal
        html.append(f'<p>{inline_md(linea)}</p>')

    if en_lista:
        html.append('</ul>')
    if en_ol:
        html.append('</ol>')
    if en_tabla:
        html.append('</tbody></table>')

    return '\n'.join(html)


def inline_md(texto):
    """Convierte markdown inline a HTML."""
    # Negrita + cursiva
    texto = re.sub(r'\*\*\*(.+?)\*\*\*', r'<strong><em>\1</em></strong>', texto)
    # Negrita
    texto = re.sub(r'\*\*(.+?)\*\*', r'<strong>\1</strong>', texto)
    # Cursiva
    texto = re.sub(r'\*(.+?)\*', r'<em>\1</em>', texto)
    # Código inline
    texto = re.sub(r'`(.+?)`', r'<code>\1</code>', texto)
    # Imágenes (antes que los links, si no el link se come el ![])
    texto = re.sub(r'!\[(.*?)\]\((.+?)\)', r'<img src="\2" alt="\1">', texto)
    # Links
    texto = re.sub(r'\[(.+?)\]\((.+?)\)', r'<a href="\2">\1</a>', texto)
    return texto


MIME_IMAGEN = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
}


def incrustar_imagenes(html, carpeta_base):
    """Convierte rutas locales de imagen en data URI.

    Así el HTML exportado es un archivo autocontenido: se puede mover, enviar
    por correo o imprimir a PDF sin arrastrar la carpeta de imágenes.
    """
    def reemplazo(m):
        ruta = m.group(1)
        if ruta.startswith(('data:', 'http://', 'https://')):
            return m.group(0)
        ruta_abs = ruta if os.path.isabs(ruta) else os.path.join(carpeta_base, ruta)
        if not os.path.isfile(ruta_abs):
            print(f"  ⚠ Imagen no encontrada: {ruta}")
            return m.group(0)
        mime = MIME_IMAGEN.get(os.path.splitext(ruta_abs)[1].lower(), 'image/jpeg')
        with open(ruta_abs, 'rb') as f:
            datos = base64.b64encode(f.read()).decode('ascii')
        return f'src="data:{mime};base64,{datos}"'

    return re.sub(r'src="([^"]+)"', reemplazo, html)


def generar_html(titulo, tipo_key, contenido_md, fecha):
    tipo = TIPOS.get(tipo_key, TIPOS["general"])
    color = tipo["color"]
    acento = tipo["acento"]
    etiqueta = tipo["etiqueta"]
    cuerpo = md_a_html(contenido_md)

    return f"""<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{titulo} — SarkPEW1</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600&family=Playfair+Display:wght@400;600&display=swap');

  :root {{
    --negro: {color};
    --acento: {acento};
    --gris-claro: #f5f4f2;
    --gris-medio: #e8e6e2;
    --gris-texto: #555;
    --fuente-titulo: 'Playfair Display', Georgia, serif;
    --fuente-cuerpo: 'Inter', -apple-system, sans-serif;
  }}

  * {{ margin: 0; padding: 0; box-sizing: border-box; }}

  body {{
    font-family: var(--fuente-cuerpo);
    background: #fff;
    color: var(--negro);
    font-size: 10.5pt;
    line-height: 1.65;
  }}

  /* Header del documento */
  .doc-header {{
    background: var(--negro);
    color: #fff;
    padding: 28px 48px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }}
  .doc-header-left {{ display: flex; flex-direction: column; gap: 4px; }}
  .doc-marca {{
    font-family: var(--fuente-titulo);
    font-size: 22pt;
    letter-spacing: 0.08em;
    color: #fff;
  }}
  .doc-marca span {{ color: var(--acento); }}
  .doc-etiqueta {{
    font-size: 7pt;
    letter-spacing: 0.25em;
    text-transform: uppercase;
    color: var(--acento);
    font-weight: 500;
  }}
  .doc-header-right {{
    text-align: right;
    font-size: 8pt;
    color: #aaa;
    line-height: 1.8;
  }}

  /* Franja de título */
  .doc-titulo-wrapper {{
    background: var(--gris-claro);
    padding: 24px 48px;
    border-left: 4px solid var(--acento);
  }}
  .doc-titulo {{
    font-family: var(--fuente-titulo);
    font-size: 20pt;
    font-weight: 400;
    color: var(--negro);
    line-height: 1.2;
  }}

  /* Contenido */
  .doc-cuerpo {{
    padding: 40px 48px;
    max-width: 900px;
    margin: 0 auto;
  }}

  h1, h2, h3, h4 {{
    font-family: var(--fuente-titulo);
    font-weight: 400;
    margin-top: 2em;
    margin-bottom: 0.5em;
    line-height: 1.2;
    color: var(--negro);
  }}
  h1 {{ font-size: 18pt; border-bottom: 1.5px solid var(--acento); padding-bottom: 6px; }}
  h2 {{ font-size: 14pt; color: var(--acento); letter-spacing: 0.03em; }}
  h3 {{ font-size: 11pt; font-weight: 600; font-family: var(--fuente-cuerpo); text-transform: uppercase; letter-spacing: 0.1em; color: var(--gris-texto); }}
  h4 {{ font-size: 10pt; font-weight: 600; font-family: var(--fuente-cuerpo); }}

  p {{ margin-bottom: 0.85em; color: #333; }}

  ul, ol {{ padding-left: 1.4em; margin-bottom: 0.85em; }}
  li {{ margin-bottom: 0.3em; }}

  .checklist {{ list-style: none; padding-left: 0; }}
  .checklist li {{ display: flex; align-items: flex-start; gap: 8px; margin-bottom: 0.4em; }}
  .checklist input {{ margin-top: 3px; accent-color: var(--acento); }}

  strong {{ font-weight: 600; }}
  em {{ font-style: italic; color: var(--gris-texto); }}
  code {{ font-family: 'Courier New', monospace; background: var(--gris-claro); padding: 1px 5px; border-radius: 3px; font-size: 9pt; }}

  pre {{
    background: var(--negro);
    color: #e8e6e2;
    padding: 20px 24px;
    border-radius: 4px;
    margin: 1.2em 0;
    overflow-x: auto;
    font-size: 8.5pt;
    line-height: 1.7;
  }}
  pre code {{ background: none; color: inherit; padding: 0; }}

  hr {{
    border: none;
    border-top: 1px solid var(--gris-medio);
    margin: 2em 0;
  }}

  /* Imágenes */
  figure {{ margin: 1.6em 0; }}
  img {{
    display: block;
    max-width: 100%;
    height: auto;
    border-radius: 3px;
  }}
  figure img {{
    width: 100%;
    border: 1px solid var(--gris-medio);
  }}

  table {{
    width: 100%;
    border-collapse: collapse;
    margin: 1.2em 0;
    font-size: 9.5pt;
  }}
  th {{
    background: var(--negro);
    color: #fff;
    padding: 10px 14px;
    text-align: left;
    font-weight: 500;
    font-size: 8.5pt;
    letter-spacing: 0.05em;
  }}
  td {{
    padding: 9px 14px;
    border-bottom: 1px solid var(--gris-medio);
    vertical-align: top;
  }}
  tr:nth-child(even) td {{ background: var(--gris-claro); }}

  /* Footer */
  .doc-footer {{
    margin-top: 60px;
    padding-top: 20px;
    border-top: 1px solid var(--gris-medio);
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 8pt;
    color: #aaa;
  }}
  .doc-footer-marca {{
    font-family: var(--fuente-titulo);
    font-size: 10pt;
    color: var(--negro);
    letter-spacing: 0.06em;
  }}

  /* Botón de impresión (no aparece en PDF) */
  .btn-pdf {{
    position: fixed;
    bottom: 24px;
    right: 24px;
    background: var(--acento);
    color: #fff;
    border: none;
    padding: 12px 22px;
    font-family: var(--fuente-cuerpo);
    font-size: 10pt;
    font-weight: 500;
    border-radius: 4px;
    cursor: pointer;
    letter-spacing: 0.05em;
    box-shadow: 0 4px 16px rgba(0,0,0,0.2);
    transition: opacity 0.2s;
    z-index: 999;
  }}
  .btn-pdf:hover {{ opacity: 0.9; }}

  @media print {{
    .btn-pdf {{ display: none; }}
    .doc-header {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    .doc-titulo-wrapper {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    pre {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    th {{ -webkit-print-color-adjust: exact; print-color-adjust: exact; }}
    figure, img, table {{ break-inside: avoid; page-break-inside: avoid; }}
    h1, h2, h3 {{ break-after: avoid; page-break-after: avoid; }}
    body {{ font-size: 10pt; }}
    @page {{ margin: 0; }}
  }}
</style>
</head>
<body>

<header class="doc-header">
  <div class="doc-header-left">
    <div class="doc-marca">SARK<span>PEW1</span></div>
    <div class="doc-etiqueta">{etiqueta}</div>
  </div>
  <div class="doc-header-right">
    {fecha}<br>
    sarkpew1.com
  </div>
</header>

<div class="doc-titulo-wrapper">
  <div class="doc-titulo">{titulo}</div>
</div>

<div class="doc-cuerpo">
{cuerpo}

  <div class="doc-footer">
    <div class="doc-footer-marca">SarkPEW1</div>
    <div>Arte visual · Muralismo · Dirección creativa</div>
    <div>{fecha}</div>
  </div>
</div>

<button class="btn-pdf" onclick="window.print()">Guardar como PDF</button>

</body>
</html>"""


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(0)

    titulo = sys.argv[1] if len(sys.argv) > 1 else "Documento SarkPEW1"
    tipo = sys.argv[2] if len(sys.argv) > 2 else "general"
    archivo_md = sys.argv[3] if len(sys.argv) > 3 else None

    # Leer contenido
    if archivo_md and os.path.exists(archivo_md):
        with open(archivo_md, 'r', encoding='utf-8') as f:
            contenido = f.read()
    elif not sys.stdin.isatty():
        contenido = sys.stdin.read()
    else:
        print("Error: proporciona un archivo .md o pasa el contenido por stdin.")
        sys.exit(1)

    fecha = datetime.datetime.now().strftime("%d de %B de %Y").replace(
        "January", "enero").replace("February", "febrero").replace(
        "March", "marzo").replace("April", "abril").replace(
        "May", "mayo").replace("June", "junio").replace(
        "July", "julio").replace("August", "agosto").replace(
        "September", "septiembre").replace("October", "octubre").replace(
        "November", "noviembre").replace("December", "diciembre")

    # Generar nombre de archivo de salida
    nombre_limpio = re.sub(r'[^\w\s-]', '', titulo.lower())
    nombre_limpio = re.sub(r'[\s]+', '-', nombre_limpio.strip())
    fecha_archivo = datetime.datetime.now().strftime("%Y%m%d")
    # Las imágenes del markdown se resuelven relativas al .md
    carpeta_base = os.path.dirname(os.path.abspath(archivo_md)) if archivo_md else os.getcwd()

    carpeta_salida = "/Users/usuario/Desktop/iSark/Documentos"
    if not os.path.isdir(carpeta_salida):
        carpeta_salida = carpeta_base
    archivo_html = os.path.join(carpeta_salida, f"{fecha_archivo}_{nombre_limpio}.html")

    html = generar_html(titulo, tipo.lower(), contenido, fecha)
    html = incrustar_imagenes(html, carpeta_base)

    with open(archivo_html, 'w', encoding='utf-8') as f:
        f.write(html)

    print(f"✓ Documento generado: {archivo_html}")

    if sys.platform == 'darwin':
        print(f"  Abriendo en Safari — presiona el botón 'Guardar como PDF' o Cmd+P")
        subprocess.run(['open', '-a', 'Safari', archivo_html])
    else:
        print(f"  Ábrelo en el navegador y usa 'Guardar como PDF'")


if __name__ == '__main__':
    main()
