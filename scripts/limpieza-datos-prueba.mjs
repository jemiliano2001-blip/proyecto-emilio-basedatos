/**
 * Utilidad de auditoría y depuración de datos de prueba en Supabase.
 * Ejecutado para purgar obras de ejemplo y transacciones de testing,
 * protegiendo las obras reales de Emilio (Molinos del Rey y Los Presidentes).
 */
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envPath = './.env.local';
if (!fs.existsSync(envPath)) {
  console.error("No se encontró archivo .env.local");
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
for (const line of envContent.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let val = match[2] || '';
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[match[1]] = val.trim();
  }
}

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan variables NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export async function verificarEstadoProduccion() {
  const { data: obras } = await supabase.from('obras').select('id, nombre, cliente, estado');
  const { data: mats } = await supabase.from('catalogo_materiales').select('id, nombre_base');
  const { data: sols } = await supabase.from('solicitudes_material').select('id, folio');
  const { data: ocs } = await supabase.from('ordenes_compra').select('id, folio_oc');

  console.log("=== ESTADO ACTUAL DE PRODUCCIÓN ===");
  console.log(`Obras activas (${obras?.length || 0}):`, obras?.map(o => o.nombre));
  console.log(`Materiales en catálogo: ${mats?.length || 0}`);
  console.log(`Solicitudes: ${sols?.length || 0}`);
  console.log(`Órdenes de compra: ${ocs?.length || 0}`);
}

if (process.argv[1]?.endsWith('limpieza-datos-prueba.mjs')) {
  verificarEstadoProduccion().catch(console.error);
}
