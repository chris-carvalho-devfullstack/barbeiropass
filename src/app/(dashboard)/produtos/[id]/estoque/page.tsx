'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  ArrowLeft, Plus, Minus, History, Package, FileText, 
  Hash, CalendarDays, CalendarClock, ShoppingCart, 
  ArrowDownRight, ArrowUpRight, Filter
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client'; 
import { toast } from 'sonner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const runtime = 'edge';

interface ProductDetails {
  id: string;
  name: string;
  barbershop_id: string;
  stock_quantity: number;
}

interface StockMovement {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  notes: string;
  batch_number: string;
  invoice_number: string;
  created_at: string;
}

interface SaleRecord {
  id: string;
  created_at: string;
  quantity: number;
  unit_price: number;
}

// Tipagem para a resposta bruta do Supabase ao buscar pedidos
interface RawOrder {
  id: string;
  created_at: string;
  pos_order_items: { quantity: number; unit_price: number }[];
}

type SalesFilterType = 'hoje' | 'semana' | 'mes' | 'todos';

const ITEMS_PER_PAGE = 10;

export default function AjusteEstoquePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: productId } = React.use(params);
  
  const [product, setProduct] = useState<ProductDetails | null>(null);
  const [currentStock, setCurrentStock] = useState(0);
  
  const [adjustment, setAdjustment] = useState<number>(0);
  const [motivoSelecionado, setMotivoSelecionado] = useState('Novo Estoque');
  const [notes, setNotes] = useState('');
  const [lote, setLote] = useState('');
  const [notaFiscal, setNotaFiscal] = useState('');
  const [dataFab, setDataFab] = useState('');
  const [dataVal, setDataVal] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [movementsPage, setMovementsPage] = useState(0);
  const [hasMoreMovements, setHasMoreMovements] = useState(true);
  const [isLoadingMovements, setIsLoadingMovements] = useState(false);

  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [salesPage, setSalesPage] = useState(0);
  const [hasMoreSales, setHasMoreSales] = useState(true);
  const [isLoadingSales, setIsLoadingSales] = useState(false);
  const [salesFilter, setSalesFilter] = useState<SalesFilterType>('todos');

  const supabase = createClient();

  const formatDate = (dateString: string) => {
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(new Date(dateString));
  };

  const loadMovements = useCallback(async (pageIndex: number, reset = false) => {
    setIsLoadingMovements(true);
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    const { data, error } = await supabase
      .from('stock_movements')
      .select('*')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (!error && data) {
      setMovements(prev => reset ? data : [...prev, ...data]);
      setHasMoreMovements(data.length === ITEMS_PER_PAGE);
    }
    setIsLoadingMovements(false);
  }, [productId, supabase]);

  const loadSales = useCallback(async (pageIndex: number, filter: string, reset = false) => {
    setIsLoadingSales(true);
    const from = pageIndex * ITEMS_PER_PAGE;
    const to = from + ITEMS_PER_PAGE - 1;

    let query = supabase
      .from('pos_orders')
      .select(`
        id,
        created_at,
        pos_order_items!inner(id, product_id, quantity, unit_price)
      `)
      .eq('pos_order_items.product_id', productId)
      .order('created_at', { ascending: false })
      .range(from, to);

    const now = new Date();
    if (filter === 'hoje') {
      const today = new Date(now.setHours(0, 0, 0, 0)).toISOString();
      query = query.gte('created_at', today);
    } else if (filter === 'semana') {
      const week = new Date(now.setDate(now.getDate() - 7)).toISOString();
      query = query.gte('created_at', week);
    } else if (filter === 'mes') {
      const month = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      query = query.gte('created_at', month);
    }

    const { data, error } = await query;

    if (!error && data) {
      // Tipagem corrigida substituindo o 'any' por 'RawOrder'
      const formattedSales: SaleRecord[] = (data as unknown as RawOrder[]).map((order) => ({
        id: order.id,
        created_at: order.created_at,
        quantity: order.pos_order_items[0]?.quantity || 0,
        unit_price: order.pos_order_items[0]?.unit_price || 0,
      }));

      setSales(prev => reset ? formattedSales : [...prev, ...formattedSales]);
      setHasMoreSales(data.length === ITEMS_PER_PAGE);
    }
    setIsLoadingSales(false);
  }, [productId, supabase]);

  useEffect(() => {
    async function loadProduct() {
      const { data } = await supabase
        .from('products')
        .select('id, name, barbershop_id, stock_quantity')
        .eq('id', productId)
        .single();
        
      if (data) {
        setProduct(data as ProductDetails);
        setCurrentStock(data.stock_quantity || 0);
      }
    }
    loadProduct();
    loadMovements(0, true);
    loadSales(0, salesFilter, true);
  }, [productId, loadMovements, loadSales, salesFilter, supabase]);

  const handleAjuste = async () => {
    if (adjustment === 0 || !product) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/produtos/${productId}/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: adjustment,
          type: adjustment > 0 ? 'IN' : 'OUT', 
          barbershop_id: product.barbershop_id,
          reason: motivoSelecionado,
          notes: notes,
          batch_number: lote,
          invoice_number: notaFiscal,
          manufacturing_date: dataFab,
          expiry_date: dataVal
        })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar estoque.');

      if (data.success) {
        setCurrentStock(data.newStock); 
        setAdjustment(0);
        setNotes('');
        setLote('');
        setNotaFiscal('');
        setDataFab('');
        setDataVal('');
        toast.success('Estoque atualizado com sucesso!'); 
        
        setMovementsPage(0);
        loadMovements(0, true);
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido.';
      toast.error(`Erro: ${errorMessage}`); 
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) return <div className="min-h-screen flex items-center justify-center text-gray-500">A carregar dados...</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      {/* Aqui reduzi o padding horizontal no mobile (px-3) e mantive px-4 para telas maiores (sm:px-4) */}
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-1 sm:px-4 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Gestão de Estoque</h1>
        <div className="w-10"></div> 
      </header>

      {/* Ajuste de espaçamento principal do conteúdo também puxando mais para as bordas no mobile */}
      <main className="max-w-xl mx-auto px-3 sm:px-4 mt-6 space-y-6">
        
        {/* Ajuste interno do card de p-6 para p-4 no mobile, e p-6 em telas sm+ */}
        <section className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-gray-50 opacity-50">
            <Package className="w-32 h-32" />
          </div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 z-10">Estoque Disponível</h2>
          <div className="text-6xl font-bold text-gray-900 tracking-tighter z-10">{currentStock}</div>
          <p className="text-sm text-gray-400 mt-2 z-10">{product.name}</p>
        </section>

        <section className="bg-white rounded-3xl p-4 sm:p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Ajustar Quantidade</h3>
          
          <div className="flex items-center gap-3 mb-6">
            <button onClick={() => setAdjustment(prev => prev - 1)} className="flex-1 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-100 transition-all">
              <Minus className="w-6 h-6" />
            </button>
            {/* Corrigido flex-[2] para flex-2 conforme sugerido pelo linter */}
            <div className="flex-2 relative">
              <input type="number" value={adjustment === 0 ? '' : adjustment} onChange={(e) => setAdjustment(Number(e.target.value))} className="w-full h-14 text-center text-2xl font-bold text-gray-900 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all" placeholder="0" />
            </div>
            <button onClick={() => setAdjustment(prev => prev + 1)} className="flex-1 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-100 transition-all">
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1">Tipo de Ajuste</label>
                <select value={motivoSelecionado} onChange={(e) => setMotivoSelecionado(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="Novo Estoque">Novo Estoque</option>
                  <option value="Devolução">Devolução</option>
                  <option value="Perda/Avaria">Perda/Avaria</option>
                  <option value="Ajuste Manual">Ajuste Manual</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><FileText className="w-3 h-3"/> Nota Fiscal</label>
                <input type="text" value={notaFiscal} onChange={(e) => setNotaFiscal(e.target.value)} placeholder="Nº da NF" className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><Hash className="w-3 h-3"/> Lote do Produto</label>
              <input type="text" value={lote} onChange={(e) => setLote(e.target.value)} placeholder="Ex: L12345" className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Fabricação</label>
                <input type="date" value={dataFab} onChange={(e) => setDataFab(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><CalendarClock className="w-3 h-3"/> Validade</label>
                <input type="date" value={dataVal} onChange={(e) => setDataVal(e.target.value)} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 ml-1">Observações Livres</label>
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Detalhes adicionais..." rows={2} className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
            </div>
            
            <button onClick={handleAjuste} disabled={adjustment === 0 || isLoading} className={`w-full h-14 rounded-xl font-semibold text-white shadow-sm transition-all mt-2 ${adjustment === 0 || isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-black hover:bg-gray-800 active:scale-[0.98]'}`}>
              {isLoading ? 'A guardar...' : 'Confirmar Alteração'}
            </button>
          </div>
        </section>

        <section className="pt-2">
          <Tabs defaultValue="movimentos" className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="movimentos" className="flex items-center gap-2">
                <History className="w-4 h-4" /> Movimentações
              </TabsTrigger>
              <TabsTrigger value="vendas" className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4" /> Vendas (PDV)
              </TabsTrigger>
            </TabsList>

            <TabsContent value="movimentos" className="space-y-6">
              {/* Corrigido before:bg-gradient-to-b para before:bg-linear-to-b */}
              <div className="space-y-4 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-linear-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {movements.map((mov) => (
                  <div key={mov.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                    <div className={`flex items-center justify-center w-10 h-10 rounded-full border border-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10 ${mov.type === 'IN' ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                      {mov.type === 'IN' ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                    </div>
                    <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all">
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm text-gray-900">{mov.reason || 'Ajuste de Estoque'}</span>
                        <span className={`font-bold text-sm ${mov.type === 'IN' ? 'text-emerald-600' : 'text-red-600'}`}>
                          {mov.type === 'IN' ? '+' : '-'}{Math.abs(mov.quantity)}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 space-y-1">
                        <p>{formatDate(mov.created_at)}</p>
                        {mov.batch_number && <p><span className="font-medium">Lote:</span> {mov.batch_number}</p>}
                        {mov.invoice_number && <p><span className="font-medium">NF:</span> {mov.invoice_number}</p>}
                        {/* As aspas duplas foram escapadas para &quot; para resolver o aviso do eslintreact */}
                        {mov.notes && <p className="italic bg-gray-50 p-2 rounded-lg mt-2 text-gray-600">&quot;{mov.notes}&quot;</p>}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {hasMoreMovements && (
                <button 
                  onClick={() => {
                    const nextPage = movementsPage + 1;
                    setMovementsPage(nextPage);
                    loadMovements(nextPage);
                  }}
                  disabled={isLoadingMovements}
                  className="w-full py-3 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {isLoadingMovements ? 'A carregar...' : 'Carregar mais movimentos'}
                </button>
              )}
              {movements.length === 0 && !isLoadingMovements && (
                <div className="text-center py-8 text-sm text-gray-500">Nenhuma movimentação registada.</div>
              )}
            </TabsContent>

            <TabsContent value="vendas" className="space-y-4">
              <div className="flex items-center gap-2 mb-4 overflow-x-auto pb-2 scrollbar-hide">
                <Filter className="w-4 h-4 text-gray-400" />
                {['todos', 'hoje', 'semana', 'mes'].map((f) => (
                  <button
                    key={f}
                    onClick={() => {
                      // Tipagem estrita aplicada no filter
                      const filterValue = f as SalesFilterType;
                      setSalesFilter(filterValue);
                      setSalesPage(0);
                      loadSales(0, filterValue, true);
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize whitespace-nowrap transition-all ${
                      salesFilter === f 
                      ? 'bg-black text-white' 
                      : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {sales.map((sale) => (
                  <div key={sale.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-gray-900">Venda PDV</p>
                        <p className="text-xs text-gray-500">{formatDate(sale.created_at)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm text-gray-900">{sale.quantity}x</p>
                      <p className="text-xs text-gray-500">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(sale.unit_price)} unid.
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              {hasMoreSales && (
                <button 
                  onClick={() => {
                    const nextPage = salesPage + 1;
                    setSalesPage(nextPage);
                    loadSales(nextPage, salesFilter);
                  }}
                  disabled={isLoadingSales}
                  className="w-full py-3 mt-4 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  {isLoadingSales ? 'A carregar...' : 'Carregar mais vendas'}
                </button>
              )}
              {sales.length === 0 && !isLoadingSales && (
                <div className="text-center py-8 text-sm text-gray-500">Nenhuma venda encontrada para o período selecionado.</div>
              )}
            </TabsContent>
          </Tabs>
        </section>
      </main>
    </div>
  );
}