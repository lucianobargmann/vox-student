'use client';

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRightLeft, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { enrollmentsService } from '@/lib/services/enrollments.service';

interface Class {
  id: string;
  name: string;
  courseId: string;
  startDate: string;
  endDate: string | null;
  maxStudents: number | null;
  enrollments: Array<{ id: string }>;
}

interface Enrollment {
  id: string;
  studentId: string;
  courseId: string;
  classId: string | null;
  status: string;
  type: string;
  absenceCount: number;
  student: {
    id: string;
    name: string;
    email: string | null;
  };
  course: {
    id: string;
    name: string;
  };
  class: {
    id: string;
    name: string;
  } | null;
}

interface TransferStudentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  enrollment: Enrollment | null;
  onTransferCompleted: () => void;
}

export function TransferStudentDialog({
  open,
  onOpenChange,
  enrollment,
  onTransferCompleted
}: TransferStudentDialogProps) {
  const [loading, setLoading] = useState(false);
  const [classes, setClasses] = useState<Class[]>([]);
  const [formData, setFormData] = useState({
    newClassId: '',
    transferType: 'restart' as 'restart' | 'guest',
    notes: ''
  });

  useEffect(() => {
    if (open && enrollment) {
      loadClasses();
      setFormData({
        newClassId: '',
        transferType: 'restart',
        notes: ''
      });
    }
  }, [open, enrollment]);

  const loadClasses = async () => {
    if (!enrollment) return;

    try {
      const response = await fetch(`/api/classes?courseId=${enrollment.courseId}`);
      const result = await response.json();
      
      if (result.data) {
        // Filter out the current class
        const availableClasses = result.data.filter((c: Class) => 
          c.id !== enrollment.classId && c.courseId === enrollment.courseId
        );
        setClasses(availableClasses);
      }
    } catch (error) {
      console.error('Error loading classes:', error);
      toast.error('Erro ao carregar turmas');
    }
  };

  const handleTransfer = async () => {
    if (!enrollment || !formData.newClassId) {
      toast.error('Dados incompletos');
      return;
    }

    try {
      setLoading(true);

      const result = await enrollmentsService.transferEnrollment({
        enrollmentId: enrollment.id,
        newClassId: formData.newClassId,
        transferType: formData.transferType as 'restart' | 'guest',
        notes: formData.notes.trim() || undefined
      });

      if (!result.success) {
        throw new Error(result.error || 'Erro ao transferir aluno');
      }

      toast.success('Aluno transferido com sucesso!');
      onTransferCompleted();
      handleClose();
    } catch (error) {
      console.error('Error transferring student:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao transferir aluno');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      newClassId: '',
      transferType: 'restart',
      notes: ''
    });
    onOpenChange(false);
  };

  const selectedClass = classes.find(c => c.id === formData.newClassId);
  const isClassFull = selectedClass && selectedClass.maxStudents && 
    selectedClass.enrollments.length >= selectedClass.maxStudents;

  if (!enrollment) return null;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5" />
            Transferir Aluno
          </DialogTitle>
          <DialogDescription>
            Transferir {enrollment.student.name} para outra turma do mesmo curso
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current enrollment info */}
          <div className="p-3 bg-muted rounded-lg">
            <div className="text-sm font-medium">Matrícula Atual</div>
            <div className="text-sm text-muted-foreground">
              {enrollment.course.name}
              {enrollment.class && (
                <span> • {enrollment.class.name}</span>
              )}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant={enrollment.status === 'active' ? 'default' : 'secondary'}>
                {enrollment.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
              <Badge variant="outline">
                {enrollment.type === 'regular' ? 'Regular' : 
                 enrollment.type === 'guest' ? 'Convidado' : 'Reinício'}
              </Badge>
              {enrollment.absenceCount > 0 && (
                <Badge variant="destructive" className="text-xs">
                  {enrollment.absenceCount} falta{enrollment.absenceCount !== 1 ? 's' : ''}
                </Badge>
              )}
            </div>
          </div>

          {/* New class selection */}
          <div className="space-y-2">
            <Label htmlFor="newClass">Nova Turma *</Label>
            <Select
              value={formData.newClassId}
              onValueChange={(value) => setFormData({ ...formData, newClassId: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a nova turma" />
              </SelectTrigger>
              <SelectContent>
                {classes.length === 0 ? (
                  <SelectItem value="" disabled>
                    Nenhuma turma disponível
                  </SelectItem>
                ) : (
                  classes.map((classItem) => {
                    const isFull = classItem.maxStudents && 
                      classItem.enrollments.length >= classItem.maxStudents;
                    
                    return (
                      <SelectItem 
                        key={classItem.id} 
                        value={classItem.id}
                        disabled={isFull}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span>{classItem.name}</span>
                          <div className="flex items-center gap-2 ml-2">
                            {classItem.maxStudents && (
                              <span className="text-xs text-muted-foreground">
                                ({classItem.enrollments.length}/{classItem.maxStudents})
                              </span>
                            )}
                            {isFull && (
                              <Badge variant="destructive" className="text-xs">
                                Lotada
                              </Badge>
                            )}
                          </div>
                        </div>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            {isClassFull && (
              <div className="flex items-center gap-1 text-sm text-destructive">
                <AlertCircle className="w-4 h-4" />
                Turma selecionada está lotada
              </div>
            )}
          </div>

          {/* Transfer type */}
          <div className="space-y-2">
            <Label htmlFor="transferType">Tipo de Transferência</Label>
            <Select
              value={formData.transferType}
              onValueChange={(value: 'restart' | 'guest') => 
                setFormData({ ...formData, transferType: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="restart">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Reinício</Badge>
                      <span>Reiniciar curso (zerar faltas)</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Recomendado para alunos que querem recomeçar
                    </div>
                  </div>
                </SelectItem>
                <SelectItem value="guest">
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">Convidado</Badge>
                      <span>Aulas de reposição (manter faltas)</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      Para recuperar aulas perdidas
                    </div>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Motivo da transferência, observações..."
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleTransfer} 
            disabled={loading || !formData.newClassId || isClassFull}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Transferindo...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4 mr-2" />
                Transferir
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
