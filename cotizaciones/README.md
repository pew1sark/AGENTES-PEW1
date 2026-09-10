# COTIZACIONES

Cotizaciones escritas en markdown y exportadas con `exportar.py` (tipo `cotizacion`).

## Cómo generar el documento

```bash
cd cotizaciones
python3 ../exportar.py "Título del documento" cotizacion archivo.md
```

El script genera el HTML con el estilo de marca y lo abre en Safari. Desde ahí,
el botón **Guardar como PDF** (o Cmd+P) produce el archivo para enviar al cliente.

Las imágenes se escriben en markdown con `![alt](img/archivo.jpg)`, con ruta
relativa al `.md`. Al exportar quedan incrustadas dentro del HTML, así que el
archivo generado se puede mover o enviar por sí solo.

## Documentos

| Archivo | Proyecto | Fecha |
|---|---|---|
| `cotizacion-italo-coliumo.md` | Mural en memoria de Ítalo — Caleta Coliumo, Tomé | 10-09-2026 |

## Pendiente por completar

- Datos de contacto en el pie del documento (WhatsApp, Instagram, correo)
- Medidas reales del muro tras la visita técnica
