# ANIMA — Entrega Fase 1 (EL UMBRAL + menú 3 capas + Personalizar solo-Creador)

Estos archivos pertenecen al repo **`pew1sark/ANIMA`** (no a este repo). Se dejan aquí
como entregable porque la sesión solo tiene permiso de escritura sobre `agentes-pew1`.
Cuando se agregue `pew1sark/ANIMA` al scope, se hará push directo allí.

## Cómo aplicar
Copia cada archivo a la misma ruta dentro del repo ANIMA (sobrescribe):

| Archivo aquí | Destino en ANIMA |
|---|---|
| `anima/index.html` | `index.html` |
| `anima/planes.html` | `planes.html` *(nuevo)* |
| `anima/assets/js/anima.js` | `assets/js/anima.js` |
| `anima/assets/css/studio.css` | `assets/css/studio.css` |

## Qué cambió

### 1. Portada EL UMBRAL (`index.html`, reescrito)
- Portada cinematográfica con el nombre **EL UMBRAL** (no entra directo a la app).
- Héroe con portal animado + LUMBRE, gradiente "velo" que respira.
- Tres caminos: **Cruzar el umbral** (Studio), **Ver los Planes**, **Filosofía**.
- Teaser de los tres umbrales (Alma/Clan/Santuario) enlazado a `planes.html`.
- Camino del creador con la nomenclatura ES (ORIGEN, CHISPA, RAÍZ, PULSO, HUELLA, TÓTEM, AURA, ANIMA).

### 2. Página de Planes (`planes.html`, nuevo)
- Tres planes como invitación: **◆ Alma**, **❂ Clan** (destacado), **🜁 Santuario**.
- Tabla comparativa y CTA de invitación (Founding Era).

### 3. Menú del Studio en 3 capas (`assets/js/anima.js` + `assets/css/studio.css`)
- **Capa 1** secciones · **Capa 2** reinos desplegables · **Capa 3** módulos:
  - `◆ Mi Alma`
  - `✦ Esencia` → Trayectoria · Portafolio · Memorias · Biblioteca
  - `₵ Taller` → Proyectos · Clientes · Cotizador · Finanzas · Agenda
  - `Mundo` → Comunidad · Santuario
- Reinos colapsables (estado recordado en `localStorage`); se abre solo el que contiene la vista activa.
- Respeta la personalización existente (módulos ocultos no aparecen).

### 4. Personalizar solo para el Creador
- El Creador se reconoce por correo: **sarkgraff@gmail.com** (`CREATOR_EMAIL` en `anima.js`).
- `⚙ Personalizar` (bloque **Creador** del menú) y la pestaña **Ajustes** de Mi Alma
  solo aparecen si la sesión es del Creador. Para el resto quedan ocultas.

## Pendiente (próximas fases, requieren backend)
- Fase 3: Consola del Creador para asignar rol/nivel/clan a cada Alma + RLS (migración 0005).
- Fase 4: Omnipresencia "Ver como" Alma / Clan / Santuario.
