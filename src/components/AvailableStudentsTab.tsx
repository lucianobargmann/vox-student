'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

import { 
  Search, 
  Users, 
  UserPlus,
  Mail,
  Phone,

  Loader2
} from 'lucide-react';
import { toast } from 'sonner';

interface Student {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
  enrollments: Array<{
    id: string;
    status: string;
    type: string;
    course: {
      id: string;
      name: string;
    };
    class: {
      id: string;
      name: string;
    } | null;
  }>;
}

interface AvailableStudentsTabProps {
  classId: string;
  courseId: string;
  courseName: string;
  onEnrollmentCreated: () => void;
}

export function AvailableStudentsTab({
  classId,
  courseId,
  courseName,
  onEnrollmentCreated
}: AvailableStudentsTabProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [enrollingStudents, setEnrollingStudents] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadAvailableStudents();
  }, [courseId, classId]);

  const loadAvailableStudents = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/students');
      const result = await response.json();
      
      if (result.data) {
        // Filter students who are not already enrolled in this class
        const availableStudents = result.data.filter((student: Student) => {
          return !student.enrollments.some(enrollment => 
            enrollment.course.id === courseId && 
            enrollment.class?.id === classId &&
            (enrollment.status === 'active' || enrollment.status === 'inactive')
          );
        });
        setStudents(availableStudents);
      }
    } catch (error) {
      console.error('Error loading students:', error);
      toast.error('Erro ao carregar alunos');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickEnroll = async (studentId: string, type: 'regular' | 'guest' | 'restart' = 'regular') => {
    try {
      setEnrollingStudents(prev => new Set(prev).add(studentId));
      
      const response = await fetch('/api/enrollments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId,
          courseId,
          classId,
          type,
          notes: `Matrícula rápida via detalhes da turma`
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Erro ao matricular aluno');
      }

      toast.success('Aluno matriculado com sucesso!');
      onEnrollmentCreated();
      loadAvailableStudents(); // Refresh the list
    } catch (error) {
      console.error('Error enrolling student:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao matricular aluno');
    } finally {
      setEnrollingStudents(prev => {
        const newSet = new Set(prev);
        newSet.delete(studentId);
        return newSet;
      });
    }
  };

  const isStudentEnrolledInCourse = (student: Student) => {
    return student.enrollments.some(enrollment => 
      enrollment.course.id === courseId && 
      (enrollment.status === 'active' || enrollment.status === 'inactive')
    );
  };

  const getStudentCourseStatus = (student: Student) => {
    const courseEnrollment = student.enrollments.find(enrollment => 
      enrollment.course.id === courseId
    );
    return courseEnrollment;
  };

  const filteredStudents = students.filter(student =>
    student.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    student.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin mr-2" />
          <span>Carregando alunos disponíveis...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Alunos Disponíveis para {courseName}
        </CardTitle>
        <CardDescription>
          {filteredStudents.length} aluno{filteredStudents.length !== 1 ? 's' : ''} disponível{filteredStudents.length !== 1 ? 'eis' : ''} para matrícula nesta turma
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, email ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {filteredStudents.length === 0 ? (
            <div className="text-center py-8">
              <Users className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold text-foreground">
                {searchTerm ? 'Nenhum aluno encontrado' : 'Todos os alunos já estão matriculados'}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {searchTerm 
                  ? 'Tente uma busca diferente.' 
                  : 'Não há alunos disponíveis para matrícula nesta turma.'
                }
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Aluno</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Status no Curso</TableHead>
                  <TableHead>Status do Aluno</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredStudents.map((student) => {
                  const courseEnrollment = getStudentCourseStatus(student);
                  const isEnrolling = enrollingStudents.has(student.id);
                  
                  return (
                    <TableRow key={student.id}>
                      <TableCell>
                        <div className="font-medium">{student.name}</div>
                      </TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          {student.email && (
                            <div className="flex items-center text-sm">
                              <Mail className="w-3 h-3 mr-1" />
                              {student.email}
                            </div>
                          )}
                          {student.phone && (
                            <div className="flex items-center text-sm text-muted-foreground">
                              <Phone className="w-3 h-3 mr-1" />
                              {student.phone}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {courseEnrollment ? (
                          <div className="space-y-1">
                            <Badge 
                              variant={courseEnrollment.status === 'active' ? 'default' : 'secondary'}
                            >
                              {courseEnrollment.status === 'active' ? 'Ativo' : 
                               courseEnrollment.status === 'inactive' ? 'Inativo' : 
                               courseEnrollment.status === 'completed' ? 'Concluído' : 'Transferido'}
                            </Badge>
                            <div className="text-xs text-muted-foreground">
                              {courseEnrollment.class?.name || 'Sem turma específica'}
                            </div>
                            <Badge variant="outline" className="text-xs">
                              {courseEnrollment.type === 'regular' ? 'Regular' : 
                               courseEnrollment.type === 'guest' ? 'Convidado' : 'Reinício'}
                            </Badge>
                          </div>
                        ) : (
                          <Badge variant="outline">Não matriculado</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={student.status === 'active' ? 'default' : 'secondary'}>
                          {student.status === 'active' ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          {courseEnrollment ? (
                            // Student is enrolled in course but not in this class
                            <div className="flex space-x-1">
                              <Button
                                onClick={() => handleQuickEnroll(student.id, 'guest')}
                                variant="outline"
                                size="sm"
                                disabled={isEnrolling}
                                title="Adicionar como convidado para reposição"
                              >
                                {isEnrolling ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <UserPlus className="w-4 h-4 mr-1" />
                                    Convidado
                                  </>
                                )}
                              </Button>
                              <Button
                                onClick={() => handleQuickEnroll(student.id, 'restart')}
                                variant="outline"
                                size="sm"
                                disabled={isEnrolling}
                                title="Reiniciar curso nesta turma"
                              >
                                {isEnrolling ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <>
                                    <UserPlus className="w-4 h-4 mr-1" />
                                    Reiniciar
                                  </>
                                )}
                              </Button>
                            </div>
                          ) : (
                            // Student is not enrolled in course
                            <Button
                              onClick={() => handleQuickEnroll(student.id, 'regular')}
                              variant="default"
                              size="sm"
                              disabled={isEnrolling}
                              title="Matricular normalmente"
                            >
                              {isEnrolling ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <UserPlus className="w-4 h-4 mr-1" />
                                  Matricular
                                </>
                              )}
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
