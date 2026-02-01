# Manual de Usuario (Admin) Gelymar Admin Portal

Documento en construcción. Este manual está orientado a usuarios Administrador y describe pantallas, pasos, resultados esperados y manejo de errores.

**Versión:** 1.0.0  
**Autor:** Pablo Santibañez  
**Fecha:** 30 de enero de 2026

## Contenido
- Login
- Buscar Órdenes
- Documentos de una Orden
- Archivos de la Orden
- Envío manual de documentos por correo
- Reglas de Documentos
  - 1) Aviso de Recepción de Orden (Order Receipt Notice)
  - 2) Aviso de Embarque (Shipment Notice)
  - 3) Aviso de Entrega (Order Delivery Notice)
  - 4) Aviso de Disponibilidad (Availability Notice)
- Subir Archivo
- Items Detallados de una Orden
- Lista de Items de una Orden
- Clientes
- Gestión de contactos (Additional contacts)
- Vendedores
- Settings
  - 1) PDF mail list
  - 2) Notification email list
  - 3) Admin users
  - 4) Cambiar contraseña
  - 5) Profile (Configuración de Administrador)
- Notificaciones
- Chat Clientes

---

# Login
**Pantalla:** Inicio de sesión (Admin Portal)

**Objetivo**  
Permitir el acceso seguro al portal administrativo para personal interno.

**Requisitos previos**  
- Usuario (RUT/username) y contraseña válidos.  
- Acceso a Internet.

**Campos**  
- **Username:** RUT/usuario asignado.  
- **Password:** Contraseña de acceso.

**Validación**  
- **reCAPTCHA** “No soy un robot”. Debe completarse antes de iniciar sesión.

**Pasos para ingresar**  
1. Ingrese su **Username**.  
2. Ingrese su **Password**.  
3. Marque **No soy un robot**.  
4. Presione **Sign in**.

**Resultado esperado**  
- El sistema redirige al panel principal y muestra el menú lateral con acceso a las secciones disponibles.

**Recuperación de contraseña**  
1. Haga clic en **Forgot password?**.  
2. Siga las instrucciones que aparecen en pantalla para recuperar el acceso.

**Errores comunes y solución**  
- **“Credenciales inválidas”**: verifique que el RUT/usuario y contraseña sean correctos.  
- **reCAPTCHA no completado**: marque la casilla antes de intentar ingresar.  
- **Cuenta bloqueada** (si aplica): contacte a soporte interno.

**Notas**  
- Acceso exclusivo para personal interno.  
- No comparta sus credenciales.

---

# Buscar Órdenes
**Pantalla:** Buscar Órdenes (menú Orders)

**Objetivo**  
Buscar, filtrar y revisar órdenes registradas. Exportar resultados para análisis externo.

**Requisitos previos**  
Usuario con permisos de Administrador.

**Controles principales**  
- **Search:** búsqueda rápida por texto en la lista de órdenes.  
- **Open Only:** muestra solo órdenes abiertas.  
- **Export to Excel:** descarga la lista filtrada en un archivo Excel.

**Columnas de la tabla**  
- **N° PC**  
- **Order**  
- **Customer Name**  
- **Entry Date**  
- **Shipping Method**  
- **Invoice**  
- **Invoice Date**  
- **ETD OV**  
- **ETA OV**  
- **ETD Invoice**  
- **ETA Invoice**  
- **Actions**

**Pasos para buscar una orden**  
1. En **Search**, escriba un dato clave (por ejemplo: N° PC, nombre del cliente o número de orden).  
2. Presione **Enter** o espere a que la lista se filtre automáticamente.  
3. Revise los resultados en la tabla.

**Pasos para filtrar órdenes abiertas**  
1. Active el interruptor **Open Only**.  
2. Revise la lista filtrada.  
3. Para volver a ver todas las órdenes, desactive el interruptor.

**Pasos para exportar a Excel**  
1. Aplique los filtros deseados (Search / Open Only).  
2. Haga clic en **Export to Excel**.  
3. Guarde el archivo en su equipo.

**Acciones por fila**  
- En la columna **Actions** se muestran íconos de acceso rápido.  
- Al pasar el cursor sobre cada ícono, se muestra su función.  
- Las acciones disponibles dependen de los permisos del usuario.

**Resultados esperados**  
- La tabla muestra únicamente los registros que cumplen los filtros.  
- La exportación incluye el mismo conjunto de datos visibles en pantalla.

**Errores comunes y solución**  
- **Sin resultados:** verifique filtros y texto de búsqueda.  
- **Exportación vacía:** asegúrese de que la tabla tenga registros visibles.  
- **Acción no disponible:** confirme permisos de su perfil.

**Notas**  
- Los encabezados permiten ordenar las columnas cuando está habilitado el ícono de ordenamiento.  
- La lista respeta los filtros activos hasta que se limpien.

---

# Documentos de una Orden
**Pantalla/Flujo:** Desde Buscar Órdenes → documentos de la orden

**Objetivo**  
Visualizar los documentos asociados a una orden específica.

**Pasos**  
1. En la lista de órdenes, ubique la orden deseada.  
2. Haga clic en el **N° PC** de la orden.  
3. Se abrirá la vista con los documentos asociados a esa orden.

**Resultado esperado**  
- El sistema muestra el listado de documentos disponibles para la orden seleccionada.

**Notas**  
- Si no ve documentos, verifique que la orden tenga archivos generados.

---

# Archivos de la Orden
**Pantalla:** Files (documentos de la orden)

**Objetivo**  
Gestionar los documentos de la orden (generar, enviar, reenviar, ver, editar y eliminar).

**Columnas principales**  
- **File Name**  
- **Status**  
- **Created At**  
- **Fecha Generación**  
- **Fecha Envío**  
- **Fecha Reenvío**  
- **Public** (visibilidad para el cliente)  
- **Actions**

**Acciones (columna Actions)**  
- **Generar documento** (solo cuando el estado es **Por Generar**).  
- **Enviar documento** (solo cuando el estado es **Generado**).  
- **Reenviar documento** (solo cuando el estado es **Enviado** o **Reenviado**).  
- **Ver documento** (disponible cuando está **Generado/Enviado/Reenviado**).  
- **Editar documento** (nombre/visibilidad, según permisos).  
- **Eliminar documento** (elimina el registro y el archivo asociado, según permisos).

**Reglas de disponibilidad de acciones**  
- **Por Generar (status 1):** solo aparece **Generar documento**.  
- **Generado (status 2):** aparece **Enviar** y **Ver**.  
- **Enviado (status 3) / Reenviado (status 4):** aparece **Reenviar** y **Ver**.  
- **Editar/Eliminar:** disponibles cuando el usuario tiene permisos de administración.

**Public (visibilidad)**  
- Al marcar la casilla, el documento queda visible para el cliente.  
- Desmarcarlo lo oculta del portal del cliente.


# Envío manual de documentos por correo
**Pantalla:** Modal “Enviar documentos” (desde Archivos)

**Objetivo**  
Enviar un documento manualmente por correo a uno o más destinatarios.

**Cómo acceder**  
1. En la tabla de **Archivos**, ubique el documento a enviar.  
2. Haga clic en el ícono de **correo** (Enviar documento) en la columna **Actions**.

**Imagen:** Modal de envío manual de documentos por correo.

**Campos y comportamiento**  
- **Número de orden / Nombre del documento:** se completan automáticamente con la orden y el nombre del documento.  
- **Destinatarios:** lista de destinatarios principales. Se pueden seleccionar desde los contactos del cliente o escribir correos manualmente.  
- **Correos CCO:** permite agregar copias ocultas (CCO).  
- **Confirmar:** envía el documento.  
- **Cancelar:** cierra el modal sin enviar.

**Relación con Gestión de contactos**  
Los contactos configurados en **Gestión de contactos (Additional contacts)** aparecen como sugerencias/selección rápida para **Destinatarios**. Mantener esta lista actualizada asegura que los envíos manuales lleguen a los responsables correctos.

**Pasos para enviar manualmente**  
1. Abra el modal con el ícono de correo.  
2. Verifique el nombre del documento y la orden.  
3. Seleccione destinatarios en **Destinatarios** o ingrese correos manualmente.  
4. (Opcional) agregue correos en **Correos CCO**.  
5. Presione **Confirmar** para enviar.

**Resultado esperado**  
- El correo se envía con el documento adjunto.  
- Se registra la **fecha de envío** del documento.

**Errores comunes y solución**  
- **Destinatario inválido:** verifique el formato del correo.  
- **No aparece contacto:** revise Gestión de contactos y asegure que el contacto tenga correo válido.

## Regenerar y reenviar (versiones de documentos)
**Pantalla:** Archivos (documentos de la orden)

**Objetivo**  
Explicar cómo se maneja la versión de un documento cuando se regenera o se reenvía, y cómo se ejecuta el flujo correcto desde el botón de reenviar.

**Cómo regenerar un documento (crea nueva versión)**  
1. En **Archivos**, ubique el documento que necesita actualizar.  
2. Haga clic en **Reenviar** (ícono de correo/acción).  
3. El sistema mostrará una **confirmación de regeneración**. Acepte la confirmación.  
4. Al confirmar, el sistema **regenera** el PDF (nueva versión).  
5. Inmediatamente después se abre nuevamente el **modal de envío** para seleccionar contactos y enviar la nueva versión.

**Resultado esperado al regenerar**  
- Se crea una **nueva versión** del documento (puede reflejarse en el nombre con sufijos como `_v1`, `_v2`).  
- Se abre el modal de envío para enviar la nueva versión a los contactos.

**Cómo reenviar un documento (misma versión)**  
1. En **Archivos**, ubique el documento ya generado.  
2. Haga clic en **Reenviar**.  
3. Si no necesita actualizar el contenido, **no regenere**; solo confirme el envío en el modal.  
4. El sistema enviará **la misma versión** del documento a los contactos seleccionados.

**Resultado esperado al reenviar**  
- Se envía el **mismo PDF** sin cambios.  
- Se actualiza la **fecha de reenvío**.

---

# Reglas de Documentos
**Objetivo**  
Definir cuándo se crea/genera cada documento y qué condiciones debe cumplir la orden.

## 1) Aviso de Recepción de Orden (Order Receipt Notice)
**Se genera cuando:**  
- La orden no tiene factura (factura vacía, nula o 0).  
- El documento no ha sido enviado previamente.

**Uso típico:**  
- Confirmarar recepción de una orden abierta sin factura.

## 2) Aviso de Embarque (Shipment Notice)
**Se genera cuando:**  
- La orden tiene factura.  
- **Incoterm** en: CFR, CIF, CIP, DAP, DDP.  
- **ETD** y **ETA** están informadas (tomadas de `fecha_etd_factura/fecha_etd` y `fecha_eta_factura/fecha_eta`).  
- El documento no ha sido enviado previamente.

**Uso típico:**  
- Informar el embarque cuando existen fechas de salida y arribo.

## 3) Aviso de Entrega (Order Delivery Notice)
**Se genera cuando:**  
- La orden tiene factura.  
- **ETA** está informada.  
- La fecha **ETA + 7 días = hoy** (se dispara 7 días después de ETA).  
- El documento no ha sido enviado previamente.

**Uso típico:**  
- Avisar la entrega estimada según ETA.

## 4) Aviso de Disponibilidad (Availability Notice)
**Se genera cuando:**  
- La orden tiene factura.  
- Existe al menos un ítem con `despacho_stgo = "SI"`.  
- **Incoterm** en: EWX, FCA, FOB, FCA Port, FCA Warehouse Santiago, FCA Airport, FCAWSTGO.  
- El documento no ha sido enviado previamente.

**Uso típico:**  
- Informar disponibilidad en Santiago según reglas logísticas.

**Notas generales**  
- Si un documento ya fue enviado (tiene **fecha_envío**), el cron lo omite.  
- Los nombres en el sistema se guardan como: **“Documento - Cliente - PO ”**.

---

# Subir Archivo
**Pantalla:** Modal “Upload new document” (desde Archivos)

**Objetivo**  
Subir un documento externo/manual y asociarlo a la orden.

**Campos**  
- **Name of Document:** seleccionar el nombre del documento.  
- **Type of Document:** tipo de archivo (ej: PDF).  
- **¿Visible al cliente?:** define si el cliente podrá ver el archivo en su portal.  
- **Select Document:** área para arrastrar o seleccionar el archivo.

**Pasos para subir un documento**  
1. En la pantalla de Archivos, haga clic en **Subir archivo**.  
2. Seleccione el **Name of Document**.  
3. Elija el **Type of Document**.  
4. Defina si será visible al cliente.  
5. Arrastre el archivo o haga clic para seleccionarlo.  
6. Presione **Upload**.

**Resultado esperado**  
- El documento se registra en la tabla de Archivos de la orden.  
- Si se marcó visible, queda disponible para el cliente.

**Errores comunes y solución**  
- **No se sube el archivo:** verifique formato/tamaño permitido.  
- **No aparece en la lista:** refresque la página o confirme que se completó el upload.

**Notas**  
- El botón **Cancelar** cierra el modal sin cambios.

---

# Items Detallados de una Orden
**Pantalla:** Modal “Items List” (desde Buscar Órdenes)

**Objetivo**  
Visualizar el detalle de los ítems de una orden y sus totales.

**Cómo acceder**  
1. En **Buscar Órdenes**, vaya a la columna **Actions**.  
2. Haga clic en el ícono **Ver items detallados** (lista).

**Contenido del modal**  
- Encabezado con número de orden y cliente.  
- Tabla de ítems con columnas:  
  - Code  
  - Item Name  
  - Requested KG  
  - Unit Price  
  - Total  
- Resumen inferior:  
  - Total Items  
  - Total Quantity  
  - Total Value  
  - Additional Expense

**Resultado esperado**  
- Se muestra el detalle de ítems y el resumen de totales para la orden seleccionada.

**Notas**  
- Si el modal no muestra datos, verifique que la orden tenga ítems asociados.  
- El botón **X** cierra la ventana.

---

# Lista de Items de una Orden
**Pantalla:** Modal “Ver lista de items” (desde Buscar Órdenes)

**Objetivo**  
Ver la lista simple de ítems asociados a la orden.

**Cómo acceder**  
1. En **Buscar Órdenes**, vaya a la columna **Actions**.  
2. Haga clic en el ícono **Ver lista de items** (lista con puntos).

**Contenido del modal**  
- Listado básico de ítems asociados a la orden.  
- Información resumida (según disponibilidad del sistema).

**Resultado esperado**  
- Se muestra la lista de ítems de la orden seleccionada.

**Notas**  
- Si no aparece información, verifique que la orden tenga ítems.  
- El botón **X** cierra la ventana.

---

# Clientes
**Pantalla:** All customers (Customers)

**Objetivo**  
Visualizar la base de clientes y acceder a sus órdenes y configuración.

**Controles principales**  
- **Search customer…** búsqueda rápida por nombre/RUT/email.  
- **Only customers with orders:** filtra clientes que tengan órdenes registradas.  
- **Export to Excel:** exporta el listado filtrado.

**Columnas**  
- **Name**  
- **RUT**  
- **Primary Email**  
- **Phone**  
- **Country**  
- **City**  
- **N° Orders**  
- **Actions**

**Acciones (columna Actions)**  
- **Ver órdenes** (ícono de documento): abre las órdenes del cliente.  
- **Gestionar contactos** (ícono de personas): abre la administración de contactos del cliente.  
- **Cambiar contraseña** (ícono de llave): permite resetear/actualizar la contraseña del cliente.

**Pasos típicos**  
- **Ver órdenes de un cliente:** en Actions, clic en **Ver órdenes**.  
- **Gestionar contactos:** en Actions, clic en **Gestionar contactos** y edite/agregue contactos.  
- **Cambiar contraseña:** en Actions, clic en **Cambiar contraseña** y confirme.

**Resultados esperados**  
- Se abre la vista correspondiente según la acción seleccionada.

**Errores comunes y solución**  
- **No aparecen clientes:** revise filtros o limpie la búsqueda.  
- **Acción no disponible:** confirme permisos del perfil admin.

---

# Gestión de contactos (Additional contacts)
Para administrar los contactos de un cliente, se utiliza el botón **Manage contacts** disponible en la columna **Actions** de la sección **Clients**.

**Imagen 1:** Acceso a Manage contacts desde Clients.

Al hacer clic, se abre un modal que muestra los contactos adicionales del cliente. En esta ventana se visualiza una tabla con las columnas **Name**, **Email**, **Phone**, los checkboxes **SH Docs**, **Reports**, **CCO**, y la columna **Actions**.

**Imagen 2:** Modal de contactos y botón Add new contact.

## Cómo agregar un contacto
1. En el modal de contactos, haga clic en **Add new contact**.  
2. Se habilita una fila en blanco para completar los campos **Name**, **Email** y **Phone**.  
3. Marque los checkboxes que correspondan (**SH Docs**, **Reports**, **CCO**) según el tipo de comunicación asociada al contacto.  
4. Presione **Save** para guardar el contacto.  
5. Para salir sin guardar, seleccione **Cancelar**.

**Imagen 3:** Fila de contacto en edición con botones Save / Cancelar.

## Cómo editar un contacto
1. En la columna **Actions** del contacto, haga clic en el ícono **Editar** (lápiz).  
2. La fila queda habilitada para modificar nombre, correo, teléfono y checkboxes.  
3. Presione el ícono **Check** para confirmar los cambios.  
4. Presione el ícono **X** para cancelar la edición.

**Imagen 4:** Edición de un contacto con botones confirmar / cancelar.

## Cómo eliminar un contacto
1. En la columna **Actions**, haga clic en el ícono **Eliminar** (basurero).  
2. El contacto se elimina inmediatamente de la lista del cliente.

**Resultado y uso de estos contactos**  
Los contactos registrados en esta sección se utilizan como destinatarios disponibles cuando se realiza el envío manual de documentos por correo. Es fundamental mantener esta información actualizada y con los checkboxes correctamente configurados para asegurar que cada contacto reciba solo la información correspondiente.

---

# Vendedores
**Pantalla:** Sales team (Vendedores)

**Objetivo**  
Visualizar la información de los vendedores en formato de tabla.

**Controles principales**  
- **Search seller…** búsqueda rápida por nombre o RUT.

**Columnas**  
- **Name**  
- **RUT**  
- **Phone**  
- **Country**  
- **City**  
- **Status** (Online/Offline)  
- **Created** (fecha de creación)

**Acciones**  
- Esta sección es solo informativa; no hay acciones por fila.

**Resultado esperado**  
- Se muestra la lista de vendedores con su estado y datos básicos.

---

# Settings
**Ubicación:** Botón **Settings** en el pie del menú lateral.

**Objetivo**  
Administrar configuraciones del administrador y listas de correos del sistema.

**Opciones disponibles en el menú**  
- **PDF mail list:** lista de correos que reciben PDFs.  
- **Notification email list:** lista de correos para notificaciones.  
- **Admin users:** administración de usuarios administradores.  
- **Cambiar contraseña:** actualizar la contraseña del administrador.  
- **Profile:** perfil del administrador (modal de configuración personal).

**Nota:** la visibilidad de algunas opciones depende de la configuración del sistema y del rol.

---

# 1) PDF mail list
**Función**  
Gestionar la lista de correos que reciben documentos PDF.

**Acciones**  
- **Agregar Email:** añade una fila para ingresar nombre y correo.  
- **Eliminar** (ícono de papelera) en filas existentes o nuevas.  
- **Guardar:** confirma y guarda los cambios.  
- **Cancelarar/Cerrar:** cierra el modal sin guardar.

**Resultado esperado**  
- La lista queda actualizada y se utiliza al enviar PDFs.

---

# 2) Notification email list
**Función**  
Gestionar correos que recibirán notificaciones del sistema.

**Acciones**  
- **Agregar Email**, **Eliminar**, **Guardar**, **Cancelarar/Cerrar** (misma lógica que PDF mail list).

**Resultado esperado**  
- La lista queda actualizada y se utiliza para notificaciones.

---

# 3) Admin users
**Función**  
Crear, editar y administrar usuarios administradores.

**Campos típicos**  
- RUT  
- Email  
- Nombre completo  
- Teléfono  
- Agent Chat (habilita chat)

**Acciones**  
- **Agregar admin:** crea un nuevo usuario administrador.  
- **Guardar:** confirma los cambios.  
- **Cancelarar/Cerrar:** descarta cambios.  
- **Editar/Confirmarar/Cancelarar** por fila (lápiz, check, X).  
- **Reset de contraseña** (ícono dedicado) genera clave temporal.  
- **Eliminar** un admin (cuando esté disponible en la fila).

**Resultado esperado**  
- Usuarios admin actualizados en el sistema.

---

# 4) Cambiar contraseña
**Función**  
Actualizar la contraseña del administrador actual.

**Campos**  
- Contraseña actual  
- Nueva contraseña  
- Repite la nueva contraseña

**Reglas**  
- Las contraseñas deben coincidir.  
- Mínimo 6 caracteres.

**Resultado esperado**  
- Contraseña actualizada y confirmación en pantalla.

---

# 5) Profile (Configuración de Administrador)
**Función**  
Actualizar datos del administrador.

**Campos**  
- Cambiar foto  
- Nombre completo (obligatorio)  
- Email corporativo (solo lectura)  
- Teléfono de contacto (obligatorio)

**Acciones**  
- Guardar cambios  
- Cancelarar

**Resultado esperado**  
- Datos personales actualizados.

---

# Notificaciones
**Ubicación:** ícono de campana en la barra superior.

**Objetivo**  
Mostrar alertas del sistema (documentos faltantes, clientes sin cuenta, mensajes recientes, etc.).

**Contenido del panel**  
- Lista de notificaciones con título, detalles y fecha/hora.  
- Indicador numérico con cantidad de notificaciones no leídas.

**Acciones**  
- **Mark all as read:** marca todas las notificaciones como leídas.  
- **Click en una notificación:** abre el contexto relacionado (orden o cliente).  
- **View all notifications:** abre la vista completa de notificaciones.

**Tipos de notificación (ejemplos)**  
- **Orders missing documents:** órdenes con documentación mínima faltante.  
- **Customers without account:** clientes sin cuenta registrada.  
- **Mensajes recientes:** actividad de chat/últimos mensajes.

**Resultado esperado**  
- El panel refleja el estado actual de alertas y permite navegar a la entidad relacionada.

---

# Chat de Clientes
**Ubicación:** ícono de chat en la barra superior.

**Objetivo**  
Iniciar conversación con clientes desde el panel de administración.

**Contenido del panel**  
- Lista de clientes con indicador de estado (online/offline).  
- Buscador para filtrar clientes.

**Acciones**  
- **Chatear:** abre la conversación con el cliente seleccionado.  
- **Ver todos los clientes:** abre la vista completa de clientes (según permisos).

**Resultado esperado**  
- Se abre la ventana de chat con el cliente elegido.

**Notas**  
- El indicador de color refleja el estado del cliente (online/offline).
