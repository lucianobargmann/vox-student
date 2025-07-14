'use client';

import React, { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Loader2, CheckCircle, AlertCircle, Mail } from 'lucide-react';

function VerifyMagicLinkContent() {
  const { verifyMagicLink, user, loading } = useAuth();
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get('token');
    
    if (!token) {
      setError('Token não encontrado na URL');
      return;
    }

    if (user) {
      // User is already authenticated, redirect to dashboard
      router.push('/');
      return;
    }

    const handleVerification = async () => {
      setIsVerifying(true);
      setError('');

      try {
        const { error } = await verifyMagicLink(token);

        if (error) {
          setError(error);
        } else {
          setSuccess(true);
          // Redirect to dashboard after successful verification
          setTimeout(() => {
            router.push('/');
          }, 2000);
        }
      } catch {
        setError('Erro inesperado durante a verificação');
      } finally {
        setIsVerifying(false);
      }
    };

    handleVerification();
  }, [searchParams, verifyMagicLink, user, router]);

  if (loading || isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Verificando acesso...
                </h3>
                <p className="text-gray-600 text-sm">
                  Aguarde enquanto validamos seu link de acesso.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Acesso autorizado!
                </h3>
                <p className="text-gray-600 text-sm">
                  Você foi autenticado com sucesso. Redirecionando...
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 w-12 h-12 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
            <Mail className="w-6 h-6 text-white" />
          </div>
          <CardTitle className="text-2xl font-bold text-gray-900">
            VoxStudent
          </CardTitle>
          <CardDescription>
            Sistema de Gestão Educacional
          </CardDescription>
        </CardHeader>

        <CardContent>
          <div className="text-center space-y-4">
            <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Erro na verificação
              </h3>
              
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            </div>

            <Button
              onClick={() => router.push('/login')}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              Voltar ao login
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VerifyMagicLink() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Carregando...
                </h3>
                <p className="text-gray-600 text-sm">
                  Preparando verificação do link de acesso.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    }>
      <VerifyMagicLinkContent />
    </Suspense>
  );
}
