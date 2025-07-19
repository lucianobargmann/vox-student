'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Mail, Loader2, CheckCircle, MessageSquare, Phone } from 'lucide-react';
import { VoxStudentLogo } from '@/components/ui/logo';

export default function Login() {
  const { user, requestMagicLink, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [authMethod, setAuthMethod] = useState<'email' | 'whatsapp'>('email');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [success, setSuccess] = useState(false);
  const [showVersion, setShowVersion] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute top-0 left-0 w-full h-full">
        <div className="absolute top-10 left-10 w-20 h-20 bg-white/10 rounded-full blur-xl animate-pulse"></div>
        <div className="absolute top-32 right-16 w-32 h-32 bg-white/5 rounded-full blur-2xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-20 left-1/4 w-24 h-24 bg-white/10 rounded-full blur-xl animate-pulse delay-500"></div>
        <div className="absolute bottom-32 right-10 w-16 h-16 bg-white/15 rounded-full blur-lg animate-pulse delay-300"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-40 h-40 bg-white/3 rounded-full blur-3xl animate-pulse delay-700"></div>
      </div>

      <Card className="w-full max-w-md bg-white/95 backdrop-blur-xl border-0 shadow-2xl relative z-10">
        <CardHeader className="text-center pb-8">
          <div className="mx-auto mb-6 w-20 h-20 bg-gradient-to-br from-[#667eea] to-[#764ba2] rounded-2xl flex items-center justify-center shadow-xl">
            <VoxStudentLogo size={40} className="text-white" />
          </div>
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">
            VoxStudent
          </CardTitle>
          <CardDescription className="text-gray-600 text-lg mt-2">
            Sistema de Gestão Educacional
          </CardDescription>
        </CardHeader>

        <CardContent>
          {success ? (
            <div className="text-center space-y-6">
              <div className="mx-auto w-20 h-20 bg-gradient-to-br from-green-400 to-green-600 rounded-2xl flex items-center justify-center shadow-xl">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-3">
                  Link Mágico Enviado! ✨
                </h3>
                <p className="text-gray-600 leading-relaxed">
                  Enviamos um link de acesso seguro para <br/>
                  <strong className="text-[#667eea]">{authMethod === 'email' ? email : phoneNumber}</strong>
                  <br/><br/>
                  {authMethod === 'email' 
                    ? 'Verifique sua caixa de entrada e clique no link para acessar o sistema.' 
                    : 'Verifique suas mensagens no WhatsApp e clique no link para acessar o sistema.'
                  }
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
                className="w-full py-3 border-2 border-[#667eea] text-[#667eea] hover:bg-[#667eea] hover:text-white rounded-xl font-semibold transition-all duration-300"
              >
                Enviar outro link
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Authentication Method Selector */}
              <div className="flex space-x-1 p-1 bg-gradient-to-r from-gray-100 to-gray-50 rounded-xl border border-gray-200">
                <button
                  type="button"
                  onClick={() => setAuthMethod('email')}
                  className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                    authMethod === 'email'
                      ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <Mail className="w-4 h-4 mr-2" />
                  Email
                </button>
                <button
                  type="button"
                  onClick={() => setAuthMethod('whatsapp')}
                  className={`flex-1 flex items-center justify-center py-3 px-4 rounded-lg text-sm font-medium transition-all duration-300 ${
                    authMethod === 'whatsapp'
                      ? 'bg-gradient-to-r from-[#667eea] to-[#764ba2] text-white shadow-lg transform scale-105'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-white/50'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  WhatsApp
                </button>
              </div>

              {/* Input Field */}
              <div className="space-y-2">
                <label htmlFor={authMethod} className="block text-sm font-semibold text-gray-700">
                  {authMethod === 'email' ? 'Endereço de Email' : 'Número do WhatsApp'}
                </label>
                {authMethod === 'email' ? (
                  <div className="relative">
                    <Mail className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                    />
                  </div>
                ) : (
                  <div className="relative">
                    <Phone className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <Input
                      id="whatsapp"
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="+55 11 99999-9999"
                      required
                      disabled={isSubmitting}
                      className="w-full pl-12 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:border-[#667eea] focus:ring-4 focus:ring-[#667eea]/20 transition-all duration-300"
                    />
                  </div>
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
                className="w-full py-4 bg-gradient-to-r from-[#667eea] to-[#764ba2] hover:from-[#5a6fd8] to-[#6b4190] text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-[1.02] transition-all duration-300 disabled:opacity-50 disabled:transform-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                    Enviando link mágico...
                  </>
                ) : (
                  <>
                    {authMethod === 'email' ? (
                      <Mail className="w-5 h-5 mr-3" />
                    ) : (
                      <MessageSquare className="w-5 h-5 mr-3" />
                    )}
                    Enviar Link Mágico via {authMethod === 'email' ? 'Email' : 'WhatsApp'}
                  </>
                )}
              </Button>
            </form>
          )}

          <div className="mt-8 text-center space-y-3">
            {showVersion && (
              <div className="flex items-center justify-center space-x-2 text-gray-400">
                <div className="w-8 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
                <span className="text-xs font-medium">VoxStudent v1.1.0</span>
                <div className="w-8 h-px bg-gradient-to-r from-transparent via-gray-300 to-transparent"></div>
              </div>
            )}
            <div className={showVersion ? "space-y-1" : ""}>
              {showVersion && (
                <p className="text-xs text-gray-500">
                  Build: {process.env.NODE_ENV || 'development'}-20250719164420 | {new Date().toLocaleDateString('pt-BR')}
                </p>
              )}
              <p className="text-xs text-gray-500">
                Criado com{' '}
                <span 
                  className="cursor-pointer select-none"
                  onClick={(e) => {
                    if (e.ctrlKey || e.metaKey) {
                      setShowVersion(!showVersion);
                    }
                  }}
                >
                  ❤️
                </span>
                {' '}por <span className="font-semibold bg-gradient-to-r from-[#667eea] to-[#764ba2] bg-clip-text text-transparent">Hcktplanet Informática</span>
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
