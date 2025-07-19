import { apiClient, ApiResponse } from '../api-client';

export interface ReminderTemplate {
  id: string;
  name: string;
  category?: string;
  template: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export interface CreateTemplateRequest {
  name: string;
  category?: string;
  template: string;
  description?: string;
  isActive?: boolean;
}

export interface UpdateTemplateRequest extends Partial<CreateTemplateRequest> {
  id: string;
}

class TemplatesService {
  async getTemplates(search?: string): Promise<ApiResponse<ReminderTemplate[]>> {
    const url = search ? `/api/reminder-templates?search=${encodeURIComponent(search)}` : '/api/reminder-templates';
    return apiClient.get<ReminderTemplate[]>(url);
  }

  async getTemplate(id: string): Promise<ApiResponse<ReminderTemplate>> {
    return apiClient.get<ReminderTemplate>(`/api/reminder-templates/${id}`);
  }

  async createTemplate(template: CreateTemplateRequest): Promise<ApiResponse<ReminderTemplate>> {
    return apiClient.post<ReminderTemplate>('/api/reminder-templates', template);
  }

  async updateTemplate(id: string, template: Partial<CreateTemplateRequest>): Promise<ApiResponse<ReminderTemplate>> {
    return apiClient.put<ReminderTemplate>(`/api/reminder-templates/${id}`, template);
  }

  async deleteTemplate(id: string): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return apiClient.delete(`/api/reminder-templates/${id}`);
  }

  async testTemplate(templateId: string, testData: Record<string, any>): Promise<ApiResponse<{ processedTemplate: string }>> {
    return apiClient.post(`/api/templates/test`, { templateId, testData });
  }
}

export const templatesService = new TemplatesService();