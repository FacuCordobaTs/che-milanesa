# Guía de Cliente Web con WebSocket en Tiempo Real

## Implementación Completada ✅

Se ha implementado la aplicación cliente completa con conexión WebSocket en tiempo real para pedidos colaborativos.

## Características Implementadas

### 1. **Stores de Estado** (Zustand)

#### Mesa Store (`src/store/mesaStore.ts`)
Gestiona el estado de la mesa y productos:
- Mesa actual
- Productos del restaurante
- Clientes conectados
- Pedido ID
- Información del cliente (ID y nombre)
- QR Token

#### Carrito Store (`src/store/carritoStore.ts`)
Gestiona el carrito de compras con persistencia:
- Items del carrito
- Agregar/actualizar/eliminar items
- Calcular total
- Filtrar items por cliente
- Persistencia en localStorage

### 2. **Hook WebSocket** (`src/hooks/useClienteWebSocket.ts`)

**Funcionalidad:**
- ✅ Conexión automática al WebSocket
- ✅ Reconexión automática cada 3 segundos
- ✅ Envío de mensaje "CLIENTE_CONECTADO" al unirse
- ✅ Recepción de todos los eventos del servidor
- ✅ Actualización en tiempo real del estado

**Eventos Manejados:**
```typescript
- ESTADO_INICIAL: Estado completo del pedido
- CLIENTE_UNIDO: Nuevo cliente se une
- CLIENTE_DESCONECTADO: Cliente se desconecta
- ITEM_AGREGADO: Item agregado al pedido
- ITEM_ELIMINADO: Item eliminado
- CANTIDAD_ACTUALIZADA: Cantidad actualizada
- PEDIDO_CONFIRMADO: Pedido confirmado
- ERROR: Error del servidor
```

**Eventos Enviados:**
```typescript
- CLIENTE_CONECTADO: Al conectarse
- AGREGAR_ITEM: Al agregar producto
- ACTUALIZAR_CANTIDAD: Al cambiar cantidad
- ELIMINAR_ITEM: Al eliminar item
- CONFIRMAR_PEDIDO: Al confirmar pedido
```

### 3. **Rutas Actualizadas** (`src/main.tsx`)

```
/ → Welcome (página de inicio)
/mesa/:qrToken → Nombre (punto de entrada con QR)
/menu → Menu (menú con productos reales)
/pago → Pago
/factura → Factura
```

### 4. **Página de Nombre** (`src/pages/Nombre.tsx`)

**Flujo:**
1. Usuario escanea QR → Redirigido a `/mesa/{qrToken}`
2. App carga datos de la mesa desde backend
3. Muestra productos disponibles
4. Usuario ingresa su nombre
5. Genera ID único de cliente
6. Guarda en store y navega a `/menu`

**Características:**
- ✅ Carga automática de mesa por QR token
- ✅ Validación de token
- ✅ Carga de productos del restaurante
- ✅ Estado de carga con spinner
- ✅ Manejo de errores
- ✅ Notificaciones con toast

### 5. **Página de Menú** (`src/pages/Menu.tsx`)

**Características Principales:**

#### Productos Reales:
- ✅ Carga productos desde backend
- ✅ Filtrado por categorías
- ✅ Imágenes de productos
- ✅ Precios reales
- ✅ Descripciones

#### Carrito Colaborativo:
- ✅ Ver todos los items del pedido
- ✅ Identificar items por cliente (badges)
- ✅ Solo editar tus propios items
- ✅ Ver items de otros clientes
- ✅ Total compartido en tiempo real

#### Clientes Conectados:
- ✅ Sheet lateral con lista de clientes
- ✅ Avatares con iniciales
- ✅ Badge "Tú" para identificarte
- ✅ Contador en el botón
- ✅ Actualización en tiempo real

#### Estado de Conexión:
- ✅ Badge con indicador Wifi/WifiOff
- ✅ "Conectado" / "Desconectado"
- ✅ Actualización automática

#### Interacciones:
- ✅ Agregar productos al carrito
- ✅ Aumentar/disminuir cantidad
- ✅ Eliminar items
- ✅ Confirmar pedido
- ✅ Ver detalle de producto

## Flujo Completo de Usuario

### 1. Escanear QR:
```
Cliente escanea QR
  ↓
Redirigido a /mesa/{qrToken}
  ↓
App carga mesa y productos
  ↓
Muestra pantalla de nombre
```

### 2. Ingresar Nombre:
```
Cliente ingresa "Juan"
  ↓
Se genera ID único: "cliente-1234567890-abc123"
  ↓
Se guarda en store
  ↓
Navega a /menu
```

### 3. Conectarse al WebSocket:
```
Hook detecta qrToken y clienteId
  ↓
Conecta a ws://localhost:3000/ws/{qrToken}
  ↓
Envía CLIENTE_CONECTADO con nombre
  ↓
Recibe ESTADO_INICIAL
  ↓
Actualiza lista de clientes
```

### 4. Ver Productos:
```
Productos cargados desde backend
  ↓
Mostrados en cards con imágenes
  ↓
Filtrados por categoría
  ↓
Click en producto → Detalle
```

### 5. Agregar al Carrito:
```
Cliente click "Agregar"
  ↓
Se agrega a carrito local
  ↓
Se envía AGREGAR_ITEM por WebSocket
  ↓
Backend actualiza pedido
  ↓
Broadcast a todos los clientes
  ↓
Todos ven el nuevo item
```

### 6. Ver Otros Clientes:
```
Cliente 2 escanea QR
  ↓
Ingresa nombre "María"
  ↓
Se conecta al WebSocket
  ↓
Cliente 1 recibe CLIENTE_UNIDO
  ↓
Lista de clientes se actualiza
  ↓
Ambos ven: Juan, María
```

### 7. Pedido Colaborativo:
```
Juan agrega Pizza
  ↓
María ve: "Pizza - Juan"
  ↓
María agrega Coca Cola
  ↓
Juan ve: "Coca Cola - María"
  ↓
Ambos ven total actualizado
  ↓
Solo pueden editar sus propios items
```

### 8. Confirmar Pedido:
```
Juan click "Confirmar Pedido"
  ↓
Se envía CONFIRMAR_PEDIDO
  ↓
Backend cambia estado a "preparing"
  ↓
Todos los clientes reciben actualización
  ↓
Toast: "¡Pedido confirmado!"
```

## Componentes Clave

### Header:
- Botón volver
- Toggle tema
- Botón clientes conectados (con contador)
- Botón carrito (con contador de mis items)

### Info de Mesa:
- Nombre de la mesa
- Estado de conexión WebSocket

### Banner de Bienvenida:
- Saludo personalizado con nombre del cliente

### Categorías:
- Filtros de categorías
- Generadas dinámicamente de productos

### Lista de Productos:
- Cards con imagen, nombre, descripción, precio
- Botón "Agregar"
- Click para ver detalle

### Sheet de Carrito:
- Lista de todos los items del pedido
- Badge con nombre del cliente
- Items propios: editable (cantidad, eliminar)
- Items de otros: solo lectura
- Total compartido
- Botón confirmar pedido

### Sheet de Clientes:
- Lista de clientes conectados
- Avatar con inicial
- Badge "Tú" para identificarte
- Actualización en tiempo real

### Botón Flotante:
- Solo visible si tienes items
- Muestra cantidad de tus items
- Abre el carrito

## Variables de Entorno

### `.env` en web:
```env
VITE_API_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000
```

### Producción:
```env
VITE_API_URL=https://api.piru.app/api
VITE_WS_URL=wss://api.piru.app
```

## API Endpoints Usados

### Unirse a Mesa:
```
GET /api/mesa/join/{qrToken}

Response: {
  success: true,
  data: {
    mesa: Mesa,
    pedido: Pedido,
    productos: Producto[]
  }
}
```

### WebSocket:
```
WS /ws/{qrToken}

Enviar:
- CLIENTE_CONECTADO
- AGREGAR_ITEM
- ACTUALIZAR_CANTIDAD
- ELIMINAR_ITEM
- CONFIRMAR_PEDIDO

Recibir:
- ESTADO_INICIAL
- CLIENTE_UNIDO
- CLIENTE_DESCONECTADO
- ITEM_AGREGADO
- ITEM_ELIMINADO
- CANTIDAD_ACTUALIZADA
- PEDIDO_CONFIRMADO
```

## Testing

### Probar Flujo Completo:

1. **Admin crea mesa:**
   - Admin → Mesas → Nueva Mesa → "Mesa 1"
   - Admin → Ver QR → Copiar link

2. **Cliente 1 escanea:**
   - Abrir link: `http://localhost:5173/mesa/{token}`
   - Ingresar nombre: "Juan"
   - Ver productos del restaurante
   - Agregar Pizza

3. **Cliente 2 escanea:**
   - Abrir link en otra pestaña/dispositivo
   - Ingresar nombre: "María"
   - Ver que Juan está conectado
   - Ver que Juan agregó Pizza
   - Agregar Coca Cola

4. **Ambos clientes ven:**
   - 2 clientes conectados
   - Pizza (Juan)
   - Coca Cola (María)
   - Total actualizado

5. **Admin ve:**
   - 2 clientes conectados
   - 2 items en pedido
   - Total actualizado
   - Todo en tiempo real

## Características de Diseño

### Responsive:
- Mobile-first
- Funciona perfecto en celular
- Sheets desde abajo para mejor UX móvil

### Visual:
- Cards modernas con imágenes
- Badges para identificar clientes
- Avatares con iniciales
- Indicadores de estado claros

### UX:
- Solo puedes editar tus items
- Ves items de otros en tiempo real
- Indicador de conexión visible
- Notificaciones para cada acción
- Botón flotante para carrito

## Solución de Problemas

### WebSocket no conecta:
- Verificar VITE_WS_URL en .env
- Verificar que backend está corriendo
- Revisar console del navegador

### No carga productos:
- Verificar que el QR token es válido
- Verificar que el restaurante tiene productos
- Revisar response del endpoint /mesa/join

### No se ven otros clientes:
- Verificar que ambos están en la misma mesa
- Verificar que WebSocket está conectado
- Revisar console para eventos CLIENTE_UNIDO

### Items no se sincronizan:
- Verificar conexión WebSocket
- Revisar que se envían mensajes correctamente
- Verificar que backend hace broadcast

## Mejoras Futuras

- [ ] Notificaciones push para nuevos items
- [ ] Sonido cuando alguien agrega item
- [ ] Chat entre clientes de la mesa
- [ ] Dividir cuenta por cliente
- [ ] Propinas
- [ ] Calificación de productos
- [ ] Historial de pedidos
- [ ] Recomendaciones personalizadas

## Notas Técnicas

### Persistencia:
- Carrito se guarda en localStorage
- Sobrevive a recargas de página
- Se limpia al confirmar pedido

### IDs Únicos:
- Cliente ID: `cliente-{timestamp}-{random}`
- Item ID: `{timestamp}+{random}`
- Únicos y no colisionan

### WebSocket:
- Reconexión automática
- Manejo de errores robusto
- Cleanup automático

### Performance:
- Carga lazy de imágenes
- Virtualización de listas largas
- Optimización de re-renders

