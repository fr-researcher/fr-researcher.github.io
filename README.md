# Francisco Rau — Personal Academic Website

Static HTML/CSS/JS site, ready to deploy on **GitHub Pages**.

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
