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
$eh = Get-Headers $emilio.access_token

# Rol `personal`: se usa para comprobar que NO puede leer la conciliación monetaria.
$guero = Get-Token 'guero.prueba@example.com' 'TempGuero2026!'
$gh = Get-Headers $guero.access_token

# --- Precondición: Crear una obra temporal activa para la prueba de cierre ---
$obraTestBody = @{
  nombre = 'Obra Prueba Cierre Fase7'
  cliente = 'Cliente E2E Fase7'
  presupuesto_mxn = 500000
  estado = 'activa'
} | ConvertTo-Json

$obraTest = (Invoke-RestMethod -Uri "$url/rest/v1/obras" -Method POST -Headers $eh -Body $obraTestBody)[0]
$obraId = $obraTest.id
Write-Output "Obra creada para prueba de cierre: ID=$obraId"

# Todo el cuerpo va en try/finally: si cualquier aserción truena a media
# prueba, la obra temporal NO se puede quedar huérfana en la base real.
try {
  # --- Paso 1: Consultar conciliación inicial ---
  $concPres = Invoke-RestMethod -Uri "$url/rest/v1/v_conciliacion_obra_presupuesto?obra_id=eq.$obraId" -Headers $eh
  if (@($concPres).Count -ne 1) {
    throw "FAIL: No se pudo consultar v_conciliacion_obra_presupuesto para la obra $obraId"
  }
  Write-Output "Paso 1 OK: Presupuesto=$($concPres[0].presupuesto_mxn), Gastado=$($concPres[0].gastado_total_ejecutado_mxn), Saldo=$($concPres[0].variacion_saldo_mxn)"

  # --- Paso 1b: `personal` NO debe ver la conciliación monetaria ---
  $concPersonal = Invoke-RestMethod -Uri "$url/rest/v1/v_conciliacion_obra_presupuesto?obra_id=eq.$obraId" -Headers $gh
  if (@($concPersonal).Count -ne 0) {
    throw 'FAIL: el rol personal pudo leer v_conciliacion_obra_presupuesto (fuga de información financiera).'
  }
  Write-Output 'Paso 1b OK: el rol personal no ve la conciliación monetaria'

  # --- Paso 2: Cierre de Obra vía RPC `cerrar_obra` ---
  $notaCierre = 'Cierre automatizado de prueba E2E Fase 7'
  $rpcCerrarBody = @{ p_obra_id = $obraId; p_nota = $notaCierre } | ConvertTo-Json
  Invoke-RestMethod -Uri "$url/rest/v1/rpc/cerrar_obra" -Method POST -Headers $eh -Body $rpcCerrarBody | Out-Null

  $obraObs = Invoke-RestMethod -Uri "$url/rest/v1/obras?id=eq.$obraId&select=estado,cerrado_en,cierre_nota" -Headers $eh
  if ($obraObs[0].estado -ne 'cerrada' -or -not $obraObs[0].cerrado_en) {
    throw "FAIL: La obra no cambió su estado a 'cerrada' correctamente."
  }
  if ($obraObs[0].cierre_nota -ne $notaCierre) {
    throw "FAIL: la nota de cierre no se guardó (esperada '$notaCierre', salió '$($obraObs[0].cierre_nota)')."
  }
  Write-Output "Paso 2 OK: Obra cerrada formalmente. Estado=$($obraObs[0].estado), CerradoEn=$($obraObs[0].cerrado_en), Nota guardada"

  # --- Paso 3: Reapertura de Obra vía RPC `reabrir_obra` ---
  $rpcReabrirBody = @{ p_obra_id = $obraId } | ConvertTo-Json
  Invoke-RestMethod -Uri "$url/rest/v1/rpc/reabrir_obra" -Method POST -Headers $eh -Body $rpcReabrirBody | Out-Null

  $obraObs2 = Invoke-RestMethod -Uri "$url/rest/v1/obras?id=eq.$obraId&select=estado,cerrado_en,cierre_nota" -Headers $eh
  if ($obraObs2[0].estado -ne 'activa' -or $null -ne $obraObs2[0].cerrado_en) {
    throw "FAIL: La obra no se reabrió a 'activa'."
  }
  if ($null -ne $obraObs2[0].cierre_nota) {
    throw 'FAIL: al reabrir, la nota de cierre debió limpiarse.'
  }
  Write-Output "Paso 3 OK: Obra reabierta. Estado=$($obraObs2[0].estado), nota limpiada"

  Write-Output "=== E2E FASE 7 COMPLETADO EXITOSAMENTE ==="
}
finally {
  # --- Limpieza: siempre, pase lo que pase ---
  Invoke-RestMethod -Uri "$url/rest/v1/obras?id=eq.$obraId" -Method DELETE -Headers $eh | Out-Null
  Write-Output "Limpieza: obra temporal $obraId eliminada"
}
