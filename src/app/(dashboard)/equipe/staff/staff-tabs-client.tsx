"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { History, DollarSign, Loader2, Receipt, Calendar as CalendarIcon, Package, Scissors, ChevronLeft, ChevronRight, AlertCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";

// ==========================================
// INTERFACES PARA TIPAGEM ESTRITA NO CLIENTE
// ==========================================
export interface OrderHistoryEntry {
  id: string;
  created_at: string;
  customer_name: string | null;
  source_type: string | null;
  payment_method: string | null;
  total_amount: number;
}

export interface LedgerEntry {
  id: string;
  created_at: string;
  transaction_type: string;
  amount: number;
  description: string | null;
}

export interface ReceiptItem {
  id: string;
  quantity: number;
  unit_price: number;
  commission_amount: number;
  item_type: string;
  services: { name: string } | null;
  products: { name: string } | null;
  staff: { full_name: string } | null;
}

export interface ReceiptDetails {
  id: string;
  created_at: string;
  customer_name: string | null;
  payment_method: string | null;
  pos_order_items: ReceiptItem[];
}

interface StaffTabsClientProps {
  staffId: string;
  isManager: boolean;
  agendaNode: React.ReactNode;
}

export function StaffTabsClient({ staffId, isManager, agendaNode }: StaffTabsClientProps) {
  const [period, setPeriod] = useState("hoje");
  const [limit, setLimit] = useState("10");
  const [page, setPage] = useState(1);
  
  const [historyData, setHistoryData] = useState<OrderHistoryEntry[]>([]);
  const [ledgerData, setLedgerData] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const [selectedOrder, setSelectedOrder] = useState<ReceiptDetails | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoadingSheet, setIsLoadingSheet] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [histRes, ledRes] = await Promise.all([
        fetch(`/api/staff/historico?staffId=${staffId}&period=${period}&limit=${limit}&page=${page}`),
        fetch(`/api/staff/extrato?staffId=${staffId}&period=${period}&limit=${limit}&page=${page}`)
      ]);
      
      if (histRes.ok) {
        const hist = await histRes.json();
        setHistoryData(hist.data || []);
      }
      if (ledRes.ok) {
        const led = await ledRes.json();
        setLedgerData(led.data || []);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      console.error("Erro ao carregar dados", msg);
    } finally {
      setIsLoading(false);
    }
  }, [staffId, period, limit, page]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePeriodChange = (val: string) => { setPeriod(val); setPage(1); };
  const handleLimitChange = (val: string) => { setLimit(val); setPage(1); };

  const openReceipt = async (orderId: string) => {
    setIsSheetOpen(true);
    setIsLoadingSheet(true);
    try {
      const res = await fetch(`/api/staff/recibo?orderId=${orderId}`);
      if (res.ok) {
        const details: ReceiptDetails = await res.json();
        setSelectedOrder(details);
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Erro desconhecido";
      console.error(msg);
    } finally {
      setIsLoadingSheet(false);
    }
  };

  const PaginationControls = ({ dataLength }: { dataLength: number }) => (
    <div className="flex items-center justify-between pt-4 mt-4 border-t border-border/50">
      <p className="text-xs text-muted-foreground">Página {page}</p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1 || isLoading}>
          <ChevronLeft className="w-4 h-4" /> Anterior
        </Button>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={dataLength < Number(limit) || isLoading}>
          Próxima <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );

  const Filters = () => (
    <div className="flex flex-col sm:flex-row gap-3 mb-2 sm:mb-0 w-full sm:w-auto">
      <Select value={period} onValueChange={handlePeriodChange} disabled={isLoading}>
        <SelectTrigger className="w-full sm:w-37.5"><CalendarIcon className="w-4 h-4 mr-2"/> <SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="hoje">Hoje</SelectItem>
          <SelectItem value="semana">Nesta Semana</SelectItem>
          <SelectItem value="mes">Neste Mês</SelectItem>
          <SelectItem value="todos">Todo o Período</SelectItem>
        </SelectContent>
      </Select>
      <Select value={limit} onValueChange={handleLimitChange} disabled={isLoading}>
        <SelectTrigger className="w-full sm:w-32.5"><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="10">10 linhas</SelectItem>
          <SelectItem value="30">30 linhas</SelectItem>
          <SelectItem value="50">50 linhas</SelectItem>
          <SelectItem value="100">100 linhas</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Tabs defaultValue="agenda" className="space-y-4 w-full">
      <TabsList className="grid grid-cols-3 w-full max-w-md bg-muted/80 p-1 rounded-xl">
        <TabsTrigger value="agenda" className="rounded-lg gap-2 text-xs sm:text-sm">
          <CalendarIcon className="h-4 w-4 hidden sm:inline" /> Agenda
        </TabsTrigger>
        <TabsTrigger value="transacoes" className="rounded-lg gap-2 text-xs sm:text-sm">
          <History className="h-4 w-4 hidden sm:inline" /> Transações
        </TabsTrigger>
        <TabsTrigger value="auditoria" className="rounded-lg gap-2 text-xs sm:text-sm">
          <DollarSign className="h-4 w-4 hidden sm:inline" /> Relatórios
        </TabsTrigger>
      </TabsList>

      <TabsContent value="agenda" className="space-y-4">
        {agendaNode}
      </TabsContent>

      <TabsContent value="transacoes">
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base sm:text-lg">Transações de Venda</CardTitle>
              <CardDescription>Visão geral de tickets onde você participou. Clique para detalhes.</CardDescription>
            </div>
            <Filters />
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
            {isLoading ? <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div> : (
              <>
                <Table>
                  <TableHeader className="bg-muted/40 sm:bg-transparent">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Pagamento</TableHead>
                      <TableHead className="text-right">Total Pedido</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historyData.map(order => (
                      <TableRow key={order.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => openReceipt(order.id)}>
                        <TableCell className="font-medium text-sm">{new Date(order.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell className="font-semibold text-slate-700">{order.customer_name || "Avulso"}</TableCell>
                        <TableCell><Badge variant="outline" className="uppercase text-[10px]">{order.payment_method}</Badge></TableCell>
                        <TableCell className="text-right font-bold text-blue-600">R$ {Number(order.total_amount).toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                    {historyData.length === 0 && <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground italic text-sm">Nenhuma transação encontrada.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <PaginationControls dataLength={historyData.length} />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="auditoria">
        <Card className="border-none shadow-sm bg-background">
          <CardHeader className="flex flex-col sm:flex-row items-start sm:items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base sm:text-lg">Livro Razão (Auditoria)</CardTitle>
              <CardDescription>Lançamentos financeiros linha a linha.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <Filters />
              {isManager && (
                <Link href="/pdv">
                  <Button size="sm" variant="outline" className="hidden sm:flex h-9"><DollarSign className="h-4 w-4 mr-1"/> Lançar</Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="overflow-x-auto p-0 sm:p-6 sm:pt-0">
            {isLoading ? <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground"/></div> : (
              <>
                <Table>
                  <TableHeader className="bg-muted/40 sm:bg-transparent">
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Operação</TableHead>
                      <TableHead>Descrição</TableHead>
                      <TableHead className="text-right">Repasse</TableHead>
                      {isManager && <TableHead className="text-right w-16">Audit</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ledgerData.map(ledger => (
                      <TableRow key={ledger.id} className="hover:bg-muted/20">
                        <TableCell className="text-sm text-muted-foreground">{new Date(ledger.created_at).toLocaleString("pt-BR")}</TableCell>
                        <TableCell>
                          <Badge variant={ledger.amount > 0 ? "outline" : "destructive"} className={ledger.amount > 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200" : ""}>
                            {ledger.transaction_type === "commission_earned" ? "Comissão" : ledger.transaction_type === "chair_rental_fee" ? "Aluguel" : "Ajuste"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm font-medium">{ledger.description}</TableCell>
                        <TableCell className={`text-right font-bold ${ledger.amount > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {ledger.amount > 0 ? "+" : ""}R$ {Number(ledger.amount).toFixed(2)}
                        </TableCell>
                        {isManager && (
                          <TableCell className="text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive"><AlertCircle className="h-4 w-4" /></Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                    {ledgerData.length === 0 && <TableRow><TableCell colSpan={isManager ? 5 : 4} className="text-center py-8 text-muted-foreground italic text-sm">Nenhum lançamento encontrado.</TableCell></TableRow>}
                  </TableBody>
                </Table>
                <PaginationControls dataLength={ledgerData.length} />
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      {/* GAVETA DO RECIBO DETALHADO (DESIGN PREMIUM) */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        {/* max-w-xl permite que a aba abra muito mais à esquerda no Desktop (576px) */}
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto p-0 flex flex-col font-sans">
          
          <div className="p-6 md:p-8 flex-1 overflow-y-auto custom-scrollbar">
            <SheetHeader className="mb-8 space-y-0 flex flex-row items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-50 text-blue-600 rounded-full border border-blue-100">
                  <Receipt className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <SheetTitle className="text-2xl font-black tracking-tight text-slate-900">
                    Recibo Detalhado
                  </SheetTitle>
                  <SheetDescription className="font-mono text-xs mt-1 text-slate-500 uppercase tracking-wider font-bold">
                    Transação #{selectedOrder?.id?.split("-")[0]}
                  </SheetDescription>
                </div>
              </div>
            </SheetHeader>

            {isLoadingSheet ? (
              <div className="py-20 flex flex-col items-center justify-center space-y-4">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                <p className="text-sm text-slate-500 font-medium">A buscar detalhes do recibo...</p>
              </div>
            ) : selectedOrder && (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">

                {/* INFORMAÇÕES DO CLIENTE E PAGAMENTO */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50/80 p-5 rounded-2xl border border-slate-100">
                  <div className="space-y-1">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Cliente</p>
                    <p className="font-bold text-slate-900 truncate">
                      {selectedOrder.customer_name || "Cliente Avulso"}
                    </p>
                  </div>
                  <div className="space-y-1 text-right">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Data do Pedido</p>
                    <p className="font-medium text-slate-700 text-sm">
                      {new Date(selectedOrder.created_at).toLocaleString("pt-BR", {
                        day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit"
                      })}
                    </p>
                  </div>
                  <div className="col-span-2 pt-4 mt-2 border-t border-slate-200/60 flex justify-between items-center">
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Meio de Pagamento</p>
                    <Badge variant="secondary" className="bg-white border border-slate-200 text-slate-700 uppercase font-bold tracking-widest text-[10px]">
                      {selectedOrder.payment_method === 'cash' ? 'Dinheiro' : selectedOrder.payment_method}
                    </Badge>
                  </div>
                </div>

                {/* LISTA DE ITENS */}
                <div>
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <ShoppingBag className="w-4 h-4 text-slate-400" />
                    Itens do Pedido
                  </h4>

                  <div className="space-y-3">
                    {selectedOrder.pos_order_items.map((item) => (
                      <div key={item.id} className="relative flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white border border-slate-200/60 rounded-xl shadow-sm hover:border-slate-300 transition-colors gap-4">
                        
                        <div className="flex items-start gap-3">
                          <div className={`mt-0.5 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${item.item_type === 'product' ? 'bg-emerald-100 text-emerald-600' : 'bg-purple-100 text-purple-600'}`}>
                            {item.item_type === 'product' ? <Package className="w-4 h-4" /> : <Scissors className="w-4 h-4" />}
                          </div>
                          <div>
                            <p className="font-bold text-slate-900 text-sm">
                              {item.item_type === 'product' ? item.products?.name : item.services?.name}
                            </p>
                            <div className="flex items-center flex-wrap gap-2 mt-1.5">
                              <span className="text-xs font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                {item.quantity}x R$ {Number(item.unit_price).toFixed(2)}
                              </span>
                              {item.staff && (
                                <span className="text-[10px] font-bold text-blue-700 bg-blue-50/80 border border-blue-100 px-1.5 py-0.5 rounded uppercase tracking-wider">
                                  Op: {item.staff.full_name.split(' ')[0]}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t border-slate-100 sm:border-0 pt-3 sm:pt-0">
                          <p className="font-black text-slate-900 text-base">
                            R$ {(item.quantity * item.unit_price).toFixed(2)}
                          </p>
                          {item.commission_amount > 0 && (
                            <div className="flex items-center gap-1 mt-1">
                              <span className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">Comissão</span>
                              <Badge className="bg-emerald-50 hover:bg-emerald-50 text-emerald-700 border-emerald-200 font-bold text-xs px-1.5 py-0">
                                R$ {Number(item.commission_amount).toFixed(2)}
                              </Badge>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* FOOTER FIXO COM TOTAL (Acompanha o scroll) */}
          {!isLoadingSheet && selectedOrder && (
            <div className="p-6 md:p-8 bg-slate-50 border-t border-slate-200 shrink-0">
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">Total Final</span>
                <span className="text-3xl font-black text-slate-900 tracking-tighter">
                  R$ {selectedOrder.pos_order_items.reduce((acc, item) => acc + (item.quantity * item.unit_price), 0).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </Tabs>
  );
}