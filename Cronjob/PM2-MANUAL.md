# Manual de PM2 para Cron Jobs

## Comandos Básicos de PM2

### Ver procesos activos
```bash
docker exec gelymar-platform-cron-prod pm2 list
```

### Ver logs de un proceso específico
```bash
# checkDefaultFiles
docker exec gelymar-platform-cron-prod pm2 logs gelymar-check-default-files --lines 20

# generatePDFs
docker exec gelymar-platform-cron-prod pm2 logs gelymar-generate-pdfs --lines 20

# sendOrderReception
docker exec gelymar-platform-cron-prod pm2 logs gelymar-order-reception --lines 20

# sendShipmentNotice
docker exec gelymar-platform-cron-prod pm2 logs gelymar-shipment-notice --lines 20

# sendOrderDeliveryNotice
docker exec gelymar-platform-cron-prod pm2 logs gelymar-order-delivery-notice --lines 20

# sendAvailableNotice
docker exec gelymar-platform-cron-prod pm2 logs gelymar-availability-notice --lines 20

# checkClientAccess
docker exec gelymar-platform-cron-prod pm2 logs gelymar-check-client-access --lines 20

# sendAdminNotifications
docker exec gelymar-platform-cron-prod pm2 logs gelymar-admin-notifications --lines 20

# sendDbBackup
docker exec gelymar-platform-cron-prod pm2 logs gelymar-db-backup --lines 20

# Ver más líneas (50)
docker exec gelymar-platform-cron-prod pm2 logs gelymar-shipment-notice --lines 50

# Ver logs en tiempo real
docker exec gelymar-platform-cron-prod pm2 logs gelymar-shipment-notice
```

### Ver logs de todos los procesos
```bash
docker exec gelymar-platform-cron-prod pm2 logs --lines 30
```

### Reiniciar un proceso específico
```bash
docker exec gelymar-platform-cron-prod pm2 restart gelymar-check-default-files
docker exec gelymar-platform-cron-prod pm2 restart gelymar-generate-pdfs
docker exec gelymar-platform-cron-prod pm2 restart gelymar-order-reception
docker exec gelymar-platform-cron-prod pm2 restart gelymar-shipment-notice
docker exec gelymar-platform-cron-prod pm2 restart gelymar-order-delivery-notice
docker exec gelymar-platform-cron-prod pm2 restart gelymar-availability-notice
```

### Reiniciar todos los procesos
```bash
docker exec gelymar-platform-cron-prod pm2 restart all
```

### Detener un proceso
```bash
docker exec gelymar-platform-cron-prod pm2 stop gelymar-check-default-files
```

### Iniciar un proceso detenido
```bash
docker exec gelymar-platform-cron-prod pm2 start gelymar-check-default-files
```

---

## Cambiar Horarios de Ejecución

Los horarios de los cron jobs se configuran en la tabla `param_config` de MySQL.

### 1. Actualizar el horario en la base de datos

**Formato**: `HH:MM` (24 horas)

```sql
-- Cambiar horario de checkDefaultFiles a las 22:00
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '22:00') 
WHERE name = 'checkDefaultFiles';

-- Cambiar horario de generatePDFs a las 23:00
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '23:00') 
WHERE name = 'generatePDFs';

-- Cambiar horario de sendOrderReception a las 23:30
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '23:30') 
WHERE name = 'sendAutomaticOrderReception';

-- Cambiar horario de sendShipmentNotice a las 23:35
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '23:35') 
WHERE name = 'sendAutomaticOrderShipment';

-- Cambiar horario de sendOrderDeliveryNotice a las 23:40
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '23:40') 
WHERE name = 'sendAutomaticOrderDelivery';

-- Cambiar horario de sendAvailableNotice a las 23:45
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '23:45') 
WHERE name = 'sendAutomaticOrderAvailability';
```

### 2. Reiniciar los contenedores

**IMPORTANTE**: Debes reiniciar AMBOS contenedores (backend y cron) para que los cambios surtan efecto.

```bash
# Reiniciar backend primero (lee la configuración de la BD)
docker restart gelymar-platform-backend-prod

# Esperar 5 segundos para que el backend inicie
sleep 5

# Reiniciar el contenedor de cron
docker restart gelymar-platform-cron-prod
```

O reiniciar ambos a la vez:
```bash
docker restart gelymar-platform-backend-prod gelymar-platform-cron-prod
```

### 3. Verificar que el cambio se aplicó

```bash
# Ver logs del cron específico
docker exec gelymar-platform-cron-prod pm2 logs gelymar-check-default-files --lines 5
```

Deberías ver algo como:
```
[checkDefaultFiles] Cron job iniciado - horario programado: 22:00 (0 22 * * *)
```

---

## Habilitar/Deshabilitar Cron Jobs

### Habilitar un cron job

```sql
UPDATE param_config 
SET params = JSON_SET(params, '$.enable', 1) 
WHERE name = 'checkDefaultFiles';
```

### Deshabilitar un cron job

```sql
UPDATE param_config 
SET params = JSON_SET(params, '$.enable', 0) 
WHERE name = 'checkDefaultFiles';
```

**Después de cambiar el estado, reiniciar los contenedores:**
```bash
docker restart gelymar-platform-backend-prod gelymar-platform-cron-prod
```

---

## Ejecutar un Cron Manualmente (Sin Esperar el Horario)

### Desde el contenedor de cron

```bash
# Ejecutar checkDefaultFiles inmediatamente
docker exec gelymar-platform-cron-prod node /app/cron/checkDefaultFiles.js execute-now

# Ejecutar generatePDFs inmediatamente
docker exec gelymar-platform-cron-prod node /app/cron/generatePDFs.js execute-now

# Ejecutar sendOrderReception inmediatamente
docker exec gelymar-platform-cron-prod node /app/cron/sendOrderReception.js execute-now
```

### Desde Postman o curl

```bash
# checkDefaultFiles
curl -X POST http://172.20.10.151:3000/api/cron/create-default-records

# generatePDFs
curl -X POST http://172.20.10.151:3000/api/cron/generate-pending-pdfs

# sendOrderReception
curl -X POST http://172.20.10.151:3000/api/cron/process-new-orders

# sendShipmentNotice
curl -X POST http://172.20.10.151:3000/api/cron/process-shipment-notices

# sendOrderDeliveryNotice
curl -X POST http://172.20.10.151:3000/api/cron/process-order-delivery-notices

# sendAvailableNotice
curl -X POST http://172.20.10.151:3000/api/cron/process-availability-notices
```

---

## Nombres de Procesos PM2

| Cron Job | Nombre PM2 | Parámetro Config |
|----------|-----------|------------------|
| checkDefaultFiles | `gelymar-check-default-files` | `checkDefaultFiles` |
| generatePDFs | `gelymar-generate-pdfs` | `generatePDFs` |
| sendOrderReception | `gelymar-order-reception` | `sendAutomaticOrderReception` |
| sendShipmentNotice | `gelymar-shipment-notice` | `sendAutomaticOrderShipment` |
| sendOrderDeliveryNotice | `gelymar-order-delivery-notice` | `sendAutomaticOrderDelivery` |
| sendAvailableNotice | `gelymar-availability-notice` | `sendAutomaticOrderAvailability` |
| checkClientAccess | `gelymar-check-client-access` | `checkClientAccess` |
| sendAdminNotifications | `gelymar-admin-notifications` | N/A |
| sendDbBackup | `gelymar-db-backup` | N/A |

---

## Troubleshooting

### El cron no se ejecuta en el horario programado

1. Verificar que el cron esté habilitado en la BD:
```sql
SELECT name, JSON_EXTRACT(params, '$.enable') as enabled, JSON_EXTRACT(params, '$.schedule') as schedule
FROM param_config 
WHERE name IN ('checkDefaultFiles', 'generatePDFs', 'sendAutomaticOrderReception');
```

2. Verificar que el proceso PM2 esté corriendo:
```bash
docker exec gelymar-platform-cron-prod pm2 list
```

3. Ver los logs para detectar errores:
```bash
docker exec gelymar-platform-cron-prod pm2 logs gelymar-check-default-files --lines 50
```

4. Reiniciar los contenedores:
```bash
docker restart gelymar-platform-backend-prod gelymar-platform-cron-prod
```

### El cron dice "Tarea deshabilitada en configuración"

El campo `enable` está en `0`. Cámbialo a `1`:
```sql
UPDATE param_config 
SET params = JSON_SET(params, '$.enable', 1) 
WHERE name = 'checkDefaultFiles';
```

Luego reinicia los contenedores.

### El horario no se actualiza después de cambiar la BD

1. Asegúrate de reiniciar AMBOS contenedores (backend y cron)
2. Verifica que el cambio se guardó en la BD
3. Espera unos segundos entre el reinicio del backend y el cron

### Ver la hora actual del servidor

```bash
docker exec gelymar-platform-cron-prod date
```

---

## Ejemplos Completos

### Cambiar el horario de checkDefaultFiles de 22:50 a 23:00

```sql
-- 1. Actualizar en la BD
UPDATE param_config 
SET params = JSON_SET(params, '$.schedule', '23:00') 
WHERE name = 'checkDefaultFiles';
```

```bash
# 2. Reiniciar contenedores
docker restart gelymar-platform-backend-prod gelymar-platform-cron-prod

# 3. Verificar el cambio (esperar 10 segundos)
sleep 10
docker exec gelymar-platform-cron-prod pm2 logs gelymar-check-default-files --lines 5
```

Deberías ver:
```
[checkDefaultFiles] Cron job iniciado - horario programado: 23:00 (0 23 * * *)
```

### Habilitar sendShipmentNotice y cambiar su horario

```sql
-- 1. Habilitar y cambiar horario
UPDATE param_config 
SET params = JSON_SET(JSON_SET(params, '$.enable', 1), '$.schedule', '23:25') 
WHERE name = 'sendAutomaticOrderShipment';
```

```bash
# 2. Reiniciar contenedores
docker restart gelymar-platform-backend-prod gelymar-platform-cron-prod

# 3. Verificar
sleep 10
docker exec gelymar-platform-cron-prod pm2 logs gelymar-shipment-notice --lines 5
```
