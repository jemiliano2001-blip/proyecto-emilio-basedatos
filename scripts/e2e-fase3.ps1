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

$obraId = (Invoke-RestMethod -Uri "$url/rest/v1/obras?estado=eq.activa&select=id&limit=1" -Headers $gh)[0].id
$matId = (Invoke-RestMethod -Uri "$url/rest/v1/catalogo_materiales?activo=eq.true&select=id&limit=1" -Headers $gh)[0].id

$solBody = @{ obra_id = $obraId; solicitante_id = $guero.user.id; nota = 'E2E Fase3' } | ConvertTo-Json
$sol = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $gh -Body $solBody)[0]

$itemBody = @(
  @{ solicitud_id = $sol.id; material_id = $matId; cantidad_solicitada = 5 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $gh -Body $itemBody | Out-Null
$itemId = (Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items?solicitud_id=eq.$($sol.id)&select=id" -Headers $gh)[0].id
Write-Output "solicitud=$($sol.id) item=$itemId"

$provBody = @{ nombre = "Proveedor de ejemplo $(Get-Random)" } | ConvertTo-Json
$prov = (Invoke-RestMethod -Uri "$url/rest/v1/proveedores" -Method POST -Headers $th -Body $provBody)[0]
Write-Output "proveedor=$($prov.id)"

$cotBody = @{ solicitud_id = $sol.id; cotizador_id = $talia.user.id; estado = 'borrador' } | ConvertTo-Json
$cot = (Invoke-RestMethod -Uri "$url/rest/v1/cotizaciones" -Method POST -Headers $th -Body $cotBody)[0]

$ciBody = @(
  @{
    cotizacion_id = $cot.id
    solicitud_item_id = $itemId
    proveedor_id = $prov.id
    precio_unitario = 12.50
    cantidad = 5
    moneda = 'MXN'
  }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/cotizacion_items" -Method POST -Headers $th -Body $ciBody | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material?id=eq.$($sol.id)" -Method PATCH -Headers $th -Body '{"estado":"en_cotizacion"}' | Out-Null
Write-Output "cotizacion=$($cot.id)"

$folio = Invoke-RestMethod -Uri "$url/rest/v1/rpc/next_folio_orden_compra" -Method POST -Headers $th -Body '{}'
Write-Output "folio=$folio"

$ordenBody = @{
  folio = $folio
  cotizacion_id = $cot.id
  proveedor_id = $prov.id
  obra_id = $obraId
  estado = 'emitida'
  total = 62.50
  moneda = 'MXN'
  creado_por = $talia.user.id
} | ConvertTo-Json
$orden = (Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra" -Method POST -Headers $th -Body $ordenBody)[0]

$ociBody = @(
  @{
    orden_id = $orden.id
    material_id = $matId
    cantidad = 5
    precio_unitario = 12.50
    subtotal = 62.50
  }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/orden_compra_items" -Method POST -Headers $th -Body $ociBody | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/cotizaciones?id=eq.$($cot.id)" -Method PATCH -Headers $th -Body '{"estado":"aprobada"}' | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material?id=eq.$($sol.id)" -Method PATCH -Headers $th -Body '{"estado":"aprobada"}' | Out-Null
Write-Output "orden=$($orden.id) folio=$($orden.folio) total=$($orden.total)"

$gueroOc = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?select=id&id=eq.$($orden.id)" -Headers $gh
Write-Output "guero_sees_oc=$($gueroOc.Count)"

$estado = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material?id=eq.$($sol.id)&select=estado" -Headers $gh)[0].estado
Write-Output "guero_solicitud_estado=$estado"

$gueroPrices = Invoke-RestMethod -Uri "$url/rest/v1/cotizacion_items?select=precio_unitario&cotizacion_id=eq.$($cot.id)" -Headers $gh
Write-Output "guero_sees_precios=$($gueroPrices.Count)"
