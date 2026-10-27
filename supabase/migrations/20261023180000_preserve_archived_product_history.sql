
BEGIN;

-- ============================================================
-- 1. SKU E SLUG:
-- Permitir reutilização apenas depois do arquivamento.
--
-- Produtos inativos, mas não arquivados, continuam reservando
-- seus identificadores para permitir eventual reativação.
-- ============================================================

ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS unique_sku_per_barbershop;

ALTER TABLE public.products
    DROP CONSTRAINT IF EXISTS unique_slug_per_barbershop;

CREATE UNIQUE INDEX IF NOT EXISTS
    products_barbershop_sku_not_deleted_uidx
ON public.products (barbershop_id, sku)
WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS
    products_barbershop_slug_not_deleted_uidx
ON public.products (barbershop_id, slug)
WHERE deleted_at IS NULL;


-- ============================================================
-- 2. HISTÓRICO DO ESTOQUE:
-- Impedir que a exclusão física de um produto apague
-- suas movimentações históricas em cascata.
-- ============================================================

ALTER TABLE public.stock_movements
    DROP CONSTRAINT IF EXISTS stock_movements_product_id_fkey;

ALTER TABLE public.stock_movements
    ADD CONSTRAINT stock_movements_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE RESTRICT;


-- ============================================================
-- 3. HISTÓRICO DE VENDAS:
-- Declarar explicitamente que um produto referenciado
-- por uma venda não pode ser excluído fisicamente.
-- ============================================================

ALTER TABLE public.pos_order_items
    DROP CONSTRAINT IF EXISTS pos_order_items_product_id_fkey;

ALTER TABLE public.pos_order_items
    ADD CONSTRAINT pos_order_items_product_id_fkey
    FOREIGN KEY (product_id)
    REFERENCES public.products(id)
    ON DELETE RESTRICT;

COMMIT;
