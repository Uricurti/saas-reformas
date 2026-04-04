# Design Guide — App Gestión de Reformas
> Referencia visual basada en el estilo del dashboard Sparlink.
> El archivo de imagen de referencia debe guardarse en esta carpeta como `reference.png`.

---

## Paleta de Colores

### Colores Principales
| Token | Hex | Uso |
|---|---|---|
| `primary` | `#4F63D2` | Botones CTA, iconos activos, links |
| `primary-light` | `#EEF1FD` | Fondos de iconos, badges suaves |
| `primary-dark` | `#3A4DB8` | Hover de botones primarios |

### Fondos
| Token | Hex | Uso |
|---|---|---|
| `bg-app` | `#F7F8FB` | Fondo general de la aplicación |
| `bg-card` | `#FFFFFF` | Tarjetas, paneles, sidebar |
| `bg-sidebar` | `#FFFFFF` | Barra lateral de navegación |

### Textos
| Token | Hex | Uso |
|---|---|---|
| `text-primary` | `#1C1C28` | Títulos, texto principal |
| `text-secondary` | `#6B7280` | Subtítulos, labels, meta-info |
| `text-muted` | `#9CA3AF` | Placeholders, texto desactivado |

### Estados
| Token | Hex | Uso |
|---|---|---|
| `success` | `#22C55E` | Confirmaciones, badges positivos |
| `danger` | `#EF4444` | Errores, alertas, eliminación |
| `warning` | `#F59E0B` | Avisos, urgente |
| `info` | `#3B82F6` | Información neutral |

### Bordes y Divisores
| Token | Hex | Uso |
|---|---|---|
| `border` | `#E5E7EB` | Bordes de tarjetas, inputs, tablas |
| `border-light` | `#F3F4F6` | Separadores muy sutiles |

---

## Tipografía

**Font family:** `Inter` (Google Fonts)
```css
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');
```

| Nivel | Clase Tailwind | Uso |
|---|---|---|
| Page Title | `text-2xl font-bold text-gray-900` | Títulos de página (Dashboard, Obras...) |
| Section Header | `text-lg font-semibold text-gray-900` | Títulos de tarjetas y secciones |
| Body | `text-sm text-gray-600` | Texto general del cuerpo |
| Label | `text-xs font-medium text-gray-500` | Etiquetas de formulario, meta |
| Caption | `text-xs text-gray-400` | Timestamps, info secundaria |

---

## Componentes Base

### Tarjetas (Cards)
```
bg-white rounded-xl border border-gray-100 shadow-sm p-6
```
- Fondo blanco
- Bordes redondeados grandes (`rounded-xl` = 12px)
- Sombra muy sutil (`shadow-sm`)
- Borde gris muy claro
- Padding generoso (24px)

### Botones

**Primario (CTA):**
```
bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-dark transition-colors
```

**Secundario (Outline):**
```
border border-gray-200 bg-white text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50
```

**Ghost/Texto:**
```
text-gray-600 px-3 py-1.5 rounded-md text-sm hover:bg-gray-100
```

**Destructivo:**
```
bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-100
```

### Inputs / Formularios
```
w-full px-3 py-2 border border-gray-200 rounded-lg text-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary
```

### Badges / Chips
```
inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
```
- Verde: `bg-green-100 text-green-700`
- Rojo: `bg-red-100 text-red-600`
- Amarillo: `bg-amber-100 text-amber-700`
- Azul: `bg-blue-100 text-blue-700`
- Gris: `bg-gray-100 text-gray-600`

### Contenedores de Iconos
```
w-10 h-10 rounded-xl bg-primary-light flex items-center justify-center
```
Con el icono en color primario: `text-primary`

### Navegación Lateral (Sidebar)
- Ancho: `w-64` (256px)
- Fondo: `bg-white`
- Borde derecho: `border-r border-gray-100`
- Item activo: `bg-primary-light text-primary font-medium rounded-lg`
- Item inactivo: `text-gray-600 hover:bg-gray-50 rounded-lg`
- Padding item: `px-3 py-2.5`

### Barra Superior (Header / Topbar)
```
h-16 border-b border-gray-100 bg-white px-6 flex items-center justify-between
```

---

## Espaciado y Layout

| Concepto | Valor |
|---|---|
| Sidebar width | `256px` (w-64) |
| Header height | `64px` (h-16) |
| Card padding | `24px` (p-6) |
| Section gap | `24px` (gap-6) |
| Border radius card | `12px` (rounded-xl) |
| Border radius button | `8px` (rounded-lg) |
| Border radius input | `8px` (rounded-lg) |
| Border radius badge | `full` (rounded-full) |

---

## Sombras
```
shadow-sm  → box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05)   → tarjetas
shadow-md  → box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) → modales, dropdowns
```

---

## Adaptaciones Mobile-First (app de reformas)

Como esta app es principalmente **móvil**, se adaptan los componentes:

- **Bottom navigation bar** en lugar de sidebar en móvil
- **Cards** con padding reducido en mobile: `p-4` (16px)
- **Botones** de tamaño mínimo `44px` de altura para tapping cómodo
- **Checkboxes y toggles** XXL en el Modo Compra (mínimo 48px)
- **Modal de fichaje** a pantalla completa en móvil, centrado en desktop
- En tablet/desktop: sidebar visible permanentemente

---

## Iconos
Librería: **Lucide React** (`lucide-react`)
- Tamaño estándar: `w-4 h-4` (16px) en texto, `w-5 h-5` (20px) standalone
- Stroke width: 1.5 (default de Lucide)

---

## Animaciones y Transiciones
```css
transition-colors duration-150   → cambios de color (hover)
transition-all duration-200      → expansiones, apariciones
transition-opacity duration-150  → fade in/out
```

---

*Referencia: Dashboard Sparlink (imagen guardada como `reference.png` en esta carpeta)*
