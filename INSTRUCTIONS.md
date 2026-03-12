Siempre leer antes de hacer cualquier cambio:

- Analizar primero cómo están hechos los desarrollos existentes antes de modificar o crear código nuevo.
- Revisar nomenclatura, estructura, imports, declaración de variables y organización general del archivo.
- Tomar como referencia obligatoria `Frontend/src/modules/admin/Clients.astro` y `Frontend/public/js/clients.js` como estándar de implementación.
- Todos los archivos Astro deben mantener una estructura similar a los archivos base ya definidos.

Reglas técnicas obligatorias:

- No inventar estructuras nuevas si ya existe una forma implementada en el proyecto.
- Seguir siempre los mismos patrones de imports y referencias usados en los demás archivos.
- Usar siempre inyección de dependencias; evitar instancias directas o lógica acoplada.
- NO hardcodear textos, labels ni mensajes.
- Siempre considerar soporte bilingüe español / inglés mediante i18n.
- Las traducciones deben cargarse usando la estructura existente (`loadTranslations`, `getServerLang`) y la carpeta `i18n` como fuente única de textos.
- Respetar exactamente la forma en que se declaran y cargan las traducciones en los archivos de referencia.

Consistencia del proyecto:

- Las llamadas a librerías, helpers, servicios y utilidades deben usarse siempre de la misma forma en todos los archivos.
- Evitar cambios estructurales si ya existe una implementación correcta dentro del proyecto.
- Antes de escribir código nuevo, revisar cómo está resuelto el mismo patrón en otros módulos.
