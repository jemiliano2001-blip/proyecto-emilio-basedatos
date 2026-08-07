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
$guero = Get-Token 'guero.prueba@example.com' 'TempGuero2026!'
$manuel = Get-Token 'manuel.prueba@example.com' 'TempManuel2026!'

$eh = Get-Headers $emilio.access_token
$gh = Get-Headers $guero.access_token
$mh = Get-Headers $manuel.access_token

# --- Precondiciones: 2 obras activas + 1 material con saldo contratado en obra A ---
$obras = Invoke-RestMethod -Uri "$url/rest/v1/obras?estado=eq.activa&select=id,nombre&limit=2" -Headers $eh
if (@($obras).Count -lt 2) {
  throw 'Se necesitan al menos 2 obras activas en Supabase para correr e2e-fase6.'
}
$obraA = $obras[0].id
$obraB = $obras[1].id
$matId = (Invoke-RestMethod -Uri "$url/rest/v1/catalogo_materiales?activo=eq.true&select=id&limit=1" -Headers $eh)[0].id

# Asegurar tope contratado holgado en Obra A.
# Se usa el mismo 100000 que e2e-fase5.ps1 a propósito: los dos scripts eligen
# las MISMAS dos primeras obras activas y el MISMO primer material, así que si
# cada uno pone un tope distinto se pisan entre corridas.
$topeHeaders = $eh.Clone()
$topeHeaders['Prefer'] = 'resolution=merge-duplicates,return=representation'
$topeBody = @{ obra_id = $obraA; material_id = $matId; cantidad_contratada = 100000 } | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/obra_material_contratado?on_conflict=obra_id,material_id" -Method POST -Headers $topeHeaders -Body $topeBody | Out-Null

# Presupuesto holgado en AMBAS obras: al aprobar, la obra destino tiene que
# poder absorber el costo del material traspasado (si no, aprobar_traspaso
# revienta con 'Presupuesto monetario insuficiente en la obra destino').
foreach ($obraId in @($obraA, $obraB)) {
  Invoke-RestMethod -Uri "$url/rest/v1/obras?id=eq.$obraId" -Method PATCH -Headers $eh -Body '{"presupuesto_mxn":1000000}' | Out-Null
}

# Lee el disponible actual de un material en una obra (0 si la obra todavía no
# tiene ese material en la vista de saldo).
function Get-Disponible([string]$obraId, [string]$materialId) {
  $r = Invoke-RestMethod -Uri "$url/rest/v1/v_saldo_material_obra?obra_id=eq.$obraId&material_id=eq.$materialId&select=cantidad_disponible" -Headers $eh
  if (@($r).Count -eq 0) { return [decimal]0 }
  return [decimal]$r[0].cantidad_disponible
}

# Las aserciones son por DELTA, no por valor absoluto: este script comparte
# obras y material con e2e-fase5.ps1 (que deja reservas activas) y consigo
# mismo entre corridas. Con valores absolutos fallaba sin que nada estuviera mal.
$baseA = Get-Disponible $obraA $matId
$baseB = Get-Disponible $obraB $matId

# Mismo criterio para el presupuesto en dinero.
function Get-DisponibleMxn([string]$obraId) {
  $r = Invoke-RestMethod -Uri "$url/rest/v1/v_saldo_presupuesto_obra?obra_id=eq.$obraId&select=disponible_mxn" -Headers $eh
  if (@($r).Count -eq 0) { return [decimal]0 }
  return [decimal]$r[0].disponible_mxn
}

$baseMxnA = Get-DisponibleMxn $obraA
$baseMxnB = Get-DisponibleMxn $obraB

Write-Output "Precondición lista: ObraA=$obraA, ObraB=$obraB, Material=$matId"
Write-Output "Disponible inicial -> ObraA=$baseA, ObraB=$baseB"
Write-Output "Presupuesto disponible inicial -> ObraA=$baseMxnA, ObraB=$baseMxnB"

if ($baseA -lt 150) {
  throw "La obra origen solo tiene $baseA disponibles; se necesitan al menos 150 para la prueba."
}

# --- Paso 1: Personal (Guero) solicita un traspaso de 150 unidades de Obra A a Obra B ---
$traspasoItems = @(
  @{ material_id = $matId; cantidad = 150 }
)
$rpcCrearBody = @{
  p_obra_origen_id = $obraA
  p_obra_destino_id = $obraB
  p_motivo = 'Traspaso E2E Fase 6 por requerimiento de obra B'
  p_items = $traspasoItems
} | ConvertTo-Json

$traspasoId = Invoke-RestMethod -Uri "$url/rest/v1/rpc/crear_solicitud_traspaso" -Method POST -Headers $gh -Body $rpcCrearBody
if (-not $traspasoId) {
  throw 'FAIL: No se pudo crear el traspaso vía RPC.'
}
Write-Output "Paso 1 OK: Traspaso creado con ID=$traspasoId"

# Verificar estado inicial
$tObs = Invoke-RestMethod -Uri "$url/rest/v1/traspasos_obra?id=eq.$traspasoId&select=folio,estado" -Headers $gh
if ($tObs[0].estado -ne 'solicitado') {
  throw "FAIL: El estado inicial debió ser 'solicitado', salio '$($tObs[0].estado)'"
}
$folio = $tObs[0].folio
Write-Output "Paso 1 OK: Folio asignado=$folio, Estado=solicitado"

# --- Paso 2: Proyectos (Manuel) aprueba el traspaso -> pasa a 'en_transito' ---
$rpcAprobarBody = @{ p_traspaso_id = $traspasoId } | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/rpc/aprobar_traspaso" -Method POST -Headers $mh -Body $rpcAprobarBody | Out-Null

$tObs2 = Invoke-RestMethod -Uri "$url/rest/v1/traspasos_obra?id=eq.$traspasoId&select=estado" -Headers $mh
if ($tObs2[0].estado -ne 'en_transito') {
  throw "FAIL: Tras aprobar, el estado debió ser 'en_transito', salió '$($tObs2[0].estado)'"
}
Write-Output "Paso 2 OK: Traspaso aprobado -> Estado=en_transito"

# Verificar saldo en vivo: Obra A disponible debió bajar exactamente 150
# (la salida cuenta desde 'en_transito': el material ya no es de nadie).
$saldoA = Invoke-RestMethod -Uri "$url/rest/v1/v_saldo_material_obra?obra_id=eq.$obraA&material_id=eq.$matId&select=cantidad_disponible,traspasos_salida" -Headers $eh
$espA = $baseA - 150
if ([decimal]$saldoA[0].cantidad_disponible -ne $espA) {
  throw "FAIL: Obra A disponible debió bajar de $baseA a $espA, salió $($saldoA[0].cantidad_disponible)"
}
Write-Output "Paso 2 OK: Saldo en vivo Obra A actualizado -> disponible=$($saldoA[0].cantidad_disponible) (antes $baseA), salidas=$($saldoA[0].traspasos_salida)"

# --- Paso 3: Personal (Guero) confirma recepción en Obra Destino -> pasa a 'completado' ---
$rpcConfirmarBody = @{ p_traspaso_id = $traspasoId } | ConvertTo-Json
Invoke-RestMethod -Uri "$url/rest/v1/rpc/confirmar_recepcion_traspaso" -Method POST -Headers $gh -Body $rpcConfirmarBody | Out-Null

$tObs3 = Invoke-RestMethod -Uri "$url/rest/v1/traspasos_obra?id=eq.$traspasoId&select=estado" -Headers $gh
if ($tObs3[0].estado -ne 'completado') {
  throw "FAIL: Tras confirmar recepción, el estado debió ser 'completado', salió '$($tObs3[0].estado)'"
}
Write-Output "Paso 3 OK: Recepción confirmada -> Estado=completado"

# Verificar saldo en vivo: Obra B disponible debió subir exactamente 150
# (la entrada cuenta solo desde 'completado').
$saldoB = Invoke-RestMethod -Uri "$url/rest/v1/v_saldo_material_obra?obra_id=eq.$obraB&material_id=eq.$matId&select=cantidad_disponible,traspasos_entrada" -Headers $eh
$espB = $baseB + 150
if ([decimal]$saldoB[0].cantidad_disponible -ne $espB) {
  throw "FAIL: Obra B disponible debió subir de $baseB a $espB, salió $($saldoB[0].cantidad_disponible)"
}
Write-Output "Paso 3 OK: Saldo en vivo Obra B actualizado -> disponible=$($saldoB[0].cantidad_disponible) (antes $baseB), entradas=$($saldoB[0].traspasos_entrada)"

# --- Paso 3b: el dinero siguió al material ---
# La valuación se congela al aprobar (último precio de compra del material).
# Si el material nunca se ha comprado por el sistema el precio es 0 y este
# bloque no prueba gran cosa — por eso se avisa.
$itemsTraspaso = Invoke-RestMethod -Uri "$url/rest/v1/traspaso_items?traspaso_id=eq.$traspasoId&select=cantidad,precio_unitario_mxn" -Headers $eh
$montoEsperado = [decimal]0
foreach ($it in @($itemsTraspaso)) {
  $precio = if ($null -eq $it.precio_unitario_mxn) { [decimal]0 } else { [decimal]$it.precio_unitario_mxn }
  $montoEsperado += [decimal]$it.cantidad * $precio
}

if ($montoEsperado -eq 0) {
  Write-Output "Paso 3b AVISO: el material no tiene precio de compra registrado, el traspaso se valuó en \$0 y no movió presupuesto."
} else {
  $mxnA = Get-DisponibleMxn $obraA
  $mxnB = Get-DisponibleMxn $obraB
  $espMxnA = $baseMxnA + $montoEsperado   # la obra origen RECUPERA
  $espMxnB = $baseMxnB - $montoEsperado   # la obra destino ABSORBE

  if ($mxnA -ne $espMxnA) {
    throw "FAIL: presupuesto disponible de Obra A debió subir de $baseMxnA a $espMxnA, salió $mxnA"
  }
  if ($mxnB -ne $espMxnB) {
    throw "FAIL: presupuesto disponible de Obra B debió bajar de $baseMxnB a $espMxnB, salió $mxnB"
  }
  Write-Output "Paso 3b OK: se movieron $montoEsperado MXN -> ObraA abonada ($mxnA), ObraB cargada ($mxnB)"
}

# --- Paso 4: el guardia de integridad bloquea un PATCH directo ---
# No hay policy que impida a estos roles hacer UPDATE sobre traspasos_obra; lo
# que lo impide es el trigger fn_traspasos_obra_before_update. Si esto deja de
# fallar, el hoyo volvió a abrirse.
$bloqueado = $false
try {
  Invoke-RestMethod -Uri "$url/rest/v1/traspasos_obra?id=eq.$traspasoId" -Method PATCH -Headers $mh -Body '{"estado":"solicitado"}' | Out-Null
} catch {
  $bloqueado = $true
}
if (-not $bloqueado) {
  throw 'FAIL: se pudo revertir un traspaso completado por PATCH directo — el trigger de integridad no está activo.'
}
Write-Output 'Paso 4 OK: PATCH directo de estado rechazado por el trigger de integridad'

Write-Output "=== E2E FASE 6 COMPLETADO EXITOSAMENTE ==="
Write-Output "NOTA: el traspaso $folio queda en estado 'completado' en la base (no hay borrado); cada corrida deja 150 unidades transferidas de ObraA a ObraB."
