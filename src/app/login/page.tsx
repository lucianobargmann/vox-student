'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2, CheckCircle, MessageSquare, Phone } from 'lucide-react';

export default function Login() {
  const { user, requestMagicLink, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'whatsapp'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  // Redirect if already authenticated
  React.useEffect(() => {
    if (user && !loading) {
      router.push('/');
    }
  }, [user, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setMessage('');
    setSuccess(false);

    try {
      if (authMethod === 'email') {
        const { error } = await requestMagicLink(email);
        if (error) {
          setError(error);
        } else {
          setSuccess(true);
          setMessage('Link de acesso enviado para seu email! Verifique sua caixa de entrada.');
        }
      } else {
        // WhatsApp magic link
        const response = await fetch('/api/whatsapp/magic-link', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ phoneNumber })
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || 'Erro ao enviar link via WhatsApp');
        } else {
          setSuccess(true);
          setMessage('Link de acesso enviado via WhatsApp! Verifique suas mensagens.');
        }
      }
    } catch {
      setError('Erro inesperado. Tente novamente.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="mx-auto animate-spin" size={48} />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  // Don't render login form if user is already authenticated
  if (user) {
    return null;
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
          {success ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Email enviado!
                </h3>
                <p className="text-gray-600 text-sm">
                  Enviamos um link de acesso para <strong>{authMethod === 'email' ? email : phoneNumber}</strong>.
                  {authMethod === 'email' ? 'Clique no link para fazer login.' : 'Clique no link recebido via WhatsApp para fazer login.'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                  setPhoneNumber('');
                  setMessage('');
                }}
                className="w-full"
              >
                Enviar outro link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Authentication Method Selector */}
              <div className="flex space-x-2 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    authMethod === 'email'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('whatsapp')}
                  className={`flex-1 flex items-center justify-center py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    authMethod === 'whatsapp'
                      ? 'bg-white text-gray-900 shadow-sm'
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  WhatsApp
                </button>
              </div>

              {/* Input Field */}
              <div>
                <label htmlFor={authMethod} className="block text-sm font-medium text-gray-700 mb-2">
                  {authMethod === 'email' ? 'Email' : 'Número do WhatsApp'}
                </label>
                {authMethod === 'email' ? (
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    disabled={isSubmitting}
                    className="w-full"
                  />
                ) : (
                  <Input
                    id="whatsapp"
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="+55 11 99999-9999"
                    required
                    disabled={isSubmitting}
                    className="w-full"
                  />
                )}
              </div>

              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {message && !error && (
                <Alert>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                disabled={isSubmitting || (authMethod === 'email' ? !email : !phoneNumber)}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    {authMethod === 'email' ? (
                      <Mail className="w-4 h-4 mr-2" />
                    ) : (
                      <MessageSquare className="w-4 h-4 mr-2" />
                    )}
                    Enviar link via {authMethod === 'email' ? 'Email' : 'WhatsApp'}
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-6 text-center">
            <p className="text-xs text-gray-500">
              Criado com ❤️ por Hcktplanet Informática &copy; 2025
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
