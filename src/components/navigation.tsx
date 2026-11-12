'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from 'next-themes';
import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/ui/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { settings } from '@/lib/settings';
import {
  BarChart3,
  List,
  Trophy,
  MessageCircle,
  Target,
  Settings as SettingsIcon,
  Gauge,
  Brain,
  User,
  LogOut,
  UserCircle,
  Sun,
  Moon,
  Monitor,
  RefreshCw,
  Video,
  Menu,
} from 'lucide-react';
import styles from './navigation.module.css';

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: BarChart3 },
  { name: 'Analytics', href: '/analytics', icon: Gauge },
  { name: 'Sessions', href: '/sessions', icon: List },
  { name: 'Insights', href: '/insights', icon: Brain },
  { name: 'Personal Records', href: '/prs', icon: Trophy },
  { name: 'Training Plans', href: '/plans', icon: Target },
  { name: 'AI Coach', href: '/chat', icon: MessageCircle },
  { name: 'Mocap', href: '/mocap', icon: Video },
  { name: 'Sync', href: '/sync', icon: RefreshCw },
];

function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // The client-only theme state must wait until hydration has completed.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  const cycleTheme = () => {
    const currentTheme = theme || 'system';
    let newTheme: 'light' | 'dark' | 'system';

    if (currentTheme === 'light') {
      newTheme = 'dark';
    } else if (currentTheme === 'dark') {
      newTheme = 'system';
    } else {
      newTheme = 'light';
    }

    setTheme(newTheme);
    settings.updateUserPreferences({ theme: newTheme });
  };

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9">
        <Sun className="h-4 w-4" />
      </Button>
    );
  }

  const currentTheme = theme || 'system';
  const Icon = currentTheme === 'light' ? Sun : currentTheme === 'dark' ? Moon : Monitor;
  const label = currentTheme === 'light' ? 'Light' : currentTheme === 'dark' ? 'Dark' : 'System';

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={cycleTheme}
      className="h-9 w-9"
      title={`Theme: ${label} (click to cycle)`}
    >
      <Icon className="h-4 w-4" />
    </Button>
  );
}

export function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session, status } = useSession();

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/auth/login');
  };

  return (
    <header className="border-b bg-background">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          {/* Logo/Title */}
          <Link href="/dashboard" className="flex items-center space-x-2">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary">
              <BarChart3 className="h-4 w-4 text-primary-foreground" />
            </div>
            <span
              className={cn(
                styles.compactOptionalLabel,
                'text-xl font-bold text-foreground whitespace-nowrap pr-2'
              )}
            >
              Rowing Tracker
            </span>
          </Link>

          {/* Navigation Links */}
          <nav className={cn(styles.wideNavigation, 'items-center space-x-4')}>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Button
                  key={item.name}
                  asChild
                  variant={isActive ? 'default' : 'ghost'}
                  size="sm"
                >
                  <Link
                    href={item.href}
                    className={cn(
                      'flex items-center space-x-2',
                      isActive && 'bg-primary text-primary-foreground'
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Link>
                </Button>
              );
            })}

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* User Menu */}
            {status === 'authenticated' && session?.user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="flex items-center space-x-2">
                    <UserAvatar
                      image={session.user.image}
                      name={session.user.name || session.user.email}
                      size="sm"
                    />
                    <span>{session.user.name || session.user.email}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-3">
                    <UserAvatar
                      image={session.user.image}
                      name={session.user.name || session.user.email}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {session.user.name || session.user.email}
                      </span>
                      {session.user.name && session.user.email && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {session.user.email}
                        </span>
                      )}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="flex items-center cursor-pointer">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {session.user.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center cursor-pointer text-red-400">
                          <UserCircle className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </nav>

          {/* Compact Navigation */}
          <div className={cn(styles.compactNavigation, 'items-center space-x-1')}>
            <ThemeToggle />
            {status === 'authenticated' && session?.user && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label="Open account menu"
                  >
                    <UserAvatar
                      image={session.user.image}
                      name={session.user.name || session.user.email}
                      size="sm"
                    />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel className="flex items-center gap-3">
                    <UserAvatar
                      image={session.user.image}
                      name={session.user.name || session.user.email}
                    />
                    <span className="min-w-0">
                      <span className="block truncate">
                        {session.user.name || session.user.email}
                      </span>
                      {session.user.name && session.user.email && (
                        <span className="block truncate text-xs font-normal text-muted-foreground">
                          {session.user.email}
                        </span>
                      )}
                    </span>
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4" />
                      <span>Profile</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/settings" className="cursor-pointer">
                      <SettingsIcon className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </Link>
                  </DropdownMenuItem>
                  {session.user.role === 'admin' && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="cursor-pointer text-red-400">
                          <UserCircle className="mr-2 h-4 w-4" />
                          <span>Admin Panel</span>
                        </Link>
                      </DropdownMenuItem>
                    </>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                    <LogOut className="mr-2 h-4 w-4" />
                    <span>Logout</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex items-center gap-2"
                  aria-label="Open navigation menu"
                >
                  <Menu className="h-4 w-4" />
                  <span className={styles.compactOptionalLabel}>Menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Navigation</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {navigation.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <DropdownMenuItem key={item.name} asChild>
                      <Link
                        href={item.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'cursor-pointer',
                          isActive && 'bg-accent text-accent-foreground'
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                        <span>{item.name}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}
