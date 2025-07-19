'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { 
  LayoutDashboard, 
  FolderPlus, 
  BookOpen, 
  Calendar, 
  Users, 
  MessageSquare, 
  Settings, 
  CheckSquare, 
  BarChart3, 
  Shield,
  ChevronDown,
  ChevronRight,
  Menu,
  X,
  LogOut,
  User
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/contexts/AuthContext'
import { VoxStudentLogoWhite } from '@/components/ui/logo'

interface NavigationItem {
  label: string
  icon: any
  href?: string
  children?: NavigationItem[]
  adminOnly?: boolean
  superAdminOnly?: boolean
}

const navigationItems: NavigationItem[] = [
  {
    label: "Dashboard",
    icon: LayoutDashboard,
    href: "/",
  },
  {
    label: "Cadastros",
    icon: FolderPlus,
    children: [
      { label: "Cursos", icon: BookOpen, href: "/admin/courses" },
      { label: "Turmas", icon: Calendar, href: "/admin/classes" },
      { label: "Alunos", icon: Users, href: "/admin/students" },
      { label: "Templates", icon: MessageSquare, href: "/admin/reminder-templates" },
    ]
  },
  {
    label: "Operações",
    icon: Settings,
    children: [
      { label: "Presença", icon: CheckSquare, href: "/admin/attendance" },
      { label: "Relatórios", icon: BarChart3, href: "/admin/reports" },
    ]
  },
  {
    label: "Sistema",
    icon: Shield,
    children: [
      { label: "Configurações", icon: Settings, href: "/admin/settings" },
      { label: "WhatsApp", icon: MessageSquare, href: "/admin/whatsapp" },
      { label: "Segurança", icon: Shield, href: "/admin/security", superAdminOnly: true },
    ]
  }
]

interface SidebarProps {
  isOpen: boolean
  onToggle: () => void
}

export function Sidebar({ isOpen, onToggle }: SidebarProps) {
  const [expandedItems, setExpandedItems] = useState<string[]>([])
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const toggleExpanded = (label: string) => {
    setExpandedItems(prev =>
      prev.includes(label)
        ? prev.filter(item => item !== label)
        : [...prev, label]
    )
  }

  const handleNavigation = (href: string) => {
    router.push(href)
    if (window.innerWidth < 1024) {
      onToggle() // Close sidebar on mobile after navigation
    }
  }

  const filterItems = (items: NavigationItem[]): NavigationItem[] => {
    return items.filter(item => {
      if (item.superAdminOnly && user?.role !== 'SUPER_ADMIN') return false
      if (item.adminOnly && !['ADMIN', 'SUPER_ADMIN'].includes(user?.role || '')) return false
      
      if (item.children) {
        item.children = filterItems(item.children)
      }
      
      return true
    })
  }

  const filteredItems = filterItems(navigationItems)

  const isItemActive = (href?: string, children?: NavigationItem[]) => {
    if (href) return pathname === href
    if (children) return children.some(child => pathname === child.href)
    return false
  }

  return (
    <>
      {/* Mobile Overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onToggle}
        />
      )}
      
      {/* Sidebar */}
      <aside 
        className={`
          fixed top-0 left-0 h-full w-72 z-50 
          bg-gradient-to-br from-[#667eea] to-[#764ba2] 
          text-white shadow-2xl transform transition-transform duration-300 ease-in-out
          ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
          lg:relative lg:z-auto
        `}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/20">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center backdrop-blur-sm">
                <VoxStudentLogoWhite size={24} />
              </div>
              <div>
                <h1 className="text-xl font-bold">VoxStudent</h1>
                <p className="text-white/70 text-sm">Sistema Educacional</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="lg:hidden text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Info */}
          <div className="p-4 border-b border-white/20">
            <div className="flex items-center space-x-3 p-3 rounded-lg bg-white/10 backdrop-blur-sm">
              <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                <User className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user?.name || 'Usuário'}</p>
                <p className="text-white/70 text-sm truncate">{user?.email}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto">
            <div className="space-y-2">
              {filteredItems.map((item) => (
                <div key={item.label}>
                  {item.children ? (
                    <>
                      <button
                        onClick={() => toggleExpanded(item.label)}
                        className={`
                          w-full flex items-center justify-between p-3 rounded-lg 
                          transition-all duration-200 group
                          ${isItemActive(item.href, item.children)
                            ? 'bg-white/20 shadow-lg backdrop-blur-sm'
                            : 'hover:bg-white/10'
                          }
                        `}
                      >
                        <div className="flex items-center space-x-3">
                          <item.icon className="w-5 h-5" />
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {expandedItems.includes(item.label) ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      {expandedItems.includes(item.label) && (
                        <div className="ml-6 mt-2 space-y-1">
                          {item.children.map((child) => (
                            <button
                              key={child.label}
                              onClick={() => handleNavigation(child.href!)}
                              className={`
                                w-full flex items-center space-x-3 p-2 rounded-lg 
                                transition-all duration-200 text-left
                                ${pathname === child.href
                                  ? 'bg-white/20 shadow-md backdrop-blur-sm'
                                  : 'hover:bg-white/10'
                                }
                              `}
                            >
                              <child.icon className="w-4 h-4" />
                              <span className="text-sm">{child.label}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <button
                      onClick={() => handleNavigation(item.href!)}
                      className={`
                        w-full flex items-center space-x-3 p-3 rounded-lg 
                        transition-all duration-200 group
                        ${pathname === item.href
                          ? 'bg-white/20 shadow-lg backdrop-blur-sm'
                          : 'hover:bg-white/10'
                        }
                      `}
                    >
                      <item.icon className="w-5 h-5" />
                      <span className="font-medium">{item.label}</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </nav>

          {/* Footer */}
          <div className="p-4 border-t border-white/20">
            <Button
              onClick={() => signOut()}
              variant="ghost"
              className="w-full justify-start text-white hover:bg-white/10"
            >
              <LogOut className="w-5 h-5 mr-3" />
              Sair
            </Button>
          </div>
        </div>
      </aside>
    </>
  )
}