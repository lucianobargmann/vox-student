'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MessageSquare, ArrowLeft, Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function WhatsAppLogin() {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!phoneNumber.trim()) {
      toast.error('Por favor, informe seu número de telefone');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('/api/whatsapp/magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim()
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar link de acesso');
      }

      toast.success('Link de acesso enviado via WhatsApp! 📱');
      
      // In development, show the magic link
      if (process.env.NODE_ENV === 'development' && data.magicLinkUrl) {
        toast.info(`Link de desenvolvimento: ${data.magicLinkUrl}`);
      }

    } catch (error) {
      console.error('Error sending WhatsApp magic link:', error);
      toast.error(error instanceof Error ? error.message : 'Erro ao enviar link de acesso');
    } finally {
      setIsLoading(false);
    }
  };

  const formatPhoneNumber = (value: string) => {
    // Remove all non-digits
    const digits = value.replace(/\D/g, '');
    
    // Format as Brazilian phone number
    if (digits.length <= 2) {
      return `+${digits}`;
    } else if (digits.length <= 4) {
      return `+${digits.slice(0, 2)} ${digits.slice(2)}`;
    } else if (digits.length <= 9) {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4)}`;
    } else {
      return `+${digits.slice(0, 2)} ${digits.slice(2, 4)} ${digits.slice(4, 9)}-${digits.slice(9, 13)}`;
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhoneNumber(e.target.value);
    setPhoneNumber(formatted);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Card className="shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-green-100 rounded-full">
                <MessageSquare className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold text-gray-900">
              Login via WhatsApp
            </CardTitle>
            <CardDescription className="text-gray-600">
              Receba um link de acesso diretamente no seu WhatsApp
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Número do WhatsApp</Label>
                <Input
                  id="phone"
                  type="tel"
                  placeholder="+55 11 99999-9999"
                  value={phoneNumber}
                  onChange={handlePhoneChange}
                  disabled={isLoading}
                  className="text-lg"
                />
                <p className="text-xs text-gray-500">
                  Digite seu número com código do país (+55 para Brasil)
                </p>
              </div>

              <Button 
                type="submit" 
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Enviar Link de Acesso
                  </>
                )}
              </Button>
            </form>

            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">
                ℹ️ Como funciona:
              </h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Digite seu número de WhatsApp</li>
                <li>• Receba um link de acesso seguro</li>
                <li>• Clique no link para fazer login</li>
                <li>• Acesso válido por 15 minutos</li>
              </ul>
            </div>

            <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
              <h3 className="font-semibold text-yellow-900 mb-2">
                👥 Quem pode usar:
              </h3>
              <ul className="text-sm text-yellow-800 space-y-1">
                <li>• Estudantes cadastrados no sistema</li>
                <li>• Administradores autorizados</li>
                <li>• Número deve estar ativo no WhatsApp</li>
              </ul>
            </div>

            <div className="mt-6 text-center">
              <Button 
                variant="outline" 
                onClick={() => router.push('/auth')}
                className="text-sm"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Voltar para login por email
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>
            Problemas com o login? Entre em contato com o suporte.
          </p>
        </div>
      </div>
    </div>
  );
}
