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

$emilio = Get-Token 'emilio.prueba@example.com' 'TempEmilio2026!'
$talia = Get-Token 'talia.prueba@example.com' 'TempTalia2026!'
$eh = Get-Headers $emilio.access_token
$th = Get-Headers $talia.access_token

# --- Precondiciones: 2 obras activas + 1 material con saldo suficiente en ambas ---
$obras = Invoke-RestMethod -Uri "$url/rest/v1/obras?estado=eq.activa&select=id,nombre&limit=2" -Headers $eh
if (@($obras).Count -lt 2) {
  throw 'Se necesitan al menos 2 obras activas en este proyecto de Supabase para correr e2e-fase5.'
}
$obraA = $obras[0].id
$obraB = $obras[1].id
$matId = (Invoke-RestMethod -Uri "$url/rest/v1/catalogo_materiales?activo=eq.true&select=id&limit=1" -Headers $eh)[0].id

$topeHeaders = $eh.Clone()
$topeHeaders['Prefer'] = 'resolution=merge-duplicates,return=representation'
foreach ($obraId in @($obraA, $obraB)) {
  $topeBody = @{ obra_id = $obraId; material_id = $matId; cantidad_contratada = 100000 } | ConvertTo-Json
  Invoke-RestMethod -Uri "$url/rest/v1/obra_material_contratado?on_conflict=obra_id,material_id" -Method POST -Headers $topeHeaders -Body $topeBody | Out-Null
  Invoke-RestMethod -Uri "$url/rest/v1/obras?id=eq.$obraId" -Method PATCH -Headers $eh -Body '{"presupuesto_mxn":1000000}' | Out-Null
}
Write-Output "obraA=$obraA obraB=$obraB material=$matId"

# --- Escenario 1: requisición multi-obra, ambas obras con saldo suficiente ---
$solBody = @{ obra_id = $obraA; solicitante_id = $talia.user.id; nota = 'E2E Fase5 multi-obra' } | ConvertTo-Json
$sol = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $th -Body $solBody)[0]

# PostgREST exige que todos los objetos de un insert masivo compartan
# exactamente el mismo set de claves; se explicitan a $null los campos que
# no aplican por tipo_linea (mismo criterio que el check constraint).
$itemsBody = @(
  @{ solicitud_id = $sol.id; obra_id = $obraA; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 200; descripcion = $null; monto_mxn = $null }
  @{ solicitud_id = $sol.id; obra_id = $obraB; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 300; descripcion = $null; monto_mxn = $null }
  @{ solicitud_id = $sol.id; obra_id = $obraA; tipo_linea = 'flete'; material_id = $null; cantidad_solicitada = $null; descripcion = 'Flete obra A'; monto_mxn = 500 }
  @{ solicitud_id = $sol.id; obra_id = $obraB; tipo_linea = 'flete'; material_id = $null; cantidad_solicitada = $null; descripcion = 'Flete obra B'; monto_mxn = 700 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $th -Body $itemsBody | Out-Null
Write-Output "solicitud_multiobra=$($sol.id)"

Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_solicitud_compras" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol.id } | ConvertTo-Json) | Out-Null
Write-Output 'OK aprobar_solicitud_compras (multi-obra)'

# No existe usuario de prueba con rol finanzas (ver README) — se usa
# acceso_total, el único otro rol habilitado en aprobar_pago_solicitud.
$ordenes = Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_pago_solicitud" -Method POST -Headers $eh -Body (@{ p_solicitud_id = $sol.id } | ConvertTo-Json)
if (@($ordenes).Count -ne 2) {
  throw "FAIL: se esperaban 2 ordenes de compra, salieron $(@($ordenes).Count)"
}
Write-Output "OK 2 ordenes generadas: $($ordenes -join ', ')"

$ocA = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=in.($($ordenes -join ','))&obra_id=eq.$obraA&select=id,total" -Headers $th
$ocB = Invoke-RestMethod -Uri "$url/rest/v1/ordenes_compra?id=in.($($ordenes -join ','))&obra_id=eq.$obraB&select=id,total" -Headers $th
if (@($ocA).Count -ne 1 -or @($ocB).Count -ne 1) {
  throw 'FAIL: cada obra debe tener exactamente 1 orden de compra generada.'
}
Write-Output "OC obraA total=$($ocA[0].total) OC obraB total=$($ocB[0].total)"

# --- Escenario 2: saldo insuficiente en una obra -> la aprobacion completa falla ---
$solBody2 = @{ obra_id = $obraA; solicitante_id = $talia.user.id; nota = 'E2E Fase5 saldo insuficiente' } | ConvertTo-Json
$sol2 = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $th -Body $solBody2)[0]

$itemsBody2 = @(
  @{ solicitud_id = $sol2.id; obra_id = $obraA; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 50 }
  @{ solicitud_id = $sol2.id; obra_id = $obraB; tipo_linea = 'material'; material_id = $matId; cantidad_solicitada = 999999999 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $th -Body $itemsBody2 | Out-Null

$fallo = $false
try {
  Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_solicitud_compras" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol2.id } | ConvertTo-Json) | Out-Null
} catch {
  $fallo = $true
}
if (-not $fallo) {
  throw 'FAIL: la aprobacion debio fallar por saldo insuficiente en obra B.'
}
$reservasSol2 = Invoke-RestMethod -Uri "$url/rest/v1/solicitud_reservas_cantidad?solicitud_id=eq.$($sol2.id)&select=id" -Headers $th
if (@($reservasSol2).Count -ne 0) {
  throw 'FAIL: no debio quedar ninguna reserva parcial tras el fallo de aprobacion.'
}
Write-Output 'OK aprobacion todo-o-nada: saldo insuficiente en una obra bloquea todo, sin reservas parciales'

# --- Escenario 3: rechazo de una requisicion multi-obra ya aprobada libera el dinero correcto a cada obra ---
$solBody3 = @{ obra_id = $obraA; solicitante_id = $talia.user.id; nota = 'E2E Fase5 rechazo' } | ConvertTo-Json
$sol3 = (Invoke-RestMethod -Uri "$url/rest/v1/solicitudes_material" -Method POST -Headers $th -Body $solBody3)[0]
$itemsBody3 = @(
  @{ solicitud_id = $sol3.id; obra_id = $obraA; tipo_linea = 'flete'; descripcion = 'Flete A rechazo'; monto_mxn = 111 }
  @{ solicitud_id = $sol3.id; obra_id = $obraB; tipo_linea = 'flete'; descripcion = 'Flete B rechazo'; monto_mxn = 222 }
) | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/solicitud_items" -Method POST -Headers $th -Body $itemsBody3 | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_solicitud_compras" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol3.id } | ConvertTo-Json) | Out-Null
Invoke-RestMethod -Uri "$url/rest/v1/rpc/rechazar_solicitud" -Method POST -Headers $th -Body (@{ p_solicitud_id = $sol3.id; p_motivo = 'prueba e2e' } | ConvertTo-Json) | Out-Null

$movs = Invoke-RestMethod -Uri "$url/rest/v1/obra_presupuesto_movimientos?solicitud_id=eq.$($sol3.id)&tipo=eq.liberacion&select=obra_id,monto_mxn" -Headers $th
$libA = ($movs | Where-Object { $_.obra_id -eq $obraA }).monto_mxn
$libB = ($movs | Where-Object { $_.obra_id -eq $obraB }).monto_mxn
if ($libA -ne 111 -or $libB -ne 222) {
  throw "FAIL: liberacion incorrecta. obraA=$libA (esperado 111) obraB=$libB (esperado 222)"
}
Write-Output "OK rechazo libera el monto correcto por obra: obraA=$libA obraB=$libB"
