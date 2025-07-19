import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { LucideIcon } from 'lucide-react';

interface AdminCardProps {
  title: string;
  description?: string;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}

export function AdminCard({ 
  title, 
  description, 
  icon: Icon, 
  children, 
  className = '' 
}: AdminCardProps) {
  return (
    <Card className={`shadow-xl border-0 ${className}`}>
      <CardHeader className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-t-lg">
        <CardTitle className="text-2xl font-bold text-gray-900 flex items-center">
          {Icon && <Icon className="w-6 h-6 mr-2 text-[#667eea]" />}
          {title}
        </CardTitle>
        {description && (
          <CardDescription className="text-lg">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}