# Francisco Rau — Personal Academic Website

Static HTML/CSS/JS site, ready to deploy on **GitHub Pages**.

## Access point simulation

The reviewed EDCA browser emulation is available at <https://fr-researcher.github.io/edca-lab/>. The desktop and mobile navigation links open it in a new tab.

`edca-lab/` is a self-contained static site. It includes the simulation, draft reference results, method notes and logos. It uses relative asset paths and requires no build step or backend. Live values are illustrative; it does not run ns-3 or a trained classifier. The complete source PDF is not included in this repository. Original Figures 12 (p. 14) and 16 (p. 17) from the supplied draft are reproduced in `edca-lab/assets/paper-video/` without resampling or curve reconstruction. The Reference results view pairs those figures with a throughput comparison using the printed means in Figures 11 and 15. The Simulation view shows live resolution/stall, IP throughput and buffer-duration plots from the same snapshots and histories as the animated player. These illustrative curves use simulation time, pause/reset with the session, and follow station and mode changes. The live buffer is shown in seconds; it is not converted to Mbit without per-segment encoding history. In the original paper figures, resolution uses the median across five seeds; temporal throughput and buffer curves use the mean and min–max range. These study results remain separate from the illustrative animation.

The MaxLinear header uses the original [SVG from the official website](https://www.maxlinear.com/Content/Images/maxlinear_logo_r.svg), downloaded without modifying its artwork.

The live video model preserves initial playback before the BE interruptions in Figure 16. After refill, prioritized video rates converge toward the steady IP rates described on page 8 (18.53 and 9.27 Mbit/s). Reported scenario means include transients and remain separate reference values. The live rate is not the paper's centered five-second average across five seeds. Buffer and stalls are scripted trends, not a simulation of DASH segment downloads and consumption. Neighbor packet animations follow the traffic directions in Figure 4.

Run the video fidelity regression checks with `node edca-lab/tests/model-fidelity.mjs`.

## Deploy en GitHub Pages (paso a paso)

### 1. Crear el repositorio en GitHub
1. Ve a [github.com/new](https://github.com/new)
2. Nombre del repo: **`tu-usuario.github.io`** (reemplaza con tu usuario de GitHub)
   - Ej: `franciscorau.github.io`
3. Marca como **Public**
4. Click en **Create repository**

### 2. Subir los archivos
```bash
cd C:/Users/FrZ!/Rep
git init
git add .
git commit -m "Initial site"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/TU_USUARIO.github.io.git
git push -u origin main
```

### 3. Activar GitHub Pages
1. Ve a **Settings** → **Pages** en tu repositorio
2. Source: **Deploy from a branch**
3. Branch: **main** / **(root)**
4. Click **Save**

Tu sitio estará en: `https://TU_USUARIO.github.io` en ~2 minutos.

---

## Personalizar el contenido

| Qué cambiar | Dónde |
|---|---|
| Nombre, bio, área | `index.html` sección `#about` |
| Email y redes sociales | `index.html` — busca `francisco.rau@email.com` y los `href="#"` |
| Publicaciones | `index.html` sección `#publications` — copia el bloque `<article class="pub-card">` |
| Proyectos | `index.html` sección `#projects` |
| CV (educación, experiencia) | `index.html` sección `#cv` |
| CV en PDF | Reemplaza `assets/cv_francisco_rau.pdf` con tu archivo |
| Colores / fuentes | `assets/css/style.css` — variables en `:root` |

## Agregar dominio personalizado (opcional)
1. Compra un dominio (ej. `franciscorau.com`)
2. En GitHub Pages settings → **Custom domain** → ingresa el dominio
3. Agrega un registro CNAME en tu DNS apuntando a `TU_USUARIO.github.io`
