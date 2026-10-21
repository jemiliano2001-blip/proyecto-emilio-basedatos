-- 0049: datos adicionales del proveedor (RFC, correo, dirección, condiciones de pago).
-- Solo agrega columnas opcionales; no toca filas existentes.
-- RLS y trigger de auditoría de `proveedores` ya existen (0004) y cubren las columnas nuevas:
-- no hace falta crear políticas ni triggers.
-- Reversión: alter table proveedores drop column rfc, drop column correo,
--            drop column direccion, drop column condiciones_pago;

alter table proveedores
    add column if not exists rfc text,
    add column if not exists correo text,
    add column if not exists direccion text,
    add column if not exists condiciones_pago text;

-- RFC mexicano: 3 letras (moral) o 4 (física), fecha AAMMDD y homoclave de 3.
-- Se guarda en mayúsculas; la app lo normaliza antes de insertar.
alter table proveedores
    add constraint proveedores_rfc_formato
        check (rfc is null or rfc ~ '^[A-ZÑ&]{3,4}[0-9]{6}[A-Z0-9]{3}$'),
    add constraint proveedores_correo_formato
        check (correo is null or (length(correo) <= 254 and correo ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$')),
    add constraint proveedores_direccion_largo
        check (direccion is null or length(direccion) <= 500),
    add constraint proveedores_condiciones_pago_largo
        check (condiciones_pago is null or length(condiciones_pago) <= 200);
