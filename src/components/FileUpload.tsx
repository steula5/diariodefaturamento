import { useCallback } from 'react';
import { Upload } from 'lucide-react';
import { parseExcelFile } from '@/lib/excel-parser';
import type { Pedido } from '@/types/faturamento';
import { toast } from 'sonner';

interface FileUploadProps {
  onPedidosLoaded: (pedidos: Pedido[]) => void;
}

export function FileUpload({ onPedidosLoaded }: FileUploadProps) {
  const handleFile = useCallback(async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const pedidos = parseExcelFile(buffer);
      if (pedidos.length === 0) {
        toast.error('Nenhum pedido encontrado na planilha.');
        return;
      }
      onPedidosLoaded(pedidos);
      toast.success(`${pedidos.length} pedidos importados com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao processar a planilha.');
    }
  }, [onPedidosLoaded]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }, [handleFile]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = '';
  }, [handleFile]);

  return (
    <div
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      className="border-2 border-dashed border-primary/30 rounded-xl p-6 text-center hover:border-primary/60 transition-colors cursor-pointer bg-primary/5"
    >
      <label className="cursor-pointer flex flex-col items-center gap-2">
        <Upload className="w-8 h-8 text-primary/60" />
        <span className="text-sm font-medium text-foreground">
          Arraste a planilha Excel ou clique para selecionar
        </span>
        <span className="text-xs text-muted-foreground">.xlsx ou .xls</span>
        <input
          type="file"
          accept=".xlsx,.xls"
          onChange={handleChange}
          className="hidden"
        />
      </label>
    </div>
  );
}
