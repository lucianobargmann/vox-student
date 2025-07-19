import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, LucideIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface AdminPageHeaderProps {
  title: string;
  description: string;
  icon: LucideIcon;
  backUrl?: string;
  actionButton?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
  };
}

export function AdminPageHeader({ 
  title, 
  description, 
  icon: Icon, 
  backUrl = '/',
  actionButton 
}: AdminPageHeaderProps) {
  const router = useRouter();

  return (
    <div className="bg-gradient-to-r from-[#667eea] to-[#764ba2] rounded-2xl p-8 text-white shadow-xl mb-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button 
            onClick={() => router.push(backUrl)} 
            variant="outline" 
            size="sm" 
            className="bg-white/20 text-white border-white/30 hover:bg-white/30"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar
          </Button>
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center">
              <Icon className="w-8 h-8 mr-3" />
              {title}
            </h1>
            <p className="text-white/90">
              {description}
            </p>
          </div>
        </div>
        {actionButton && (
          <div className="hidden md:block">
            <Button 
              onClick={actionButton.onClick}
              className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm"
              size="lg"
            >
              {actionButton.icon && <actionButton.icon className="w-5 h-5 mr-2" />}
              {actionButton.label}
            </Button>
          </div>
        )}
      </div>
      {/* Mobile button */}
      {actionButton && (
        <div className="md:hidden mt-4">
          <Button 
            onClick={actionButton.onClick}
            className="bg-white/20 text-white border-white/30 hover:bg-white/30 backdrop-blur-sm w-full"
          >
            {actionButton.icon && <actionButton.icon className="w-5 h-5 mr-2" />}
            {actionButton.label}
          </Button>
        </div>
      )}
    </div>
  );
}