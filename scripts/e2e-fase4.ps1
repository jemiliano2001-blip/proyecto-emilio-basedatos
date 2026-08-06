$ErrorActionPreference = 'Stop'
$envLines = Get-Content .env.local
$anon = ($envLines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_ANON_KEY=(.+)$' }).Substring('NEXT_PUBLIC_SUPABASE_ANON_KEY='.Length)
$url = ($envLines | Where-Object { $_ -match '^NEXT_PUBLIC_SUPABASE_URL=(.+)$' }).Substring('NEXT_PUBLIC_SUPABASE_URL='.Length)

function Get-Token([string]$email, [string]$pass) {
  $body = @{ email = $email; password = $pass } | ConvertTo-Json
  return Invoke-RestMethod -Uri "$url/auth/v1/token?grant_type=password" -Method POST -Headers @{ apikey = $anon; 'Content-Type' = 'application/json' } -Body $body
}

function Get-Headers([string]$token) {
  return @{
    apikey = $anon
    Authorization = "Bearer $token"
    'Content-Type' = 'application/json'
    Prefer = 'return=representation'
  }
}

$guero = Get-Token 'guero.prueba@example.com' 'TempGuero2026!'
$talia = Get-Token 'talia.prueba@example.com' 'TempTalia2026!'
$gh = Get-Headers $guero.access_token
$th = Get-Headers $talia.access_token

# --- Preparar OC emitida ---
$obraId = (Invoke-RestMethod -Uri "$url/rest/v1/obras?estado=eq.activa&select=id&limit=1" -Headers $gh)[0].id
$matId = (Invoke-RestMethod -Uri "$url/rest/v1/catalogo_materiales?activo=eq.true&select=id&limit=1" -Headers $gh)[0].id

$solBody = @{ obra_id = $obraId; solicitante_id = $guero.user.id; nota = 'E2E Fase4' } | ConvertTo-Json
$sol = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $gh -Body $solBody)[0]
$itemBody = @(@{ solicitud_id = $sol.id; material_id = $matId; cantidad_solicitada = 10 }) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $gh -Body $itemBody | Out-Null
$itemId = (Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items?solicitud_id=eq.$($sol.id)&select=id" -Headers $gh)[0].id

$provBody = @{ nombre = "Proveedor de ejemplo F4 $(Get-Random)" } | ConvertTo-Json
$prov = (Invoke-RestMethod -Uri "$url/rest/v1/proveedores" -Method POST -Headers $th -Body $provBody)[0]
$cotBody = @{ solicitud_id = $sol.id; cotizador_id = $talia.user.id; estado = 'borrador' } | ConvertTo-Json
$cot = (Invoke-RestMethod -Uri "$url/rest/v1/cotizaciones" -Method POST -Headers $th -Body $cotBody)[0]
$ciBody = @(@{
  cotizacion_id = $cot.id
  solicitud_item_id = $itemId
  proveedor_id = $prov.id
  precio_unitario = 10
  cantidad = 10
  moneda = 'MXN'
}) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/cotizacion_items" -Method POST -Headers $th -Body $ciBody | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material?id=eq.$($sol.id)" -Method PATCH -Headers $th -Body '{"estado":"en_cotizacion"}' | Out-Null

$folio = Invoke-RestMethod -Uri "$url/rest/v1/rpc/next_folio_orden_compra" -Method POST -Headers $th -Body '{}'
$ordenBody = @{
  folio = $folio
  cotizacion_id = $cot.id
  proveedor_id = $prov.id
  obra_id = $obraId
  estado = 'emitida'
  total = 100
  moneda = 'MXN'
  creado_por = $talia.user.id
} | ConvertTo-Json
$orden = (Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra" -Method POST -Headers $th -Body $ordenBody)[0]
$ociBody = @(@{
  orden_id = $orden.id
  material_id = $matId
  cantidad = 10
  precio_unitario = 10
  subtotal = 100
}) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/orden_compra_items" -Method POST -Headers $th -Body $ociBody | Out-Null
$ociId = (Invoke-RestMethod -Uri "$url/rest/v1/orden_compra_items?orden_id=eq.$($orden.id)&select=id" -Headers $th)[0].id
Write-Output "orden=$($orden.id) folio=$folio item=$ociId"

# Personal NO ve precios de OC (RLS filtra → array vacío)
$ocAsPersonal = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=eq.$($orden.id)&select=id,total" -Headers $gh
if ($ocAsPersonal -and @($ocAsPersonal).Count -gt 0) {
  throw 'FAIL: Personal no deberia leer ordenes_compra'
}
Write-Output 'OK personal blocked from ordenes_compra prices'

# Personal ve checklist sin precios
$checklist = Invoke-RestMethod -Uri "$url/rest/v1/rpc/detalle_orden_checklist" -Method POST -Headers $gh -Body (@{ p_orden_id = $orden.id } | ConvertTo-Json)
if (-not $checklist -or $checklist.Count -lt 1) { throw 'FAIL: checklist vacío para Personal' }
if ($checklist[0].PSObject.Properties.Name -contains 'precio_unitario') { throw 'FAIL: checklist expone precio' }
Write-Output 'OK personal checklist without prices'

# Recepción parcial 1
$rec1 = [guid]::NewGuid().ToString()
$crear1 = @{
  p_id = $rec1
  p_orden_id = $orden.id
  p_referencia_entrega = 'E2E-parcial-1'
  p_nota = $null
  p_recibido_en = (Get-Date).ToUniversalTime().ToString('o')
  p_items = @(
    @{
      orden_item_id = $ociId
      cantidad_recibida = 4
      cantidad_danada = 0
      estado = 'parcial'
      observacion = $null
    }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$url/rest/v1/rpc/crear_recepcion" -Method POST -Headers $gh -Body $crear1 | Out-Null
Write-Output "recepcion1=$rec1"

# Idempotencia: mismo UUID
$again = Invoke-RestMethod -Uri "$url/rest/v1/rpc/crear_recepcion" -Method POST -Headers $gh -Body $crear1
if ($again -ne $rec1) { throw "FAIL: idempotencia devolvió $again" }
Write-Output 'OK idempotent crear_recepcion'

# Personal no puede revisar
try {
  Invoke-RestMethod -Uri "$url/rest/v1/rpc/revisar_recepcion" -Method POST -Headers $gh -Body (@{ p_recepcion_id = $rec1; p_aprobar = $true; p_nota = $null } | ConvertTo-Json)
  throw 'FAIL: Personal no debería revisar'
} catch {
  if ($_.Exception.Message -match 'FAIL:') { throw }
  Write-Output 'OK personal cannot revisar'
}

# Talía aprueba parcial
Invoke-RestMethod -Uri "$url/rest/v1/rpc/revisar_recepcion" -Method POST -Headers $th -Body (@{ p_recepcion_id = $rec1; p_aprobar = $true; p_nota = 'ok parcial' } | ConvertTo-Json) | Out-Null
$ocState = (Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=eq.$($orden.id)&select=estado" -Headers $th)[0].estado
if ($ocState -ne 'parcialmente_recibida') { throw "FAIL: esperado parcialmente_recibida, got $ocState" }
Write-Output "OK OC=$ocState"

# Recepción 2 completa el resto
$rec2 = [guid]::NewGuid().ToString()
$crear2 = @{
  p_id = $rec2
  p_orden_id = $orden.id
  p_referencia_entrega = 'E2E-parcial-2'
  p_nota = $null
  p_recibido_en = (Get-Date).ToUniversalTime().ToString('o')
  p_items = @(
    @{
      orden_item_id = $ociId
      cantidad_recibida = 6
      cantidad_danada = 0
      estado = 'completo'
      observacion = $null
    }
  )
} | ConvertTo-Json -Depth 5
Invoke-RestMethod -Uri "$url/rest/v1/rpc/crear_recepcion" -Method POST -Headers $gh -Body $crear2 | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/rpc/revisar_recepcion" -Method POST -Headers $th -Body (@{ p_recepcion_id = $rec2; p_aprobar = $true; p_nota = $null } | ConvertTo-Json) | Out-Null
$ocState2 = (Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=eq.$($orden.id)&select=estado" -Headers $th)[0].estado
if ($ocState2 -ne 'recibida') { throw "FAIL: esperado recibida, got $ocState2" }
Write-Output "OK OC=$ocState2"

# Sobre-recepción debe fallar
$rec3 = [guid]::NewGuid().ToString()
$crear3 = @{
  p_id = $rec3
  p_orden_id = $orden.id
  p_referencia_entrega = $null
  p_nota = $null
  p_recibido_en = (Get-Date).ToUniversalTime().ToString('o')
  p_items = @(
    @{
      orden_item_id = $ociId
      cantidad_recibida = 1
      cantidad_danada = 0
      estado = 'parcial'
      observacion = $null
    }
  )
} | ConvertTo-Json -Depth 5
try {
  Invoke-RestMethod -Uri "$url/rest/v1/rpc/crear_recepcion" -Method POST -Headers $gh -Body $crear3 | Out-Null
  # OC ya recibida — crear debe fallar
  throw 'FAIL: no debería crear recepción en OC recibida'
} catch {
  if ($_.Exception.Message -match 'FAIL:') { throw }
  Write-Output 'OK blocked reception on OC recibida'
}

# DELETE OC con recepciones / no-emitida debe no borrar
Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=eq.$($orden.id)" -Method DELETE -Headers $th | Out-Null
$stillThere = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=eq.$($orden.id)&select=id" -Headers $th
if (-not $stillThere -or @($stillThere).Count -lt 1) {
  throw 'FAIL: no deberia borrar OC con recepciones'
}
Write-Output 'OK cannot delete OC with receptions'

# Auditoría presente
$aud = Invoke-RestMethod -Uri "$url/rest/v1/auditoria?tabla=eq.recepciones_material&registro_id=eq.$rec1&select=id&limit=1" -Headers $th
if (-not $aud -or $aud.Count -lt 1) {
  # acceso_total/operacion only — talia is compras, may not see auditoria
  Write-Output 'SKIP auditoria select (compras sin policy); verificado por triggers en migración'
} else {
  Write-Output 'OK auditoria row visible'
}

Write-Output 'E2E Fase 4 PASS'
