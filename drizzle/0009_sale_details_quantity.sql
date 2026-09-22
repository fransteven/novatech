-- sale_details.price y sale_details.unit_cost siempre fueron unitarios, pero la
-- tabla no guardaba las unidades: una línea no serializada de N unidades
-- registraba el ingreso y el costo de UNA sola. El histórico existente sólo
-- tiene líneas de 1 unidad (verificado contra inventory_movements), así que el
-- DEFAULT 1 es un backfill correcto y no requiere corrección de datos.
ALTER TABLE "sale_details" ADD COLUMN IF NOT EXISTS "quantity" integer DEFAULT 1 NOT NULL;

-- Las líneas serializadas son una fila por unidad física: nunca más de 1.
ALTER TABLE "sale_details" DROP CONSTRAINT IF EXISTS "sale_details_quantity_check";
ALTER TABLE "sale_details" ADD CONSTRAINT "sale_details_quantity_check"
  CHECK ("quantity" >= 1 AND ("product_item_id" IS NULL OR "quantity" = 1));
