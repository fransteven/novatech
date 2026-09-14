'use client';

import { useState } from 'react';
import { IPHONE_VALIDATION_PHASES, ValidationItem } from '@/constants/iphone-check-list';
import { InspectionItem } from '@/components/iphone-checklist/inspection-item';
import { ProtocolSheet } from '@/components/iphone-checklist/protocol-sheet';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle, ShieldAlert, CheckCircle2, RotateCcw, Smartphone, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type ItemStatus = 'pending' | 'approved' | 'failed';

export default function IPhonePurchaseChecklistPage() {
  const [statuses, setStatuses] = useState<Record<string, ItemStatus>>({});
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [selectedItemForProtocol, setSelectedItemForProtocol] = useState<ValidationItem | null>(null);
  const [isRejected, setIsRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');

  const handleStatusChange = (itemId: string, status: ItemStatus, isCritical: boolean, label: string) => {
    if (isRejected && status !== 'approved') return; // Si ya está rechazado, solo permitir resetear si se aprueba (aunque lo ideal es resetear todo)

    const newStatuses = { ...statuses, [itemId]: status };
    setStatuses(newStatuses);

    if (status === 'failed' && isCritical) {
      setIsRejected(true);
      setRejectionReason(label);
    }
  };

  const resetForm = () => {
    setStatuses({});
    setInputs({});
    setIsRejected(false);
    setRejectionReason('');
  };

  const isPhaseUnlocked = (phaseIndex: number) => {
    if (phaseIndex === 0) return true;
    const previousPhase = IPHONE_VALIDATION_PHASES[phaseIndex - 1];
    return previousPhase.items.every((item) => statuses[item.id] === 'approved' || (item.type === 'input' && inputs[item.id]));
  };

  const isPhaseCompleted = (phaseIndex: number) => {
    const phase = IPHONE_VALIDATION_PHASES[phaseIndex];
    return phase.items.every((item) => statuses[item.id] === 'approved' || (item.type === 'input' && inputs[item.id]));
  };

  return (
    <div className="container mx-auto py-8 max-w-4xl space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Smartphone className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Peritaje de iPhones</h1>
          </div>
          <p className="text-muted-foreground">Terminal de inspección técnica para la adquisición segura de equipos usados.</p>
        </div>
        <Button variant="outline" size="sm" onClick={resetForm} className="w-fit gap-2">
          <RotateCcw className="h-4 w-4" />
          Reiniciar Inspección
        </Button>
      </div>

      {isRejected && (
        <Alert variant="destructive" className="border-red-500/50 bg-red-500/10 animate-in zoom-in-95 duration-300">
          <ShieldAlert className="h-5 w-5" />
          <AlertTitle className="font-bold text-lg">EQUIPO NO APTO PARA COMPRA</AlertTitle>
          <AlertDescription className="text-sm opacity-90 mt-1">
            El dispositivo ha fallado un control crítico: <strong className="underline">{rejectionReason}</strong>. Por política de seguridad, la transacción debe ser cancelada de inmediato.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid gap-8">
        {IPHONE_VALIDATION_PHASES.map((phase, idx) => {
          const unlocked = isPhaseUnlocked(idx) && !isRejected;
          const completed = isPhaseCompleted(idx);

          return (
            <Card
              key={phase.id}
              className={cn(
                'relative border-l-4 transition-[border-color,box-shadow,opacity,filter] duration-300',
                unlocked ? 'border-l-primary shadow-sm' : 'border-l-muted opacity-60 grayscale-[0.5]',
                completed && 'border-l-green-500'
              )}
            >
              {!unlocked && !isRejected && (
                <div className="absolute inset-0 z-10 bg-background/5 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
                  <div className="bg-muted px-4 py-2 rounded-full border shadow-sm flex items-center gap-2 text-xs font-medium">
                    <Lock className="h-3 w-3" />
                    Complete la fase anterior para desbloquear
                  </div>
                </div>
              )}

              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <CardTitle className="text-xl flex items-center gap-2">
                      {phase.title}
                      {completed && <CheckCircle2 className="h-5 w-5 text-green-500" />}
                    </CardTitle>
                    <CardDescription>{phase.description}</CardDescription>
                  </div>
                  <Badge variant={completed ? 'default' : unlocked ? 'secondary' : 'outline'} className={cn(completed && 'bg-green-600')}>
                    {completed ? 'Completado' : unlocked ? 'En Proceso' : 'Bloqueado'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {phase.items.map((item) => (
                    <InspectionItem
                      key={item.id}
                      item={item}
                      status={statuses[item.id] || 'pending'}
                      disabled={!unlocked}
                      inputValue={inputs[item.id]}
                      onInputChange={(val) => setInputs({ ...inputs, [item.id]: val })}
                      onStatusChange={(status) => handleStatusChange(item.id, status, item.isCritical, item.label)}
                      onOpenProtocol={() => setSelectedItemForProtocol(item)}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="pt-6 border-t flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-green-500" /> Aprobado
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-red-500" /> Fallido
          </div>
          <div className="flex items-center gap-1">
            <div className="h-2 w-2 rounded-full bg-muted-foreground" /> Pendiente
          </div>
        </div>

        {isPhaseCompleted(IPHONE_VALIDATION_PHASES.length - 1) && !isRejected && (
          <div className="flex flex-col items-end gap-2 animate-in slide-in-from-bottom-4">
            <p className="text-xs font-medium text-green-600">Inspección completada con éxito</p>
            <Button className="bg-green-600 hover:bg-green-700 gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Finalizar y Registrar Compra
            </Button>
          </div>
        )}
      </div>

      <ProtocolSheet
        item={selectedItemForProtocol}
        isOpen={!!selectedItemForProtocol}
        onClose={() => setSelectedItemForProtocol(null)}
      />
    </div>
  );
}
