'use client';

import React, { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Minus, History, Package, FileText, Hash, CalendarDays, CalendarClock } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client'; 
import { toast } from 'sonner';

// Tipagem rigorosa para substituir o 'any'
interface ProductDetails {
  id: string;
  name: string;
  barbershop_id: string;
  stock_quantity: number;
}

export default function AjusteEstoquePage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id: productId } = React.use(params);
  
  // O tipo correto é aplicado aqui
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

  useEffect(() => {
    async function loadProduct() {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('products')
        .select('id, name, barbershop_id, stock_quantity')
        .eq('id', productId)
        .single();
        
      if (data) {
        setProduct(data as ProductDetails);
        setCurrentStock(data.stock_quantity || 0);
      } else {
        toast.error('Produto não encontrado.');
      }
    }
    loadProduct();
  }, [productId]);

  const handleAjuste = async () => {
    if (adjustment === 0 || !product) return;
    setIsLoading(true);

    try {
      const res = await fetch(`/api/produtos/${productId}/estoque`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          quantity: adjustment,
          // Agora usamos exatamente as palavras permitidas pelo seu banco de dados
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

      if (!res.ok) throw new Error(data.error || 'Erro ao atualizar estoque da API.');

      if (data.success) {
        setCurrentStock(data.newStock); 
        setAdjustment(0);
        setNotes('');
        setLote('');
        setNotaFiscal('');
        setDataFab('');
        setDataVal('');
        toast.success('Estoque atualizado com sucesso!'); 
      }
    } catch (error: unknown) {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : 'Ocorreu um erro desconhecido.';
      toast.error(`Erro: ${errorMessage}`); 
    } finally {
      setIsLoading(false);
    }
  };

  if (!product) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">A carregar dados do produto...</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur-md border-b border-gray-200 px-4 py-4 flex items-center justify-between">
        <button onClick={() => router.back()} className="p-2 -ml-2 rounded-full hover:bg-gray-100 transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-700" />
        </button>
        <h1 className="text-lg font-semibold text-gray-900 tracking-tight">Gestão de Estoque</h1>
        <div className="w-10"></div> 
      </header>

      <main className="max-w-xl mx-auto px-4 mt-6 space-y-6">
        
        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 flex flex-col items-center justify-center relative overflow-hidden">
          <div className="absolute -right-6 -top-6 text-gray-50 opacity-50">
            <Package className="w-32 h-32" />
          </div>
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-2 z-10">Estoque Disponível</h2>
          <div className="text-6xl font-bold text-gray-900 tracking-tighter z-10">{currentStock}</div>
          <p className="text-sm text-gray-400 mt-2 z-10">{product.name}</p>
        </section>

        <section className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-base font-semibold text-gray-900 mb-4">Ajustar Quantidade</h3>
          
          <div className="flex items-center gap-3 mb-6">
            <button 
              onClick={() => setAdjustment(prev => prev - 1)}
              className="flex-1 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center hover:bg-red-100 active:scale-95 transition-all"
            >
              <Minus className="w-6 h-6" />
            </button>
            
            <div className="flex-[2] relative">
              <input 
                type="number" 
                value={adjustment === 0 ? '' : adjustment}
                onChange={(e) => setAdjustment(Number(e.target.value))}
                className="w-full h-14 text-center text-2xl font-bold text-gray-900 bg-gray-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 transition-all"
                placeholder="0"
              />
            </div>

            <button 
              onClick={() => setAdjustment(prev => prev + 1)}
              className="flex-1 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center hover:bg-emerald-100 active:scale-95 transition-all"
            >
              <Plus className="w-6 h-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1">Tipo de Ajuste</label>
                <select 
                  value={motivoSelecionado}
                  onChange={(e) => setMotivoSelecionado(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                >
                  <option value="Novo Estoque">Novo Estoque</option>
                  <option value="Devolução">Devolução</option>
                  <option value="Perda/Avaria">Perda/Avaria</option>
                  <option value="Ajuste Manual">Ajuste Manual</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><FileText className="w-3 h-3"/> Nota Fiscal</label>
                <input 
                  type="text" 
                  value={notaFiscal}
                  onChange={(e) => setNotaFiscal(e.target.value)}
                  placeholder="Nº da NF" 
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><Hash className="w-3 h-3"/> Lote do Produto</label>
              <input 
                type="text" 
                value={lote}
                onChange={(e) => setLote(e.target.value)}
                placeholder="Ex: L12345" 
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><CalendarDays className="w-3 h-3"/> Fabricação</label>
                <input 
                  type="date" 
                  value={dataFab}
                  onChange={(e) => setDataFab(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-gray-500 ml-1 flex items-center gap-1"><CalendarClock className="w-3 h-3"/> Validade</label>
                <input 
                  type="date" 
                  value={dataVal}
                  onChange={(e) => setDataVal(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-3 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-gray-500 ml-1">Observações Livres</label>
              <textarea 
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalhes adicionais..." 
                rows={2}
                className="w-full bg-gray-50 border border-gray-200 text-gray-900 text-sm rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all resize-none"
              />
            </div>
            
            <button 
              onClick={handleAjuste}
              disabled={adjustment === 0 || isLoading}
              className={`w-full h-14 rounded-xl font-semibold text-white shadow-sm transition-all mt-2 ${
                adjustment === 0 || isLoading 
                ? 'bg-gray-300 cursor-not-allowed' 
                : 'bg-black hover:bg-gray-800 active:scale-[0.98] shadow-gray-200'
              }`}
            >
              {isLoading ? 'A guardar...' : 'Confirmar Alteração'}
            </button>
          </div>
        </section>

        <section className="pt-4">
          <div className="flex items-center gap-2 mb-6">
            <History className="w-5 h-5 text-gray-400" />
            <h3 className="text-base font-semibold text-gray-900">Histórico de Movimentos</h3>
          </div>
          
          <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-300 before:to-transparent">
            
            <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
              <div className="flex items-center justify-center w-10 h-10 rounded-full border border-white bg-blue-50 text-blue-600 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                <Package className="w-5 h-5" />
              </div>
              <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-semibold text-sm text-gray-900">Produto Cadastrado</span>
                  <span className="text-blue-600 font-bold text-[10px] uppercase tracking-wider bg-blue-100 px-2 py-0.5 rounded-full">Início</span>
                </div>
                <p className="text-xs text-gray-500 leading-relaxed mt-1">Ponto de partida. O histórico de movimentações deste produto será registado a partir de agora.</p>
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}